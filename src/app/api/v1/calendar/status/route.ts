import { requireApiKey } from '@/lib/auth/api-context';
import { ok, toApiErrorResponse } from '@/lib/api/v1/respond';
import { getConnection, serializeConnection } from '@/lib/calendar/store';

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'calendar:read');

    const conn = await getConnection(ctx.accountId);

    return ok(
      conn ? serializeConnection(conn) : { connected: false }
    );
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
