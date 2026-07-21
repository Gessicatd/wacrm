import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { validateResearchSource } from '@/lib/consulting/research-source-validation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('viewer');
    const { id } = await params;
    const result = await ctx.supabase
      .from('consulting_research_sources')
      .select('id,title,source_type,reference,excerpt,status,created_at')
      .eq('account_id', ctx.accountId)
      .eq('project_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (result.error)
      return NextResponse.json({ error: 'Failed to list research sources' }, { status: 500 });
    return NextResponse.json({ data: result.data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { id } = await params;
    const input = validateResearchSource(await request.json().catch(() => null));
    const project = await ctx.supabase
      .from('consulting_projects')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!project.data)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const result = await ctx.supabase
      .from('consulting_research_sources')
      .insert({
        account_id: ctx.accountId,
        project_id: id,
        title: input.title,
        excerpt: input.excerpt,
        source_type: input.sourceType,
        reference: input.reference,
        created_by: ctx.userId,
      })
      .select('id,title,source_type,reference,excerpt,status,created_at')
      .single();
    if (result.error)
      return NextResponse.json({ error: 'Failed to save research source' }, { status: 500 });
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /required|maximum|http/.test(error.message))
      return NextResponse.json({ error: error.message }, { status: 400 });
    return toErrorResponse(error);
  }
}
