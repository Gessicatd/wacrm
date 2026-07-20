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
    const textOrNull = (key: string) => typeof body[key] === 'string' ? (body[key] as string).trim() || null : null;
    const lead_intent = textOrNull('lead_intent') ?? 'unknown';
    const appointment_status = textOrNull('appointment_status') ?? 'not_scheduled';
    const forecast_category = textOrNull('forecast_category') ?? 'unclassified';
    const consent_status = textOrNull('consent_status') ?? 'unknown';
    const handoff_status = textOrNull('handoff_status') ?? 'not_started';
    if (!['unknown', 'low', 'medium', 'high'].includes(lead_intent)) return fail('bad_request', 'Invalid lead_intent', 400);
    if (!['not_scheduled', 'scheduled', 'confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled'].includes(appointment_status)) return fail('bad_request', 'Invalid appointment_status', 400);
    if (!['unclassified', 'commit', 'best_case', 'stretch'].includes(forecast_category)) return fail('bad_request', 'Invalid forecast_category', 400);
    if (!['unknown', 'granted', 'revoked', 'not_required'].includes(consent_status)) return fail('bad_request', 'Invalid consent_status', 400);
    if (!['not_started', 'pending', 'complete', 'blocked'].includes(handoff_status)) return fail('bad_request', 'Invalid handoff_status', 400);

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
      service_name: textOrNull('service_name'),
      unit_name: textOrNull('unit_name'),
      professional_name: textOrNull('professional_name'),
      source_channel: textOrNull('source_channel'),
      campaign_name: textOrNull('campaign_name'),
      lead_intent,
      appointment_at: textOrNull('appointment_at'),
      appointment_status,
      forecast_category,
      next_action: textOrNull('next_action'),
      next_action_at: textOrNull('next_action_at'),
      next_action_channel: textOrNull('next_action_channel'),
      objection_code: textOrNull('objection_code'),
      loss_reason: textOrNull('loss_reason'),
      recycle_at: textOrNull('recycle_at'),
      consent_status,
      consent_source: textOrNull('consent_source'),
      consent_recorded_at: textOrNull('consent_recorded_at'),
      handoff_status,
      handoff_notes: textOrNull('handoff_notes'),
    });

    return ok(deal, 201);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
