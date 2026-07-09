// ============================================================
// GET /api/account/instagram-config/verify-registration
//
// Diagnostic endpoint — checks whether the Instagram Business
// Account is actually subscribed to webhook events.
//
// Checks:
//   1. account_metadata_ok     — GET /{ig-user-id} succeeds
//   2. subscribed_to_messages   — our app appears in
//         GET /{ig-user-id}/subscribed_apps with 'messages' field
//   3. locally_marked_subscribed — registered_at is set locally
//   4. verify_token_encrypted   — stored token can be decrypted
//
// Mirrors the WhatsApp pattern in
// src/app/api/whatsapp/config/verify-registration/route.ts
// ============================================================

import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { decrypt } from "@/lib/whatsapp/encryption";
import {
  verifyIgAccount,
  getSubscribedIgApps,
} from "@/lib/instagram/meta-api";

export async function GET() {
  try {
    const ctx = await requireRole("viewer");

    const { data: config, error: configError } = await ctx.supabase
      .from("instagram_config")
      .select("*")
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (configError) {
      return NextResponse.json({
        live: false,
        checks: { config_exists: false },
        errors: ["Failed to load config"],
      });
    }

    if (!config) {
      return NextResponse.json({
        live: false,
        checks: { config_exists: false },
        message: "No Instagram configuration saved yet.",
      });
    }

    const checks: Record<string, boolean | null> = {
      config_exists: true,
      token_decryptable: false,
      verify_token_encrypted: null,
      account_metadata_ok: false,
      subscribed_to_messages: null,
      locally_marked_subscribed: config.registered_at != null,
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Decrypt token.
    let accessToken: string;
    try {
      accessToken = decrypt(config.access_token);
      checks.token_decryptable = true;
    } catch {
      errors.push("Stored access token can't be decrypted — likely ENCRYPTION_KEY changed.");
      return NextResponse.json({ live: false, checks, errors });
    }

    // Check verify_token encryption status.
    if (!config.verify_token) {
      checks.verify_token_encrypted = null;
      warnings.push(
        "Verify token is empty. The Meta App Dashboard webhook configuration " +
        "needs a verify token, and it must match the one saved in wacrm settings."
      );
    } else {
      try {
        decrypt(config.verify_token);
        checks.verify_token_encrypted = true;
      } catch {
        // The row may still have a plaintext verify_token from before
        // Correction #1. It will be auto-upgraded on the next webhook
        // verification GET from Meta.
        checks.verify_token_encrypted = false;
        warnings.push(
          "Verify token is stored in plaintext (pre-encryption format). " +
          "It will be automatically upgraded when Meta sends the next " +
          "webhook verification challenge."
        );
      }
    }

    // Check 1: Account metadata is reachable.
    try {
      const info = await verifyIgAccount({
        igUserId: config.instagram_business_account_id,
        accessToken,
      });
      checks.account_metadata_ok = true;
      if (info.name) {
        warnings.push(`Connected as: ${info.name}${info.username ? ` (@${info.username})` : ''}`);
      }
    } catch (err) {
      checks.account_metadata_ok = false;
      errors.push(
        `Instagram API rejected the account ID: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }

    // Check 2: Check if subscribed to messages.
    try {
      const subs = await getSubscribedIgApps(
        config.instagram_business_account_id,
        accessToken,
      );
      const subscribedApps = subs.data ?? [];
      const hasMessages = subscribedApps.some(
        (app) =>
          app.subscribed_fields &&
          app.subscribed_fields.includes("messages"),
      );
      checks.subscribed_to_messages = hasMessages;

      if (!hasMessages && subscribedApps.length > 0) {
        errors.push(
          "App is subscribed, but the 'messages' field is missing from " +
          `subscribed fields: ${JSON.stringify(subscribedApps.map(a => a.subscribed_fields).flat())}. ` +
          "Re-save your Instagram config in Settings to re-subscribe."
        );
      } else if (!hasMessages && subscribedApps.length === 0) {
        errors.push(
          "App is not subscribed to webhooks. Re-save your Instagram config " +
          "in Settings to trigger the subscription API call. Also verify the " +
          "Meta App Dashboard has the webhook configured: " +
          "1) Go to developers.facebook.com → your app → Instagram Graph API → Webhooks, " +
          "2) Set the callback URL to your wacrm instance's /api/instagram/webhook, " +
          "3) Set the verify token to match the one saved in wacrm, " +
          "4) Subscribe to the 'messages' field on the 'Instagram' object."
        );
      }
    } catch (err) {
      checks.subscribed_to_messages = false;
      errors.push(
        `Could not check subscription status: ${err instanceof Error ? err.message : "unknown"}. ` +
        "The access token may lack the instagram_business_manage_messages permission."
      );
    }

    // Check 3: Verify the Meta App Dashboard two-step setup awareness.
    if (checks.subscribed_to_messages === true && !config.registered_at) {
      warnings.push(
        "The Instagram API shows subscribed_to_messages, but the local " +
        "registered_at timestamp is missing. Events should still arrive. " +
        "If not, verify the Meta App Dashboard webhook configuration."
      );
    }

    const live =
      checks.account_metadata_ok === true &&
      checks.subscribed_to_messages === true &&
      checks.locally_marked_subscribed === true;

    return NextResponse.json({
      live,
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      last_registration_error: config.last_registration_error || null,
      registered_at: config.registered_at || null,
      subscribed_apps_at: config.subscribed_apps_at || null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
