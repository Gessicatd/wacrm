import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

const text = (value: unknown, max = 200) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

export async function GET() {
  try {
    const ctx = await requireRole('admin')
    const { data, error } = await ctx.supabase.from('marketing_settings').select('*').eq('account_id', ctx.accountId).maybeSingle()
    if (error) throw error
    const { data: connections } = await ctx.supabase.from('marketing_connections').select('id,provider,status,provider_account_id,provider_account_name,scopes,token_expires_at,connected_at,last_error').eq('account_id', ctx.accountId).order('provider')
    return NextResponse.json({ settings: data, connections: connections ?? [] })
  } catch (error) { return toErrorResponse(error) }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireRole('admin')
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const consent = text(body.consent_mode) ?? 'ask'
    if (!['ask', 'denied_by_default', 'granted_by_default'].includes(consent)) return NextResponse.json({ error: 'Invalid consent_mode' }, { status: 400 })
    const { data, error } = await ctx.supabase.from('marketing_settings').upsert({
      account_id: ctx.accountId,
      gtm_container_id: text(body.gtm_container_id),
      meta_pixel_id: text(body.meta_pixel_id),
      meta_dataset_id: text(body.meta_dataset_id),
      google_tag_id: text(body.google_tag_id),
      google_ads_customer_id: text(body.google_ads_customer_id),
      consent_mode: consent,
      enabled: body.enabled === true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id' }).select().single()
    if (error) throw error
    return NextResponse.json({ settings: data })
  } catch (error) { return toErrorResponse(error) }
}
