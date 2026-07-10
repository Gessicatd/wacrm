// ============================================================
// POST /api/v1/instagram/messages
//
// Bidirectional endpoint — persists AND delivers messages.
//
//   Inbound (sender_type: "customer"):
//     Called by n8n when an Instagram DM arrives. Persists the
//     contact + conversation + message locally.
//
//   Outbound (sender_type: "agent" | "bot"):
//     Called by n8n to REPLY to an Instagram DM. Finds the
//     contact + conversation, sends the message via Instagram
//     Graph API, then persists it with the real message_id.
//
// Auth: API key with `messages:send` scope.
// ============================================================

import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/api-context";
import { resolveAuditUserId } from "@/lib/api/v1/contacts";
import { ok, fail, toApiErrorResponse } from "@/lib/api/v1/respond";
import { decrypt } from "@/lib/whatsapp/encryption";
import {
  sendTextMessage,
  sendMediaMessage,
  type MediaKind,
} from "@/lib/instagram/meta-api";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await requireApiKey(request);

    const body = (await request.json().catch(() => null)) as {
      instagram_id?: string;
      instagram_username?: string;
      name?: string;
      content_type?: string;
      text?: string;
      media_url?: string;
      instagram_message_id?: string;
      timestamp?: string;
      sender_type?: "customer" | "agent" | "bot";
    } | null;

    if (!body || !body.instagram_id || !body.content_type) {
      return fail("bad_request", "'instagram_id' and 'content_type' are required", 400);
    }

    const validTypes = ["text", "image", "video", "audio", "document"];
    if (!validTypes.includes(body.content_type)) {
      return fail("bad_request", `'content_type' must be one of: ${validTypes.join(", ")}`, 400);
    }

    // Resolve audit user for created rows.
    const auditUserId = await resolveAuditUserId(ctx.supabase, ctx.accountId);

    // Find or create contact by instagram_id within the account.
    let contactId: string;
    let contactCreated = false;

    const { data: existing } = await ctx.supabase
      .from("contacts")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("instagram_id", body.instagram_id)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
    } else {
      const { data: newContact, error: createErr } = await ctx.supabase
        .from("contacts")
        .insert({
          account_id: ctx.accountId,
          user_id: auditUserId,
          instagram_id: body.instagram_id,
          instagram_username: body.instagram_username || null,
          name: body.name || body.instagram_username || null,
          phone: null,
        })
        .select("id")
        .single();

      if (createErr || !newContact) {
        console.error("[POST /api/v1/instagram/messages] contact insert error:", createErr);
        return fail("internal", "Failed to create contact", 500);
      }
      contactId = newContact.id;
      contactCreated = true;
    }

    // Find or create conversation with channel='instagram'.
    let conversationId: string;
    let conversationCreated = false;

    const { data: existingConv } = await ctx.supabase
      .from("conversations")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("contact_id", contactId)
      .eq("channel", "instagram")
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv, error: convErr } = await ctx.supabase
        .from("conversations")
        .insert({
          account_id: ctx.accountId,
          user_id: auditUserId,
          contact_id: contactId,
          channel: "instagram",
          status: "open",
        })
        .select("id")
        .single();

      if (convErr || !newConv) {
        console.error("[POST /api/v1/instagram/messages] conversation insert error:", convErr);
        return fail("internal", "Failed to create conversation", 500);
      }
      conversationId = newConv.id;
      conversationCreated = true;
    }

    // Determine direction.
    const validSenderTypes = ["customer", "agent", "bot"] as const;
    const senderType = body.sender_type && validSenderTypes.includes(body.sender_type)
      ? body.sender_type
      : "customer";

    const isOutbound = senderType === "agent" || senderType === "bot";

    // ---- Outbound: send via Instagram Graph API --------------------------
    let instagramMessageId = body.instagram_message_id || null;

    if (isOutbound) {
      // Load Instagram config for the account.
      const { data: igConfig, error: igConfigErr } = await ctx.supabase
        .from("instagram_config")
        .select("access_token, instagram_business_account_id")
        .eq("account_id", ctx.accountId)
        .single();

      if (igConfigErr || !igConfig?.access_token || !igConfig?.instagram_business_account_id) {
        return fail(
          "instagram_not_configured",
          "Instagram integration is not configured for this account",
          400,
        );
      }

      const accessToken = decrypt(igConfig.access_token);
      const igUserId = igConfig.instagram_business_account_id;

      if (!body.text && !body.media_url) {
        return fail("bad_request", "'text' or 'media_url' is required for outbound messages", 400);
      }

      try {
        if (body.media_url && ["image", "video", "audio"].includes(body.content_type)) {
          const result = await sendMediaMessage({
            igUserId,
            accessToken,
            to: body.instagram_id,
            kind: body.content_type as MediaKind,
            link: body.media_url,
            caption: body.text || undefined,
          });
          instagramMessageId = result.messageId;
        } else {
          const result = await sendTextMessage({
            igUserId,
            accessToken,
            to: body.instagram_id,
            text: body.text || "",
          });
          instagramMessageId = result.messageId;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[POST /api/v1/instagram/messages] Instagram API send failed:", msg);
        return fail("instagram_error", `Instagram API error: ${msg}`, 502);
      }
    }

    // ---- Persist the message ---------------------------------------------
    const msgPayload: Record<string, unknown> = {
      account_id: ctx.accountId,
      conversation_id: conversationId,
      sender_type: senderType,
      content_type: body.content_type,
      content_text: body.text || null,
      media_url: body.media_url || null,
      message_id: instagramMessageId,
      status: isOutbound ? "sent" : "delivered",
    };

    if (body.timestamp) {
      msgPayload.created_at = body.timestamp;
    }

    const { data: message, error: msgErr } = await ctx.supabase
      .from("messages")
      .insert(msgPayload)
      .select("id")
      .single();

    if (msgErr) {
      console.error("[POST /api/v1/instagram/messages] message insert error:", msgErr);
      return fail("internal", "Failed to insert message", 500);
    }

    // Bump conversation metadata.
    const { data: conv } = await ctx.supabase
      .from("conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .single();

    await ctx.supabase
      .from("conversations")
      .update({
        last_message_text: body.text || `[${body.content_type}]`,
        last_message_at: body.timestamp || new Date().toISOString(),
        unread_count: isOutbound
          ? (conv?.unread_count ?? 0)
          : (conv?.unread_count ?? 0) + 1,
      })
      .eq("id", conversationId);

    return ok(
      {
        message_id: message.id,
        instagram_message_id: instagramMessageId,
        conversation_id: conversationId,
        contact_id: contactId,
        contact_created: contactCreated,
        conversation_created: conversationCreated,
      },
      201,
    );
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
