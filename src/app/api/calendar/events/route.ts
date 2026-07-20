import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { getDecryptedAccessToken } from '@/lib/calendar/store';
import { syncCreateEvent } from '@/lib/calendar/google-sync';
import { CalendarSyncError } from '@/lib/calendar/google-sync';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400 }
      );
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json(
        { error: "'title' is required" },
        { status: 400 }
      );
    }

    const startAt = typeof body.start_at === 'string' ? body.start_at : '';
    const endAt = typeof body.end_at === 'string' ? body.end_at : '';
    if (!startAt || !endAt) {
      return NextResponse.json(
        { error: "'start_at' and 'end_at' are required" },
        { status: 400 }
      );
    }

    const isAllDay = Boolean(body.is_all_day);
    const timezone =
      typeof body.timezone === 'string' ? body.timezone : null;
    const description =
      typeof body.description === 'string' ? body.description : null;
    const location =
      typeof body.location === 'string' ? body.location : null;
    const contactId =
      typeof body.contact_id === 'string' ? body.contact_id : null;
    const dealId =
      typeof body.deal_id === 'string' ? body.deal_id : null;
    const color =
      typeof body.color === 'string' ? body.color : null;

    // Check if Google Calendar is connected
    const tokens = await getDecryptedAccessToken(ctx.accountId);

    let googleEventId: string | null = null;
    let googleCalendarId: string | null = null;
    let conferenceLink: string | null = null;

    if (tokens) {
      try {
        const googleEvent = await syncCreateEvent(ctx.accountId, {
          title,
          description,
          location,
          start_at: startAt,
          end_at: endAt,
          is_all_day: isAllDay,
          timezone,
          contact_id: contactId,
          deal_id: dealId,
          color,
        });
        googleEventId = googleEvent.id ?? null;
        googleCalendarId = tokens.calendarId;
        conferenceLink = googleEvent.conferenceData?.entryPoints?.[0]?.uri ?? googleEvent.htmlLink ?? null;
      } catch (err) {
        if (err instanceof CalendarSyncError) {
          return NextResponse.json(
            { error: 'Google Calendar not connected' },
            { status: 400 }
          );
        }
        throw err;
      }
    }

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('calendar_events')
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        title,
        description,
        location,
        start_at: startAt,
        end_at: endAt,
        is_all_day: isAllDay,
        timezone,
        contact_id: contactId,
        deal_id: dealId,
        color,
        google_event_id: googleEventId,
        google_calendar_id: googleCalendarId,
        conference_link: conferenceLink,
        sync_status: googleEventId ? 'synced' : 'pending_create',
      })
      .select('*')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error('[api/calendar/events] POST error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
