import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import {
  getEventById,
  updateEvent,
  deleteEvent,
} from '@/lib/calendar/events';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'calendar:read');
    const { id } = await params;

    const event = await getEventById(ctx.accountId, id);
    if (!event) {
      return fail('not_found', 'Event not found', 404);
    }

    return ok(event);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'calendar:write');
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const updates: Parameters<typeof updateEvent>[2] = {};

    if (typeof body.title === 'string') updates.title = body.title;
    if (typeof body.description === 'string')
      updates.description = body.description;
    if (typeof body.location === 'string') updates.location = body.location;
    if (typeof body.start_at === 'string') updates.start_at = body.start_at;
    if (typeof body.end_at === 'string') updates.end_at = body.end_at;
    if (typeof body.is_all_day === 'boolean')
      updates.is_all_day = body.is_all_day;
    if (typeof body.timezone === 'string') updates.timezone = body.timezone;
    if (typeof body.status === 'string')
      updates.status = body.status;
    if (typeof body.contact_id === 'string' || body.contact_id === null)
      updates.contact_id = body.contact_id as string | null;
    if (typeof body.deal_id === 'string' || body.deal_id === null)
      updates.deal_id = body.deal_id as string | null;
    if (Array.isArray(body.attendees))
      updates.attendees = body.attendees as Array<{
        email: string;
        name?: string;
      }>;
    if (typeof body.recurrence_rule === 'string')
      updates.recurrence_rule = body.recurrence_rule;
    if (typeof body.color === 'string') updates.color = body.color;

    const event = await updateEvent(ctx.accountId, id, updates);
    if (!event) {
      return fail('not_found', 'Event not found', 404);
    }

    return ok(event);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'calendar:write');
    const { id } = await params;

    const deleted = await deleteEvent(ctx.accountId, id);
    if (!deleted) {
      return fail('not_found', 'Event not found', 404);
    }

    return ok({ deleted: true });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
