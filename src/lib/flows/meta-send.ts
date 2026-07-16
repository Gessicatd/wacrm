import {
  sendInteractiveButtons,
  sendInteractiveList,
  sendMediaMessage,
  sendTextMessage,
  type InteractiveButton,
  type InteractiveListSection,
  type MediaKind,
} from '@/lib/whatsapp/meta-api'
import {
  sendTextMessage as sendIgTextMessage,
  sendMediaMessage as sendIgMediaMessage,
  sendButtonTemplate,
  sendPrivateReply,
} from '@/lib/instagram/meta-api'
import {
  sendText as sendRyzeText,
  sendMedia as sendRyzeMedia,
  sendButtons as sendRyzeButtons,
  sendList as sendRyzeList,
} from '@/lib/ryzeapi/client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getRefreshedAccessToken } from '@/lib/instagram/token-refresh'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import { supabaseAdmin } from './admin-client'

// ------------------------------------------------------------
// Flows-side Meta sender (interactive variants).
//
// Mirrors src/lib/automations/meta-send.ts (engineSendText /
// engineSendTemplate) but emits interactive button + list messages.
// Kept separate from the automations file so the two engines don't
// fight over each other's shape — once both stabilize, the
// phone-variant retry + DB persistence are obvious extraction
// candidates into a shared base.
//
// Channel awareness (migration 036): looks up the conversation's
// channel and routes to WhatsApp or Instagram API accordingly.
// ------------------------------------------------------------

type Transport = 'whatsapp' | 'instagram' | 'ryzeapi'

async function resolveTransport(
  db: ReturnType<typeof supabaseAdmin>,
  conversationId: string,
): Promise<Transport> {
  const { data: conv } = await db
    .from('conversations')
    .select('channel, provider')
    .eq('id', conversationId)
    .maybeSingle()
  const channel = (conv?.channel as string) || 'whatsapp'
  if (channel === 'instagram') return 'instagram'
  const provider = (conv?.provider as string) || 'meta'
  if (provider === 'ryzeapi') return 'ryzeapi'
  return 'whatsapp'
}

/**
 * Check whether this conversation's most recent customer message has an
 * `instagram_comment_id` — meaning the thread was triggered by a post
 * comment. When set, outbound sends route through the private-reply API
 * (using comment_id as the recipient handle) instead of the normal DM
 * send (using the IGSID).
 */
