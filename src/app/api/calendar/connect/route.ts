import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { getAuthUrl } from '@/lib/calendar/oauth2';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { NextResponse as NextRes } from 'next/server';

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount();

    const db = supabaseAdmin();
    const { data } = await db
      .from('calendar_connections')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      return NextRes.json(
        { error: 'Google Calendar is already connected. Disconnect first to reconnect.' },
        { status: 400 }
      );
    }

    const url = getAuthUrl(accountId);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
  }
}
