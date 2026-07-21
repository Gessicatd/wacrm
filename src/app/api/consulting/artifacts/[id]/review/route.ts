import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const decision = body?.decision;
    const feedback =
      typeof body?.feedback === 'string'
        ? body.feedback.trim().slice(0, 5000)
        : '';
    if (decision !== 'approved' && decision !== 'changes_requested')
      return NextResponse.json(
        { error: 'decision must be approved or changes_requested' },
        { status: 400 }
      );
    if (decision === 'changes_requested' && !feedback)
      return NextResponse.json(
        { error: 'feedback is required when requesting changes' },
        { status: 400 }
      );

    const artifact = await ctx.supabase
      .from('consulting_artifacts')
      .select('id,project_id,execution_id,status')
      .eq('account_id', ctx.accountId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (artifact.error)
      return NextResponse.json(
        { error: 'Failed to load artifact' },
        { status: 500 }
      );
    if (!artifact.data)
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    if (artifact.data.status !== 'in_review')
      return NextResponse.json(
        { error: 'Only artifacts in review can receive a decision' },
        { status: 409 }
      );

    const review = await ctx.supabase
      .from('consulting_artifact_reviews')
      .insert({
        account_id: ctx.accountId,
        project_id: artifact.data.project_id,
        artifact_id: id,
        execution_id: artifact.data.execution_id,
        decision,
        feedback: feedback || null,
        reviewed_by: ctx.userId,
      });
    if (review.error)
      return NextResponse.json(
        { error: 'Failed to record review' },
        { status: 500 }
      );

    if (decision === 'approved') {
      const approvedAt = new Date().toISOString();
      const approved = await ctx.supabase
        .from('consulting_artifacts')
        .update({
          status: 'approved',
          approved_by: ctx.userId,
          approved_at: approvedAt,
          updated_at: approvedAt,
        })
        .eq('account_id', ctx.accountId)
        .eq('id', id)
        .eq('status', 'in_review');
      if (approved.error)
        return NextResponse.json(
          { error: 'Failed to approve artifact' },
          { status: 500 }
        );
      if (artifact.data.execution_id) {
        const completed = await ctx.supabase
          .from('consulting_executions')
          .update({ status: 'completed', finished_at: approvedAt })
          .eq('account_id', ctx.accountId)
          .eq('id', artifact.data.execution_id)
          .eq('status', 'waiting_review');
        if (completed.error)
          return NextResponse.json(
            { error: 'Failed to complete execution' },
            { status: 500 }
          );
        await ctx.supabase
          .from('consulting_execution_events')
          .insert({
            account_id: ctx.accountId,
            execution_id: artifact.data.execution_id,
            event_type: 'approved',
            from_status: 'waiting_review',
            to_status: 'completed',
            metadata: { artifact_id: id },
            actor_user_id: ctx.userId,
          });
      }
    } else if (artifact.data.execution_id) {
      await ctx.supabase
        .from('consulting_execution_events')
        .insert({
          account_id: ctx.accountId,
          execution_id: artifact.data.execution_id,
          event_type: 'changes_requested',
          from_status: 'waiting_review',
          to_status: 'waiting_review',
          metadata: { artifact_id: id, feedback_recorded: true },
          actor_user_id: ctx.userId,
        });
    }

    return NextResponse.json({
      data: {
        artifact_id: id,
        decision,
        status: decision === 'approved' ? 'approved' : 'in_review',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
