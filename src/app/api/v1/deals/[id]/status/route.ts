import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import {
  getDealById,
} from '@/lib/api/v1/deals';

const VALID_STATUSES = ['open', 'won', 'lost'] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'deals:write');
    const { id } = await params;

    const deal = await getDealById(ctx.supabase, ctx.accountId, id);
    if (!deal) return fail('not_found', 'Deal not found', 404);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const status = typeof body.status === 'string' ? body.status : '';
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return fail('bad_request', `'status' must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    const lossReason = typeof body.loss_reason === 'string' ? body.loss_reason.trim() : '';
    if (status === 'lost' && !lossReason) {
      return fail('bad_request', "'loss_reason' is required when status is 'lost'", 400);
    }

    const { error } = await ctx.supabase
      .from('deals')
      .update({ status, loss_reason: status === 'lost' ? lossReason : null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[api/v1/deals/status] error:', error);
      return fail('internal', 'Failed to update deal status', 500);
    }

    const updated = await getDealById(ctx.supabase, ctx.accountId, id);
    return ok(updated);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
