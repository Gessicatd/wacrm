import { requireApiKey } from '@/lib/auth/api-context';
import { ok, toApiErrorResponse } from '@/lib/api/v1/respond';
import { disconnectCalendar } from '@/lib/calendar/store';

export async function DELETE(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'calendar:write');

    await disconnectCalendar(ctx.accountId);

    return ok({ disconnected: true });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
