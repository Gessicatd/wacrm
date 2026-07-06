import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import {
  getPipelineById,
  serializeStage,
} from '@/lib/api/v1/pipelines';

function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} \-_]/gu, '').trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'pipelines:write');
    const { id: pipelineId } = await params;

    const pipeline = await getPipelineById(ctx.supabase, ctx.accountId, pipelineId);
    if (!pipeline) return fail('not_found', 'Pipeline not found', 404);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const name = typeof body.name === 'string' ? sanitizeName(body.name) : '';
    if (!name) {
      return fail('bad_request', "'name' is required", 400);
    }

    const nextPosition = pipeline.stages.length > 0
      ? Math.max(...pipeline.stages.map((s) => s.position)) + 1
      : 0;

    const { data: stage, error } = await ctx.supabase
      .from('pipeline_stages')
      .insert({
        pipeline_id: pipelineId,
        name,
        position: typeof body.position === 'number' ? body.position : nextPosition,
        color: typeof body.color === 'string' ? body.color : '#3b82f6',
      })
      .select('*')
      .single();

    if (error || !stage) {
      console.error('[api/v1/pipelines/stages] create error:', error);
      return fail('internal', 'Failed to create stage', 500);
    }

    return ok(serializeStage(stage as Record<string, unknown>), 201);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
