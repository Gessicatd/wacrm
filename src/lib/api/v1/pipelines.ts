import type { SupabaseClient } from '@supabase/supabase-js';

export interface ApiPipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
}

export interface ApiPipeline {
  id: string;
  name: string;
  stages: ApiPipelineStage[];
  created_at: string;
}

export function serializePipeline(row: Record<string, unknown>): ApiPipeline {
  const stages = ((row.pipeline_stages as ApiPipelineStage[] | undefined) ?? [])
    .sort((a, b) => a.position - b.position);
  return {
    id: row.id as string,
    name: row.name as string,
    stages,
    created_at: row.created_at as string,
  };
}

export function serializeStage(row: Record<string, unknown>): ApiPipelineStage {
  return {
    id: row.id as string,
    name: row.name as string,
    position: row.position as number,
    color: row.color as string,
    created_at: row.created_at as string,
  };
}

const PIPELINE_SELECT = '*, pipeline_stages(*)';

export async function getPipelineById(
  db: SupabaseClient,
  accountId: string,
  pipelineId: string
): Promise<ApiPipeline | null> {
  const { data, error } = await db
    .from('pipelines')
    .select(PIPELINE_SELECT)
    .eq('id', pipelineId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return serializePipeline(data as Record<string, unknown>);
}

export async function getStageById(
  db: SupabaseClient,
  accountId: string,
  stageId: string
): Promise<ApiPipelineStage | null> {
  const { data, error } = await db
    .from('pipeline_stages')
    .select('*, pipelines!inner(account_id)')
    .eq('id', stageId)
    .eq('pipelines.account_id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return serializeStage(data as Record<string, unknown>);
}

export async function verifyPipelineAccess(
  db: SupabaseClient,
  accountId: string,
  pipelineId: string
): Promise<boolean> {
  const { data } = await db
    .from('pipelines')
    .select('id')
    .eq('id', pipelineId)
    .eq('account_id', accountId)
    .maybeSingle();
  return !!data;
}

export async function verifyStageAccess(
  db: SupabaseClient,
  accountId: string,
  stageId: string
): Promise<{ accessible: boolean; pipeline_id: string | null }> {
  const { data } = await db
    .from('pipeline_stages')
    .select('id, pipeline_id, pipelines!inner(account_id)')
    .eq('id', stageId)
    .eq('pipelines.account_id', accountId)
    .maybeSingle();
  if (!data) return { accessible: false, pipeline_id: null };
  return { accessible: true, pipeline_id: data.pipeline_id as string };
}
