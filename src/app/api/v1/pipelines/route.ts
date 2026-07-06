import { requireApiKey } from '@/lib/auth/api-context';
import { ok, okList, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { serializePipeline, serializeStage } from '@/lib/api/v1/pipelines';

function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} \-_]/gu, '').trim();
}

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'pipelines:read');
    const { data, error } = await ctx.supabase
      .from('pipelines')
      .select('*, pipeline_stages(*)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[api/v1/pipelines] list error:', error);
      return fail('internal', 'Failed to list pipelines', 500);
    }

    return okList(
      (data ?? []).map((r) => serializePipeline(r as Record<string, unknown>)),
      null
    );
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'pipelines:write');

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const name = typeof body.name === 'string' ? sanitizeName(body.name) : '';
    if (!name) {
      return fail('bad_request', "'name' is required", 400);
    }

    const userId = ctx.createdBy ?? ctx.accountId;

    const { data: pipeline, error: pipeErr } = await ctx.supabase
      .from('pipelines')
      .insert({ account_id: ctx.accountId, user_id: userId, name })
      .select('id, name, created_at')
      .single();

    if (pipeErr || !pipeline) {
      console.error('[api/v1/pipelines] create error:', pipeErr);
      return fail('internal', 'Failed to create pipeline', 500);
    }

    if (Array.isArray(body.stages)) {
      const stageRows = body.stages.map((s: unknown, i: number) => {
        const stage = s as Record<string, unknown>;
        return {
          pipeline_id: pipeline.id,
          name: typeof stage.name === 'string' ? sanitizeName(stage.name) : `Stage ${i + 1}`,
          position: typeof stage.position === 'number' ? stage.position : i,
          color: typeof stage.color === 'string' ? stage.color : '#3b82f6',
        };
      });

      if (stageRows.length > 0) {
        const { data: stages, error: stageErr } = await ctx.supabase
          .from('pipeline_stages')
          .insert(stageRows)
          .select('*');

        if (stageErr) {
          console.error('[api/v1/pipelines] create stages error:', stageErr);
          return fail('internal', 'Failed to create stages', 500);
        }

        return ok({
          ...pipeline,
          stages: (stages ?? []).map((r) => serializeStage(r as Record<string, unknown>)),
        }, 201);
      }
    }

    return ok({ ...pipeline, stages: [] }, 201);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
