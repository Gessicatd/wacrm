import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { normalizeAttribution } from '@/lib/marketing/attribution'

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent')
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const eventName = typeof body.event_name === 'string' ? body.event_name.trim().slice(0, 80) : ''
    const eventId = typeof body.event_id === 'string' ? body.event_id.trim().slice(0, 160) : ''
    const source = typeof body.source === 'string' ? body.source : 'crm'
    if (!eventName || !eventId || !['website', 'crm', 'whatsapp', 'instagram', 'meta', 'google_ads'].includes(source)) return NextResponse.json({ error: 'event_name, event_id and a valid source are required' }, { status: 400 })
    const { data, error } = await ctx.supabase.from('marketing_events').upsert({
      account_id: ctx.accountId,
      contact_id: typeof body.contact_id === 'string' ? body.contact_id : null,
      deal_id: typeof body.deal_id === 'string' ? body.deal_id : null,
      event_name: eventName,
      event_id: eventId,
      source,
      value: typeof body.value === 'number' ? body.value : null,
      currency: typeof body.currency === 'string' ? body.currency.slice(0, 3).toUpperCase() : null,
      attribution: normalizeAttribution(body.attribution),
      consent: body.consent && typeof body.consent === 'object' ? body.consent : {},
      occurred_at: typeof body.occurred_at === 'string' ? body.occurred_at : new Date().toISOString(),
    }, { onConflict: 'account_id,event_id', ignoreDuplicates: true }).select().maybeSingle()
    if (error) throw error
    return NextResponse.json({ event: data, idempotent: !data })
  } catch (error) { return toErrorResponse(error) }
}
