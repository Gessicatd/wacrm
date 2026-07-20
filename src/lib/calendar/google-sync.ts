import type { calendar_v3 } from 'googleapis';
import { getDecryptedAccessToken } from './store';
import { getCalendarClient } from './oauth2';

export class CalendarSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarSyncError';
  }
}

function buildStartEnd(
  startAt: string,
  endAt: string,
  isAllDay?: boolean,
  timezone?: string
): { start: calendar_v3.Schema$EventDateTime; end: calendar_v3.Schema$EventDateTime } {
  if (isAllDay) {
    return {
      start: { date: startAt.slice(0, 10) },
      end: { date: endAt.slice(0, 10) },
    };
  }
  return {
    start: { dateTime: startAt, timeZone: timezone ?? undefined },
    end: { dateTime: endAt, timeZone: timezone ?? undefined },
  };
}

export async function syncCreateEvent(
  accountId: string,
  eventData: {
    title: string;
    description?: string | null;
    location?: string | null;
    start_at: string;
    end_at: string;
    is_all_day?: boolean;
    timezone?: string | null;
    contact_id?: string | null;
    deal_id?: string | null;
    color?: string | null;
  }
): Promise<calendar_v3.Schema$Event> {
  const tokens = await getDecryptedAccessToken(accountId);
  if (!tokens) throw new CalendarSyncError('Google Calendar not connected');

  const calendar = getCalendarClient(tokens.accessToken);
  const { start, end } = buildStartEnd(
    eventData.start_at,
    eventData.end_at,
    eventData.is_all_day,
    eventData.timezone ?? undefined
  );

  const { data } = await calendar.events.insert({
    calendarId: tokens.calendarId,
    requestBody: {
      summary: eventData.title,
      description: eventData.description ?? undefined,
      location: eventData.location ?? undefined,
      start,
      end,
    },
  });

  return data;
}

export async function syncUpdateEvent(
  accountId: string,
  googleEventId: string,
  updates: {
    title?: string;
    description?: string | null;
    location?: string | null;
    start_at?: string;
    end_at?: string;
    is_all_day?: boolean;
    timezone?: string | null;
    color?: string | null;
  }
): Promise<calendar_v3.Schema$Event> {
  const tokens = await getDecryptedAccessToken(accountId);
  if (!tokens) throw new CalendarSyncError('Google Calendar not connected');

  const calendar = getCalendarClient(tokens.accessToken);

  const requestBody: calendar_v3.Schema$Event = {};

  if (updates.title !== undefined) requestBody.summary = updates.title;
  if (updates.description !== undefined) requestBody.description = updates.description ?? undefined;
  if (updates.location !== undefined) requestBody.location = updates.location ?? undefined;

  if (updates.start_at !== undefined && updates.end_at !== undefined) {
    const { start, end } = buildStartEnd(
      updates.start_at,
      updates.end_at,
      updates.is_all_day,
      updates.timezone ?? undefined
    );
    requestBody.start = start;
    requestBody.end = end;
  }

  const { data } = await calendar.events.update({
    calendarId: tokens.calendarId,
    eventId: googleEventId,
    requestBody,
  });

  return data;
}

export async function syncDeleteEvent(
  accountId: string,
  googleEventId: string
): Promise<void> {
  const tokens = await getDecryptedAccessToken(accountId);
  if (!tokens) throw new CalendarSyncError('Google Calendar not connected');

  const calendar = getCalendarClient(tokens.accessToken);

  await calendar.events.delete({
    calendarId: tokens.calendarId,
    eventId: googleEventId,
  });
}
