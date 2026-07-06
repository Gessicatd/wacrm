import { requireApiKey } from '@/lib/auth/api-context';
import { ok, okList, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import {
  parseListParams,
  keysetFilter,
  buildPage,
} from '@/lib/api/v1/pagination';
import {
  serializeDeal,
  createDeal,
} from '@/lib/api/v1/deals';
import { resolveAuditUserId } from '@/lib/api/v1/contacts';
import { verifyPipelineAccess, verifyStageAccess } from '@/lib/api/v1/pipelines';

const DEAL_SELECT = `
  *,
  contact:contact_id(id, phone, name, avatar_url),
  stage:stage_id!inner(id, name, color),
  assignee:assigned_to(id, full_name, email, avatar_url)
`;

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'deals:read');
    const { limit, cursor } = parseListParams(request);
    const url = new URL(request.url);
    const pipelineId = url.searchParams.get('pipeline_id');
    const stageId = url.searchParams.get('stage_id');
    const status = url.searchParams.get('status');
    const contactId = url.searchParams.get('contact_id');
    const assignedTo = url.searchParams.get('assigned_to');

    let query = ctx.supabase
      .from('deals')
      .select(DEAL_SELECT)
      .eq('account_id', ctx.accountId);

    if (pipelineId) query = query.eq('pipeline_id', pipelineId);
    if (stageId) query = query.eq('stage_id', stageId);
    if (status) query = query.eq('status', status);
    if (contactId) query = query.eq('contact_id', contactId);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);

    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    const kf = keysetFilter(cursor);
    if (kf) query = query.or(kf);

    const { data, error } = await query;
    if (error) {
      console.error('[api/v1/deals] list error:', error);
      return fail('internal', 'Failed to list deals', 500);
    }

    const { items, nextCursor } = buildPage(
      (data ?? []) as unknown as Array<{ created_at: string; id: string }>,
      limit
    );
    return okList(
      items.map((r) => serializeDeal(r as Record<string, unknown>)),
      nextCursor
    );
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'deals:write');

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const pipeline_id = typeof body.pipeline_id === 'string' ? body.pipeline_id : '';
    const stage_id = typeof body.stage_id === 'string' ? body.stage_id : '';
    const contact_id = typeof body.contact_id === 'string' ? body.contact_id : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!pipeline_id) return fail('bad_request', "'pipeline_id' is required", 400);
    if (!stage_id) return fail('bad_request', "'stage_id' is required", 400);
    if (!contact_id) return fail('bad_request', "'contact_id' is required", 400);
    if (!title) return fail('bad_request', "'title' is required", 400);

    const pipelineOk = await verifyPipelineAccess(ctx.supabase, ctx.accountId, pipeline_id);
    if (!pipelineOk) return fail('bad_request', 'Pipeline not found in your account', 400);

    const { accessible: stageOk, pipeline_id: stagePipelineId } =
      await verifyStageAccess(ctx.supabase, ctx.accountId, stage_id);
    if (!stageOk) return fail('bad_request', 'Stage not found in your account', 400);
    if (stagePipelineId !== pipeline_id) {
      return fail('bad_request', 'Stage does not belong to the specified pipeline', 400);
    }

    const { data: contact } = await ctx.supabase
      .from('contacts')
      .select('id')
      .eq('id', contact_id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!contact) return fail('bad_request', 'Contact not found in your account', 400);

    const value = typeof body.value === 'number' ? body.value : 0;
    const currency = typeof body.currency === 'string' ? body.currency : undefined;
    const notes = typeof body.notes === 'string' ? body.notes : null;
    const expected_close_date = typeof body.expected_close_date === 'string' ? body.expected_close_date : null;
    const assigned_to = typeof body.assigned_to === 'string' ? body.assigned_to : null;
    const conversation_id = typeof body.conversation_id === 'string' ? body.conversation_id : null;

    const auditUserId = await resolveAuditUserId(ctx.supabase, ctx.accountId);

    const deal = await createDeal(ctx.supabase, ctx.accountId, auditUserId, {
      pipeline_id,
      stage_id,
      contact_id,
      title,
      value,
      currency,
      notes,
      expected_close_date,
      assigned_to,
      conversation_id,
    });

    return ok(deal, 201);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
