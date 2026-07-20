import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('agent')
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    let query = ctx.supabase.from('marketing_events').select('event_name,source,value,currency,attribution,occurred_at').eq('account_id', ctx.accountId).order('occurred_at', { ascending: false }).limit(1000)
    if (from) query = query.gte('occurred_at', from)
    if (to) query = query.lte('occurred_at', to)
    const { data, error } = await query
    if (error) throw error
    const summary = new Map<string, { source: string; campaign: string; events: number; value: number }>()
    for (const event of data ?? []) {
      const attribution = (event.attribution ?? {}) as Record<string, string>
      const key = `${event.source}|${attribution.utm_campaign ?? attribution.campaign ?? '(sem campanha)'}`
      const row = summary.get(key) ?? { source: event.source, campaign: attribution.utm_campaign ?? attribution.campaign ?? '(sem campanha)', events: 0, value: 0 }
      row.events += 1; row.value += typeof event.value === 'number' ? event.value : 0; summary.set(key, row)
    }
    return NextResponse.json({ rows: [...summary.values()].sort((a, b) => b.events - a.events), events: data ?? [] })
  } catch (error) { return toErrorResponse(error) }
}
