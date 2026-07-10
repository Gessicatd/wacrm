// ============================================================
// GET /api/v1/ryzeapi/config
//
// Returns the account's RyzeAPI configuration — `api_url`,
// `instance_name`, and a decrypted `instance_token` — so an
// external automation (n8n, etc.) can send WhatsApp messages
// directly through the RyzeAPI REST API.
//
// The admin `api_token` is NEVER returned.
//
// Auth: API key with `messages:send` scope.
// ============================================================

import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { getRyzeApiConfig } from '@/lib/api/v1/ryzeapi';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const ctx = await requireApiKey(request);

    const config = await getRyzeApiConfig(ctx.supabase, ctx.accountId);

    if (!config) {
      return fail(
        'not_found',
        'No RyzeAPI configuration found for this account',
        404,
      );
    }

    return ok(config);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
