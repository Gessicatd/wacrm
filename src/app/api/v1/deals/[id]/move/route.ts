import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import {
  getDealById,
} from '@/lib/api/v1/deals';
import { verifyStageAccess } from '@/lib/api/v1/pipelines';

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

    const stage_id = typeof body.stage_id === 'string' ? body.stage_id : '';
    if (!stage_id) {
      return fail('bad_request', "'stage_id' is required", 400);
    }

    const { accessible, pipeline_id } = await verifyStageAccess(ctx.supabase, ctx.accountId, stage_id);
    if (!accessible) {
      return fail('bad_request', 'Target stage not found in your account', 400);
    }
    if (pipeline_id !== deal.pipeline_id) {
      return fail('bad_request', 'Target stage must belong to the same pipeline', 400);
    }

    if (deal.stage_id === stage_id) {
      return ok({ moved: false, message: 'Deal is already in this stage' });
    }

    const { error } = await ctx.supabase
      .from('deals')
      .update({ stage_id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[api/v1/deals/move] error:', error);
      return fail('internal', 'Failed to move deal', 500);
    }

    const updated = await getDealById(ctx.supabase, ctx.accountId, id);
    return ok({ moved: true, deal: updated });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
