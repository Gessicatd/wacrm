import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function GET() {
  try {
    const ctx = await requireRole('viewer');
    const artifacts = await ctx.supabase
      .from('consulting_artifacts')
      .select(
        'id,project_id,execution_id,artifact_type,title,status,version,content,created_at,updated_at'
      )
      .eq('account_id', ctx.accountId)
      .eq('status', 'in_review')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (artifacts.error)
      return NextResponse.json(
        { error: 'Failed to load review queue' },
        { status: 500 }
      );
    if (!artifacts.data?.length) return NextResponse.json({ data: [] });

    const projectIds = [
      ...new Set(artifacts.data.map((item) => item.project_id)),
    ];
    const executionIds = [
      ...new Set(
        artifacts.data
          .map((item) => item.execution_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const artifactIds = artifacts.data.map((item) => item.id);
    const [projects, executions, reviews, events] = await Promise.all([
      ctx.supabase
        .from('consulting_projects')
        .select('id,name,objective,current_phase,status')
        .eq('account_id', ctx.accountId)
        .in('id', projectIds),
      executionIds.length
        ? ctx.supabase
            .from('consulting_executions')
            .select(
              'id,status,model_used,evidence,output,started_at,finished_at'
            )
            .eq('account_id', ctx.accountId)
            .in('id', executionIds)
        : Promise.resolve({ data: [], error: null }),
      ctx.supabase
        .from('consulting_artifact_reviews')
        .select('id,artifact_id,decision,feedback,created_at')
        .eq('account_id', ctx.accountId)
        .in('artifact_id', artifactIds)
        .order('created_at', { ascending: false }),
      executionIds.length
        ? ctx.supabase
            .from('consulting_execution_events')
            .select(
              'id,execution_id,event_type,from_status,to_status,metadata,created_at'
            )
            .eq('account_id', ctx.accountId)
            .in('execution_id', executionIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (projects.error || executions.error || reviews.error || events.error)
      return NextResponse.json(
        { error: 'Failed to load review evidence' },
        { status: 500 }
      );

    const data = artifacts.data.map((artifact) => ({
      ...artifact,
      project:
        projects.data?.find((project) => project.id === artifact.project_id) ??
        null,
      execution:
        executions.data?.find(
          (execution) => execution.id === artifact.execution_id
        ) ?? null,
      reviews:
        reviews.data?.filter((review) => review.artifact_id === artifact.id) ??
        [],
      events:
        events.data?.filter(
          (event) => event.execution_id === artifact.execution_id
        ) ?? [],
    }));
    return NextResponse.json({ data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
