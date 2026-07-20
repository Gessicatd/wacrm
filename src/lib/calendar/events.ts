import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { CalendarEvent } from '@/types';

const EVENT_SELECT = `
  id,
  account_id,
  google_event_id,
  google_calendar_id,
  title,
  description,
  location,
  start_at,
  end_at,
  is_all_day,
  timezone,
  status,
  contact_id,
  deal_id,
  conference_link,
  attendees_json,
  recurrence_rule,
  color,
  sync_status,
  last_synced_at,
  created_by,
  created_at,
  updated_at
`;

export function serializeEvent(
  row: Record<string, unknown>
): CalendarEvent {
  const attendees =
    typeof row.attendees_json === 'string'
      ? JSON.parse(row.attendees_json)
      : Array.isArray(row.attendees_json)
        ? row.attendees_json
        : [];

  return {
    id: row.id as string,
    account_id: row.account_id as string,
    google_event_id: (row.google_event_id as string) ?? null,
    google_calendar_id: (row.google_calendar_id as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? null,
    location: (row.location as string) ?? null,
    start_at: row.start_at as string,
    end_at: row.end_at as string,
    is_all_day: Boolean(row.is_all_day),
    timezone: (row.timezone as string) ?? null,
    status: (row.status as CalendarEvent['status']) ?? 'scheduled',
    contact_id: (row.contact_id as string) ?? null,
    deal_id: (row.deal_id as string) ?? null,
    conference_link: (row.conference_link as string) ?? null,
    attendees_json: attendees,
    recurrence_rule: (row.recurrence_rule as string) ?? null,
    color: (row.color as string) ?? null,
    sync_status: (row.sync_status as CalendarEvent['sync_status']) ?? 'synced',
    last_synced_at: (row.last_synced_at as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getEventById(
  accountId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('calendar_events')
    .select(EVENT_SELECT)
    .eq('account_id', accountId)
    .eq('id', eventId)
    .maybeSingle();

  if (error || !data) return null;
  return serializeEvent(data);
}

export async function listEvents(
  accountId: string,
  opts: {
    startDate?: string;
    endDate?: string;
    contactId?: string;
    dealId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<CalendarEvent[]> {
  const db = supabaseAdmin();
  const limit = opts.limit ?? 50;

  let query = db
    .from('calendar_events')
    .select(EVENT_SELECT)
    .eq('account_id', accountId)
    .order('start_at', { ascending: true })
    .limit(limit);

  if (opts.startDate) {
    query = query.gte('end_at', opts.startDate);
  }
  if (opts.endDate) {
    query = query.lte('start_at', opts.endDate);
  }
  if (opts.contactId) {
    query = query.eq('contact_id', opts.contactId);
  }
  if (opts.dealId) {
    query = query.eq('deal_id', opts.dealId);
  }
  if (opts.status) {
    query = query.eq('status', opts.status);
  }
  if (opts.offset) {
    query = query.range(opts.offset, opts.offset + limit - 1);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((r) => serializeEvent(r));
}

export async function createEvent(
  accountId: string,
  createdBy: string,
  event: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
    is_all_day?: boolean;
    timezone?: string;
    contact_id?: string;
    deal_id?: string;
    attendees?: { email: string; name?: string }[];
    recurrence_rule?: string;
    color?: string;
  }
): Promise<CalendarEvent> {
  const db = supabaseAdmin();

  const row = {
    account_id: accountId,
    created_by: createdBy,
    title: event.title,
    description: event.description ?? null,
    location: event.location ?? null,
    start_at: event.start_at,
    end_at: event.end_at,
    is_all_day: event.is_all_day ?? false,
    timezone: event.timezone ?? null,
    contact_id: event.contact_id ?? null,
    deal_id: event.deal_id ?? null,
    attendees_json: event.attendees ?? [],
    recurrence_rule: event.recurrence_rule ?? null,
    color: event.color ?? null,
    sync_status: 'pending_create' as const,
  };

  const { data, error } = await db
    .from('calendar_events')
    .insert(row)
    .select(EVENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create event: ${error?.message ?? 'unknown'}`);
  }

  return serializeEvent(data);
}

export async function updateEvent(
  accountId: string,
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    location: string;
    start_at: string;
    end_at: string;
    is_all_day: boolean;
    timezone: string;
    status: string;
    contact_id: string | null;
    deal_id: string | null;
    attendees: { email: string; name?: string }[];
    recurrence_rule: string;
    color: string;
    sync_status: CalendarEvent['sync_status'];
    google_event_id: string;
    google_calendar_id: string;
    conference_link: string;
    last_synced_at: string;
  }>
): Promise<CalendarEvent | null> {
  const db = supabaseAdmin();

  const existing = await getEventById(accountId, eventId);
  if (!existing) return null;

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.start_at !== undefined) payload.start_at = updates.start_at;
  if (updates.end_at !== undefined) payload.end_at = updates.end_at;
  if (updates.is_all_day !== undefined) payload.is_all_day = updates.is_all_day;
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.contact_id !== undefined) payload.contact_id = updates.contact_id;
  if (updates.deal_id !== undefined) payload.deal_id = updates.deal_id;
  if (updates.attendees !== undefined) payload.attendees_json = updates.attendees;
  if (updates.recurrence_rule !== undefined) payload.recurrence_rule = updates.recurrence_rule;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.sync_status !== undefined) payload.sync_status = updates.sync_status;
  if (updates.google_event_id !== undefined) payload.google_event_id = updates.google_event_id;
  if (updates.google_calendar_id !== undefined) payload.google_calendar_id = updates.google_calendar_id;
  if (updates.conference_link !== undefined) payload.conference_link = updates.conference_link;
  if (updates.last_synced_at !== undefined) payload.last_synced_at = updates.last_synced_at;

  // If a non-sync field was changed and sync_status isn't explicitly set,
  // mark as pending_update — n8n will push to Google Calendar.
  const hasContentChange =
    updates.title !== undefined ||
    updates.description !== undefined ||
    updates.location !== undefined ||
    updates.start_at !== undefined ||
    updates.end_at !== undefined ||
    updates.is_all_day !== undefined ||
    updates.status !== undefined ||
    updates.attendees !== undefined ||
    updates.recurrence_rule !== undefined ||
    updates.color !== undefined;

  if (hasContentChange && updates.sync_status === undefined && existing.google_event_id) {
    payload.sync_status = 'pending_update';
  }

  const { data, error } = await db
    .from('calendar_events')
    .update(payload)
    .eq('account_id', accountId)
    .eq('id', eventId)
    .select(EVENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to update event: ${error?.message ?? 'unknown'}`);
  }

  return serializeEvent(data);
}

export async function deleteEvent(
  accountId: string,
  eventId: string
): Promise<boolean> {
  const db = supabaseAdmin();

  const existing = await getEventById(accountId, eventId);
  if (!existing) return false;

  // If synced to Google, soft-delete — set pending_delete sync_status
  // for n8n to pick up. Otherwise, hard-delete.
  if (existing.google_event_id) {
    await db
      .from('calendar_events')
      .update({
        sync_status: 'pending_delete',
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)
      .eq('id', eventId);
  } else {
    await db
      .from('calendar_events')
      .delete()
      .eq('account_id', accountId)
      .eq('id', eventId);
  }

  return true;
}
