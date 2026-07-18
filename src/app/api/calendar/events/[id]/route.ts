import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { syncUpdateEvent, syncDeleteEvent } from '@/lib/calendar/google-sync';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    const db = supabaseAdmin();
    const { data: existing, error: fetchError } = await db
      .from('calendar_events')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

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

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === 'string') updates.title = body.title;
    if (typeof body.description === 'string') updates.description = body.description;
    if (typeof body.location === 'string') updates.location = body.location;
    if (typeof body.start_at === 'string') updates.start_at = body.start_at;
    if (typeof body.end_at === 'string') updates.end_at = body.end_at;
    if (typeof body.is_all_day === 'boolean') updates.is_all_day = body.is_all_day;
    if (typeof body.timezone === 'string') updates.timezone = body.timezone;
    if (typeof body.contact_id === 'string' || body.contact_id === null)
      updates.contact_id = body.contact_id;
    if (typeof body.deal_id === 'string' || body.deal_id === null)
      updates.deal_id = body.deal_id;
    if (typeof body.color === 'string') updates.color = body.color;

    // Sync to Google if event has google_event_id
    const googleEventId = existing.google_event_id as string | null;
    if (googleEventId) {
      try {
        await syncUpdateEvent(ctx.accountId, googleEventId, {
          title: typeof body.title === 'string' ? body.title : undefined,
          description: typeof body.description === 'string' ? body.description : null,
          location: typeof body.location === 'string' ? body.location : null,
          start_at: typeof body.start_at === 'string' ? body.start_at : undefined,
          end_at: typeof body.end_at === 'string' ? body.end_at : undefined,
          is_all_day: typeof body.is_all_day === 'boolean' ? body.is_all_day : undefined,
          timezone: typeof body.timezone === 'string' ? body.timezone : null,
        });
      } catch (err) {
        console.error('[api/calendar/events] PATCH sync error:', err);
        return NextResponse.json(
          { error: 'Failed to sync update with Google Calendar' },
          { status: 502 }
        );
      }
    }

    const { data: updated, error: updateError } = await db
      .from('calendar_events')
      .update(updates)
      .eq('account_id', ctx.accountId)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[api/calendar/events] PATCH error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    const db = supabaseAdmin();
    const { data: existing, error: fetchError } = await db
      .from('calendar_events')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Sync delete to Google if event has google_event_id
    const googleEventId = existing.google_event_id as string | null;
    if (googleEventId) {
      try {
        await syncDeleteEvent(ctx.accountId, googleEventId);
      } catch (err) {
        console.error('[api/calendar/events] DELETE sync error:', err);
        return NextResponse.json(
          { error: 'Failed to sync delete with Google Calendar' },
          { status: 502 }
        );
      }
    }

    const { error: deleteError } = await db
      .from('calendar_events')
      .delete()
      .eq('account_id', ctx.accountId)
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error('[api/calendar/events] DELETE error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
