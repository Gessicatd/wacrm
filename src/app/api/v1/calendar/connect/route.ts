import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/auth/api-context';
import { fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { getAuthUrl } from '@/lib/calendar/oauth2';
import { getConnection } from '@/lib/calendar/store';

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request);

    const existing = await getConnection(ctx.accountId);
    if (existing?.is_active) {
      return fail(
        'bad_request',
        'Google Calendar is already connected. Disconnect first to reconnect.',
        400
      );
    }

    const url = getAuthUrl(ctx.accountId);
    return NextResponse.redirect(url);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
