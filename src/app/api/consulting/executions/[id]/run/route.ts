import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { runDiagnosisStrategyAgent } from '@/lib/consulting/agent-runtime';
import { runSimulatedResearch } from '@/lib/consulting/research-runtime';
import type { StrategyPlan } from '@/lib/commercial/strategy-plan';

type AgentKey = 'diagnosis-strategy-v1' | 'research-benchmark-v1';

function getAgentKey(input: unknown): AgentKey | null {
  if (!input || typeof input !== 'object') return 'diagnosis-strategy-v1';
  const key = (input as Record<string, unknown>).agent_key;
  if (key === undefined) return 'diagnosis-strategy-v1';
  return key === 'diagnosis-strategy-v1' || key === 'research-benchmark-v1'
    ? key
    : null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { id } = await params;
    const execution = await ctx.supabase
      .from('consulting_executions')
      .select('id,project_id,status,input')
      .eq('account_id', ctx.accountId)
      .eq('id', id)
      .maybeSingle();
    if (execution.error)
      return NextResponse.json(
        { error: 'Failed to load execution' },
        { status: 500 }
      );
    if (!execution.data)
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    if (execution.data.status !== 'queued')
      return NextResponse.json(
        { error: 'Only queued executions can be started' },
        { status: 409 }
      );
    const agentKey = getAgentKey(execution.data.input);
    if (!agentKey)
      return NextResponse.json({ error: 'Unsupported agent' }, { status: 400 });

    let approvedStrategy: StrategyPlan | null = null;
    if (agentKey === 'research-benchmark-v1') {
      const dependency = await ctx.supabase
        .from('consulting_artifacts')
        .select('content')
        .eq('account_id', ctx.accountId)
        .eq('project_id', execution.data.project_id)
        .eq('artifact_type', 'strategic_plan')
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (dependency.error)
        return NextResponse.json(
          { error: 'Failed to validate research dependency' },
          { status: 500 }
        );
      if (!dependency.data)
        return NextResponse.json(
          { error: 'Research requires an approved strategic plan' },
          { status: 409 }
        );
      approvedStrategy = dependency.data.content as StrategyPlan;
    }

    const started = await ctx.supabase
      .from('consulting_executions')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        error: null,
      })
      .eq('account_id', ctx.accountId)
      .eq('id', id)
      .eq('status', 'queued');
    if (started.error)
      return NextResponse.json(
        { error: 'Failed to start execution' },
        { status: 500 }
      );
    await ctx.supabase.from('consulting_execution_events').insert({
      account_id: ctx.accountId,
      execution_id: id,
      event_type: 'started',
      from_status: 'queued',
      to_status: 'running',
      metadata: {
        runtime: 'deterministic',
        agent_key: agentKey,
      },
      actor_user_id: ctx.userId,
    });

    try {
      const [profileResult, assessmentResult, sourcesResult] = await Promise.all([
        ctx.supabase
          .from('commercial_profiles')
          .select('*')
          .eq('account_id', ctx.accountId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        ctx.supabase
          .from('commercial_assessments')
          .select('*')
          .eq('account_id', ctx.accountId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        agentKey === 'research-benchmark-v1'
          ? ctx.supabase
              .from('consulting_research_sources')
              .select('id,title,excerpt,reference')
              .eq('account_id', ctx.accountId)
              .eq('project_id', execution.data.project_id)
              .eq('status', 'active')
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profileResult.error || assessmentResult.error || sourcesResult.error)
        throw new Error('Required account inputs could not be loaded');
      const result =
        agentKey === 'research-benchmark-v1'
          ? runSimulatedResearch(
              approvedStrategy as StrategyPlan,
              sourcesResult.data
            )
          : runDiagnosisStrategyAgent(
              profileResult.data as Record<string, unknown> | null,
              assessmentResult.data as Record<string, unknown> | null
            );
      const artifact = await ctx.supabase
        .from('consulting_artifacts')
        .insert({
          account_id: ctx.accountId,
          project_id: execution.data.project_id,
          execution_id: id,
          artifact_type: result.artifact_type,
          title: result.title,
          content: result.output,
          status: 'in_review',
          created_by: ctx.userId,
        })
        .select()
        .single();
      if (artifact.error) throw artifact.error;
      const waiting = await ctx.supabase
        .from('consulting_executions')
        .update({
          status: 'waiting_review',
          output: {
            artifact_id: artifact.data.id,
            schema_version:
              'schema_version' in result ? result.schema_version : '1.0',
            requires_human_review: true,
            tools: result.tools,
          },
          evidence: result.evidence,
          model_used: `deterministic:${agentKey}`,
        })
        .eq('account_id', ctx.accountId)
        .eq('id', id)
        .eq('status', 'running');
      if (waiting.error) throw waiting.error;
      await ctx.supabase.from('consulting_execution_events').insert({
        account_id: ctx.accountId,
        execution_id: id,
        event_type: 'waiting_review',
        from_status: 'running',
        to_status: 'waiting_review',
        metadata: { artifact_id: artifact.data.id, tools: result.tools },
        actor_user_id: ctx.userId,
      });
      return NextResponse.json({
        data: {
          execution_id: id,
          artifact_id: artifact.data.id,
          status: 'waiting_review',
          requires_human_review: true,
        },
      });
    } catch {
      await ctx.supabase
        .from('consulting_executions')
        .update({
          status: 'failed',
          error: 'EXECUTION_FAILED',
          finished_at: new Date().toISOString(),
        })
        .eq('account_id', ctx.accountId)
        .eq('id', id);
      await ctx.supabase.from('consulting_execution_events').insert({
        account_id: ctx.accountId,
        execution_id: id,
        event_type: 'failed',
        from_status: 'running',
        to_status: 'failed',
        metadata: { error_code: 'EXECUTION_FAILED' },
        actor_user_id: ctx.userId,
      });
      return NextResponse.json(
        { error: 'Consulting execution failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