async function resolveCommentId(
  db: ReturnType<typeof supabaseAdmin>,
  conversationId: string,
): Promise<string | null> {
  const { data: lastCustomerMsg } = await db
    .from('messages')
    .select('instagram_comment_id')
    .eq('conversation_id', conversationId)
    .eq('sender_type', 'customer')
    .not('instagram_comment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (lastCustomerMsg?.instagram_comment_id as string) ?? null
}

interface SendTextEngineArgs {
  /** Account-level tenancy key. Drives contact + whatsapp_config
   *  lookups so a flow authored by user A still sends through the
   *  WhatsApp number user B saved on the same account. */
  accountId: string
  /** Original author of the flow — used for INSERT audit columns
   *  and for resolving the agent's identity in logs. Not consulted
   *  for tenancy. */
  userId: string
  conversationId: string
  contactId: string
  text: string
}

/**
 * Send a plain-text WhatsApp message from the Flows engine.
 *
 * Used by the runner's `send_message` and `collect_input` nodes —
 * both prompt the customer with text and either auto-advance (the
 * send_message case) or suspend awaiting a text reply (collect_input).
 *
 * Wraps the same phone-variant retry + DB persistence pattern as the
 * interactive senders; the duplication will be DRY'd into a shared
 * `engineSendBase` once the v2 features (templates with variables,
 * media sends) settle.
 */
export async function engineSendText(
  args: SendTextEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()
  const transport = await resolveTransport(db, args.conversationId)
  if (transport === 'instagram') {
    return sendTextViaInstagram(db, args)
  }
  if (transport === 'ryzeapi') {
    return sendTextViaRyzeApi(db, args)
  }
  return sendTextViaWhatsApp(db, args)
}

async function sendTextViaWhatsApp(
  db: ReturnType<typeof supabaseAdmin>,
  args: SendTextEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', args.contactId)
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this account')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', args.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('WhatsApp not configured for this account')
  }

  const accessToken = decrypt(config.access_token)

  const attempt = async (phone: string): Promise<string> => {
    const r = await sendTextMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: phone,
      text: args.text,
    })
    return r.messageId
  }

  const variants = phoneVariants(sanitized)
  let workingPhone = sanitized
  let waMessageId = ''
  let lastError: unknown = null
  for (const v of variants) {
    try {
      waMessageId = await attempt(v)
      workingPhone = v
      lastError = null
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!isRecipientNotAllowedError(msg)) throw err
      lastError = err
    }
  }
  if (lastError) throw lastError

  if (workingPhone !== sanitized) {
    await db.from('contacts').update({ phone: workingPhone }).eq('id', contact.id)
  }

  const { error: msgErr } = await db.from('messages').insert({
    account_id: args.accountId,
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: 'text',
    content_text: args.text,
    message_id: waMessageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Meta but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: args.text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  return { whatsapp_message_id: waMessageId }
}

async function sendTextViaRyzeApi(
  db: ReturnType<typeof supabaseAdmin>,
  args: SendTextEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', args.contactId)
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this account')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('ryzeapi_config')
    .select('*')
    .eq('account_id', args.accountId)
    .eq('status', 'connected')
    .single()
  if (configErr || !config) {
    throw new Error('RyzeAPI not configured or not connected')
  }

  const instanceToken = decrypt(config.instance_token)
  const r = await sendRyzeText({
    apiUrl: config.api_url,
    instanceToken,
    instance: config.instance_name,
    number: sanitized,
    message: args.text,
  })

  const { error: msgErr } = await db.from('messages').insert({
    account_id: args.accountId,
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: 'text',
    content_text: args.text,
    message_id: r.messageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent via RyzeAPI but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: args.text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  return { whatsapp_message_id: r.messageId }
}

async function sendTextViaInstagram(
  db: ReturnType<typeof supabaseAdmin>,
  args: SendTextEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, instagram_id')
    .eq('id', args.contactId)
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (contactErr || !contact?.instagram_id) {
    throw new Error('contact has no instagram_id for this account')
  }

  const { data: config, error: configErr } = await db
    .from('instagram_config')
    .select('*')
    .eq('account_id', args.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('Instagram not configured for this account')
  }

  const accessToken = await getRefreshedAccessToken(config)
  const igUserId = config.instagram_business_account_id

  const commentId = await resolveCommentId(db, args.conversationId)

  const r = commentId
    ? await sendPrivateReply({ igUserId, accessToken, commentId, text: args.text })
    : await sendIgTextMessage({
        igUserId,
        accessToken,
        to: contact.instagram_id,
        text: args.text,
      })

  const { error: msgErr } = await db.from('messages').insert({
    account_id: args.accountId,
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: 'text',
    content_text: args.text,
    message_id: r.messageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Instagram but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: args.text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  return { whatsapp_message_id: r.messageId }
}

interface SendMediaEngineArgs {
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  kind: MediaKind
  /** Public URL Meta fetches at send time. */
  link: string
  caption?: string
  /** Document-only; ignored by Meta for image/video. */
  filename?: string
}

/**
 * Send an image / video / document from the Flows engine.
 *
 * Used by the runner's `send_media` node. Auto-advances after the
 * send lands (same suspend semantics as send_message). Same
 * phone-variant retry + DB persistence as the text/interactive
 * senders; persists the outgoing message with `content_type` matching
 * the media kind so the inbox renders the right preview.
 */
export async function engineSendMedia(
  args: SendMediaEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()
  const transport = await resolveTransport(db, args.conversationId)
  if (transport === 'instagram') {
    return sendMediaViaInstagram(db, args)
  }
  if (transport === 'ryzeapi') {
    return sendMediaViaRyzeApi(db, args)
  }
  return sendMediaViaWhatsApp(db, args)
}

async function sendMediaViaWhatsApp(
  db: ReturnType<typeof supabaseAdmin>,
  args: SendMediaEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', args.contactId)
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this account')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', args.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('WhatsApp not configured for this account')
  }

  const accessToken = decrypt(config.access_token)

  const attempt = async (phone: string): Promise<string> => {
    const r = await sendMediaMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: phone,
      kind: args.kind,
      link: args.link,
      caption: args.caption,
      filename: args.filename,
    })
    return r.messageId
  }

  const variants = phoneVariants(sanitized)
  let workingPhone = sanitized
  let waMessageId = ''
  let lastError: unknown = null
  for (const v of variants) {
    try {
      waMessageId = await attempt(v)
      workingPhone = v
      lastError = null
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!isRecipientNotAllowedError(msg)) throw err
      lastError = err
    }
  }
  if (lastError) throw lastError

  if (workingPhone !== sanitized) {
    await db.from('contacts').update({ phone: workingPhone }).eq('id', contact.id)
  }

  const preview = args.caption?.trim() || `[${args.kind}]`
  const { error: msgErr } = await db.from('messages').insert({
    account_id: args.accountId,
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: args.kind,
    content_text: args.caption ?? null,
    message_id: waMessageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Meta but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: preview,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  return { whatsapp_message_id: waMessageId }
}

async function sendMediaViaRyzeApi(
  db: ReturnType<typeof supabaseAdmin>,
  args: SendMediaEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', args.contactId)
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this account')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('ryzeapi_config')
    .select('*')
    .eq('account_id', args.accountId)
    .eq('status', 'connected')
    .single()
  if (configErr || !config) {
    throw new Error('RyzeAPI not configured or not connected')
  }

  const instanceToken = decrypt(config.instance_token)
  const r = await sendRyzeMedia({
    apiUrl: config.api_url,
    instanceToken,
    instance: config.instance_name,
    number: sanitized,
    mediaType: args.kind,
    mediaUrl: args.link,
    message: args.caption,
    fileName: args.filename,
  })

  const preview = args.caption?.trim() || `[${args.kind}]`
  const { error: msgErr } = await db.from('messages').insert({
    account_id: args.accountId,
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: args.kind,
    content_text: args.caption ?? null,
    message_id: r.messageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent via RyzeAPI but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: preview,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  return { whatsapp_message_id: r.messageId }
}

async function sendMediaViaInstagram(
  db: ReturnType<typeof supabaseAdmin>,
  args: SendMediaEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, instagram_id')
    .eq('id', args.contactId)
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (contactErr || !contact?.instagram_id) {
    throw new Error('contact has no instagram_id for this account')
  }

  const { data: config, error: configErr } = await db
    .from('instagram_config')
    .select('*')
    .eq('account_id', args.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('Instagram not configured for this account')
  }

  const accessToken = await getRefreshedAccessToken(config)
  const igUserId = config.instagram_business_account_id
  const igKind: 'image' | 'video' | 'audio' | 'file' =
    args.kind === 'document' ? 'file' : args.kind

  const commentId = await resolveCommentId(db, args.conversationId)

  const r = commentId
    ? await sendPrivateReply({
        igUserId,
        accessToken,
        commentId,
        text: args.caption ?? `Media: ${args.kind}`,
      })
    : await sendIgMediaMessage({
        igUserId,
        accessToken,
        to: contact.instagram_id,
        kind: igKind,
        link: args.link,
        caption: args.caption,
      })

  const preview = args.caption?.trim() || `[${args.kind}]`
  const { error: msgErr } = await db.from('messages').insert({
    account_id: args.accountId,
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: args.kind,
    content_text: args.caption ?? null,
    message_id: r.messageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Instagram but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: preview,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  return { whatsapp_message_id: r.messageId }
}

interface SendInteractiveButtonsEngineArgs {
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  bodyText: string
  buttons: InteractiveButton[]
  headerText?: string
  footerText?: string
}

interface SendInteractiveListEngineArgs {
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  bodyText: string
  buttonLabel: string
  sections: InteractiveListSection[]
  headerText?: string
  footerText?: string
}

/**
 * Send an interactive-button WhatsApp message from the Flows engine.
 *
 * Persists the outgoing message to `messages` with
 * `content_type='interactive'` and `sender_type='bot'` so the inbox
 * surfaces it with the "Button reply" affordance and the conversation
 * thread reflects the bot's prompt.
 *
 * Returns the Meta message id so the caller (engine) can stash it on
 * the `flow_runs.last_prompt_message_id` field for later reference.
 */
export async function engineSendInteractiveButtons(
  args: SendInteractiveButtonsEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  return sendInteractiveViaMeta({ ...args, kind: 'buttons' })
}

/**
 * Send an interactive-list WhatsApp message from the Flows engine.
 * Used when the flow needs more than 3 options (Meta's button cap).
 */
export async function engineSendInteractiveList(
  args: SendInteractiveListEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  return sendInteractiveViaMeta({ ...args, kind: 'list' })
}

type SendInput =
  | (SendInteractiveButtonsEngineArgs & { kind: 'buttons' })
  | (SendInteractiveListEngineArgs & { kind: 'list' })

async function sendInteractiveViaMeta(
  input: SendInput,
): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()
  const transport = await resolveTransport(db, input.conversationId)
  if (transport === 'instagram') {
    return sendInteractiveViaInstagram(db, input)
  }
  if (transport === 'ryzeapi') {
    return sendInteractiveViaRyzeApi(db, input)
  }
  return sendInteractiveViaWhatsApp(db, input)
}

async function sendInteractiveViaWhatsApp(
  db: ReturnType<typeof supabaseAdmin>,
  input: SendInput,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', input.contactId)
    .eq('account_id', input.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this account')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', input.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('WhatsApp not configured for this account')
  }

  const accessToken = decrypt(config.access_token)

  const attempt = async (phone: string): Promise<string> => {
    if (input.kind === 'buttons') {
      const r = await sendInteractiveButtons({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        bodyText: input.bodyText,
        buttons: input.buttons,
        headerText: input.headerText,
        footerText: input.footerText,
      })
      return r.messageId
    }
    const r = await sendInteractiveList({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: phone,
      bodyText: input.bodyText,
      buttonLabel: input.buttonLabel,
      sections: input.sections,
      headerText: input.headerText,
      footerText: input.footerText,
    })
    return r.messageId
  }

  const variants = phoneVariants(sanitized)
  let workingPhone = sanitized
  let waMessageId = ''
  let lastError: unknown = null
  for (const v of variants) {
    try {
      waMessageId = await attempt(v)
      workingPhone = v
      lastError = null
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!isRecipientNotAllowedError(msg)) throw err
      lastError = err
    }
  }
  if (lastError) throw lastError

  if (workingPhone !== sanitized) {
    await db.from('contacts').update({ phone: workingPhone }).eq('id', contact.id)
  }

  const { error: msgErr } = await db.from('messages').insert({
    account_id: input.accountId,
    conversation_id: input.conversationId,
    sender_type: 'bot',
    content_type: 'interactive',
    content_text: input.bodyText,
    message_id: waMessageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Meta but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: input.bodyText,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.conversationId)

  return { whatsapp_message_id: waMessageId }
}

async function sendInteractiveViaRyzeApi(
  db: ReturnType<typeof supabaseAdmin>,
  input: SendInput,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', input.contactId)
    .eq('account_id', input.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this account')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('ryzeapi_config')
    .select('*')
    .eq('account_id', input.accountId)
    .eq('status', 'connected')
    .single()
  if (configErr || !config) {
    throw new Error('RyzeAPI not configured or not connected')
  }

  const instanceToken = decrypt(config.instance_token)

  let ryzeMessageId = ''
  if (input.kind === 'buttons') {
    const r = await sendRyzeButtons({
      apiUrl: config.api_url,
      instanceToken,
      instance: config.instance_name,
      number: sanitized,
      contentText: input.bodyText,
      buttons: input.buttons.map((b) => ({ displayText: b.title, id: b.id })),
      headerText: input.headerText,
      footerText: input.footerText,
    })
    ryzeMessageId = r.messageId
  } else {
    const r = await sendRyzeList({
      apiUrl: config.api_url,
      instanceToken,
      instance: config.instance_name,
      number: sanitized,
      contentText: input.bodyText,
      buttonText: input.buttonLabel,
      sections: input.sections.map((s) => ({
        title: s.title ?? '',
        rows: s.rows.map((row) => ({ id: row.id, title: row.title, description: row.description })),
      })),
      headerText: input.headerText,
      footerText: input.footerText,
    })
    ryzeMessageId = r.messageId
  }

  const { error: msgErr } = await db.from('messages').insert({
    account_id: input.accountId,
    conversation_id: input.conversationId,
    sender_type: 'bot',
    content_type: 'interactive',
    content_text: input.bodyText,
    message_id: ryzeMessageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent via RyzeAPI but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: input.bodyText,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.conversationId)

  return { whatsapp_message_id: ryzeMessageId }
}

async function sendInteractiveViaInstagram(
  db: ReturnType<typeof supabaseAdmin>,
  input: SendInput,
): Promise<{ whatsapp_message_id: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, instagram_id')
    .eq('id', input.contactId)
    .eq('account_id', input.accountId)
    .maybeSingle()
  if (contactErr || !contact?.instagram_id) {
    throw new Error('contact has no instagram_id for this account')
  }

  const { data: config, error: configErr } = await db
    .from('instagram_config')
    .select('*')
    .eq('account_id', input.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('Instagram not configured for this account')
  }

  const accessToken = await getRefreshedAccessToken(config)
  const igUserId = config.instagram_business_account_id
  const to = contact.instagram_id

  const commentId = await resolveCommentId(db, input.conversationId)

  let igMessageId = ''

  if (commentId) {
    // Private reply — interactive buttons/list don't apply to comment
    // replies. Send the body text as a plain-text DM via the private-
    // reply API so the commenter still receives a response.
    const r = await sendPrivateReply({
      igUserId,
      accessToken,
      commentId,
      text: input.bodyText,
    })
    igMessageId = r.messageId
  } else if (input.kind === 'buttons') {
    const igButtons = input.buttons.slice(0, 3).map((b) => ({
      type: 'postback' as const,
      title: b.title,
      payload: b.id,
    }))
    const r = await sendButtonTemplate({
      igUserId,
      accessToken,
      to,
      text: input.bodyText,
      buttons: igButtons,
    })
    igMessageId = r.messageId
  } else {
    // send_list on Instagram: send body text + button template with
    // first 3 options as postback buttons; remaining options listed in
    // the header/footer text so the customer can see them.
    const allOptions = input.sections.flatMap((s) => s.rows)
    const igButtons = allOptions.slice(0, 3).map((row) => ({
      type: 'postback' as const,
      title: row.title,
      payload: row.id,
    }))
    const extra = allOptions.slice(3).map((r) => r.title).join(', ')
    const listText = extra ? `${input.bodyText}\n\n${extra}` : input.bodyText
    const r = await sendButtonTemplate({
      igUserId,
      accessToken,
      to,
      text: listText.slice(0, 640),
      buttons: igButtons,
    })
    igMessageId = r.messageId
  }

  const { error: msgErr } = await db.from('messages').insert({
    account_id: input.accountId,
    conversation_id: input.conversationId,
    sender_type: 'bot',
    content_type: 'interactive',
    content_text: input.bodyText,
    message_id: igMessageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Instagram but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: input.bodyText,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.conversationId)

  return { whatsapp_message_id: igMessageId }
}
