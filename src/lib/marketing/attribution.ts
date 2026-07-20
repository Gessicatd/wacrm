import type { SupabaseClient } from '@supabase/supabase-js'

export const ATTRIBUTION_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'landing_page', 'referrer',
] as const

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>> & {
  captured_at?: string
}

export function normalizeAttribution(value: unknown): Attribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const output: Attribution = {}
  for (const key of ATTRIBUTION_KEYS) {
    const raw = input[key]
    if (typeof raw === 'string' && raw.trim()) output[key] = raw.trim().slice(0, 500)
  }
  if (Object.keys(output).length) output.captured_at = typeof input.captured_at === 'string' ? input.captured_at : new Date().toISOString()
  return output
}

export function mergeAttribution(first: Attribution, next: Attribution): Attribution {
  return { ...first, ...next, captured_at: next.captured_at ?? first.captured_at ?? new Date().toISOString() }
}

export async function saveContactAttribution(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
  attribution: Attribution,
): Promise<void> {
  if (!Object.keys(attribution).length) return
  const { data: current, error: readError } = await db
    .from('contacts')
    .select('first_touch_attribution,last_touch_attribution')
    .eq('account_id', accountId)
    .eq('id', contactId)
    .maybeSingle()
  if (readError) throw readError
  const first = normalizeAttribution(current?.first_touch_attribution)
  const last = normalizeAttribution(current?.last_touch_attribution)
  const { error } = await db.from('contacts').update({
    first_touch_attribution: Object.keys(first).length ? first : attribution,
    last_touch_attribution: mergeAttribution(last, attribution),
    attribution_updated_at: new Date().toISOString(),
  }).eq('account_id', accountId).eq('id', contactId)
  if (error) throw error
}

