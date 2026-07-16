import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

export async function GET() {
  try {
    const ctx = await requireRole('admin')
    const [{ data: profile }, { data: assessments }] = await Promise.all([
      ctx.supabase.from('commercial_profiles').select('*').eq('account_id', ctx.accountId).maybeSingle(),
      ctx.supabase.from('commercial_assessments').select('*').eq('account_id', ctx.accountId).order('created_at', { ascending: false }).limit(10),
    ])
    return NextResponse.json({ profile, assessments: assessments ?? [] })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin')
    const body = object(await request.json().catch(() => null))
    const answers = object(body.answers)
    const scores = object(body.dimension_scores)
    const overall = typeof body.overall_score === 'number' ? Math.round(body.overall_score) : null
    if (overall !== null && (overall < 0 || overall > 100)) {
      return NextResponse.json({ error: 'overall_score must be between 0 and 100' }, { status: 400 })
    }

    // The assessment stores the original answers as an audit trail.
    const { data: assessment, error: assessmentError } = await ctx.supabase
      .from('commercial_assessments')
      .insert({
        account_id: ctx.accountId,
        submitted_by: ctx.userId,
        respondent_role: typeof answers.role === 'string' ? answers.role : null,
        answers,
        dimension_scores: scores,
        overall_score: overall,
        priority: typeof answers.priority === 'string' ? answers.priority : null,
        evidence_status: object(body.evidence_status),
      })
      .select()
      .single()
    if (assessmentError) {
      console.error('[commercial/onboarding] assessment insert failed', assessmentError)
      return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 })
    }

    const profilePayload = {
      account_id: ctx.accountId,
      business_name: text(answers.businessName),
      specialty: text(answers.specialty),
      primary_offer: text(answers.mainOffer),
      monthly_capacity: integer(answers.capacity),
      target_90_days: text(answers.goal),
      automation_boundaries: Array.isArray(answers.automationBoundary) ? answers.automationBoundary : [],
      commercial_rules: {
        ticket_band: answers.ticket ?? null,
        response_time: answers.responseTime ?? null,
        sales_path: answers.salesPath ?? null,
        followup: answers.followup ?? null,
        consent: answers.consent ?? null,
      },
      onboarding_status: 'needs_evidence',
      updated_at: new Date().toISOString(),
    }
    const { data: profile, error: profileError } = await ctx.supabase
      .from('commercial_profiles')
      .upsert(profilePayload, { onConflict: 'account_id' })
      .select()
      .single()
    if (profileError) {
      console.error('[commercial/onboarding] profile upsert failed', profileError)
      return NextResponse.json({ error: 'Assessment saved, but profile generation failed' }, { status: 500 })
    }

    return NextResponse.json({ assessment, profile }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function integer(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

