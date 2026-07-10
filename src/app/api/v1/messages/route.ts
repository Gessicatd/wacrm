// ============================================================
// POST /api/v1/messages — send a message via the public API.
//
// The headline public endpoint (issue #245). Supports two resolution
// modes:
//
//  1. By phone:   { "to": "+14155550123", "type": "text", ... }
//     Resolves-or-creates the contact + conversation by phone (WhatsApp
//     only), then sends. Works for Meta Cloud API and RyzeAPI depending
//     on the conversation's provider.
//
//  2. By conversation: { "conversation_id": "<uuid>", "type": "text", ... }
//     Sends directly into an existing conversation. Works for ALL
//     channels — WhatsApp (Meta / RyzeAPI) and Instagram — because the
//     shared send core routes on `conversation.channel`.
//
// Auth: API key with the `messages:send` scope. Account context (and
// the service-role client) come from `requireApiKey`.
//
// Body (by phone):
//   {
//     "to": "+14155550123",                 // required, E.164
//     "type": "text",                        // text|template|image|video|document|audio (default: text)
//     "text": "Hello!",                      // text body, or media caption
//     "media_url": "https://…/file.pdf",     // required for image/video/document/audio
//     "filename": "invoice.pdf",             // optional, document filename
//     "template": {                          // required when type=template
//       "name": "order_update",
//       "language": "en_US",
//       "params": ["A123"] | { "body": [...] }
//     },
//     "reply_to_message_id": "<uuid>",       // optional
//     "name": "Jane Doe"                     // optional, for newly-created contact
//   }
//
// Body (by conversation):
//   {
//     "conversation_id": "<uuid>",          // existing conversation to send into
//     "type": "text",
//     "text": "Hello!",
//     ...
//   }
//
// Response (201):
//   { "data": { "message_id", "whatsapp_message_id", "conversation_id",
//               "contact_id", "contact_created" } }
// ============================================================

import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation';
import {
  sendMessageToConversation,
  validateSendMessageParams,
  SendMessageError,
} from '@/lib/whatsapp/send-message';

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'messages:send');

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const toRaw = typeof body.to === 'string' ? body.to.trim() : ''
    const conversationIdRaw =
      typeof body.conversation_id === 'string' ? body.conversation_id.trim() : ''

    if (!toRaw && !conversationIdRaw) {
      return fail(
        'bad_request',
        "'to' or 'conversation_id' is required",
        400,
      )
    }

    const type = typeof body.type === 'string' ? body.type : 'text'

    // Unpack the optional `template` object into the flat params the
    // send core expects. `params` as an array → legacy positional body
    // params; as an object → structured header/body/button params.
    const template =
      body.template && typeof body.template === 'object'
        ? (body.template as Record<string, unknown>)
        : null;
    const templateParams = Array.isArray(template?.params)
      ? (template.params as unknown[]).filter(
          (p): p is string => typeof p === 'string'
        )
      : undefined;
    const templateMessageParams =
      template?.params && !Array.isArray(template.params)
        ? template.params
        : undefined;

    // Validate the message shape BEFORE resolving the conversation
    // so a bad payload 400s without leaving an orphan contact/conversation behind.
    validateSendMessageParams({
      messageType: type,
      contentText: typeof body.text === 'string' ? body.text : null,
      mediaUrl: typeof body.media_url === 'string' ? body.media_url : null,
      templateName: typeof template?.name === 'string' ? template.name : null,
    });

    let conversationId: string
    let contactId: string
    let contactCreated = false

    if (conversationIdRaw) {
      // Mode 2: send into an existing conversation. Validate it
      // belongs to the authenticated account.
      const { data: existingConv, error: convErr } = await ctx.supabase
        .from('conversations')
        .select('id, contact_id, account_id')
        .eq('id', conversationIdRaw)
        .eq('account_id', ctx.accountId)
        .maybeSingle()

      if (convErr || !existingConv) {
        return fail('not_found', 'Conversation not found', 404)
      }

      conversationId = existingConv.id
      contactId = existingConv.contact_id as string
    } else {
      // Mode 1: resolve by phone (WhatsApp). Find-or-create the
      // contact + conversation, then send.
      const resolved = await resolveConversationByPhone(
        ctx.supabase,
        ctx.accountId,
        toRaw,
        typeof body.name === 'string' ? body.name : null,
      )
      conversationId = resolved.conversationId
      contactId = resolved.contactId
      contactCreated = resolved.contactCreated
    }

    const result = await sendMessageToConversation(
      ctx.supabase,
      ctx.accountId,
      {
        conversationId,
        messageType: type,
        contentText: typeof body.text === 'string' ? body.text : null,
        mediaUrl: typeof body.media_url === 'string' ? body.media_url : null,
        filename: typeof body.filename === 'string' ? body.filename : null,
        templateName: typeof template?.name === 'string' ? template.name : null,
        templateLanguage:
          typeof template?.language === 'string' ? template.language : null,
        templateParams,
        templateMessageParams,
        replyToMessageId:
          typeof body.reply_to_message_id === 'string'
            ? body.reply_to_message_id
            : null,
      },
    )

    return ok(
      {
        message_id: result.messageId,
        whatsapp_message_id: result.whatsappMessageId,
        conversation_id: conversationId,
        contact_id: contactId,
        contact_created: contactCreated,
      },
      201,
    )
  } catch (err) {
    if (err instanceof SendMessageError) {
      return fail(err.code, err.message, err.status);
    }
    return toApiErrorResponse(err);
  }
}
