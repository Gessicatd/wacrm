import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { recommendPlaybooks } from '@/lib/commercial/playbooks'

export async function GET() {
  try {
    const ctx = await requireRole('admin')
    const { data } = await ctx.supabase.from('commercial_assessments').select('dimension_scores').eq('account_id', ctx.accountId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    return NextResponse.json({ playbooks: recommendPlaybooks((data?.dimension_scores ?? {}) as Record<string, number>) })
  } catch (error) { return toErrorResponse(error) }
}
