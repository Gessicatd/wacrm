"use client"

import { useEffect } from 'react'
import { ATTRIBUTION_KEYS, type Attribution } from '@/lib/marketing/attribution'

const STORAGE_KEY = 'wacrm-attribution'

export function getStoredAttribution(): Attribution {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Attribution } catch { return {} }
}

export default function MarketingAttributionCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next: Attribution = {}
    for (const key of ATTRIBUTION_KEYS) {
      const value = params.get(key)
      if (value) next[key] = value.slice(0, 500)
    }
    if (!Object.keys(next).length) return
    try {
      const previous = getStoredAttribution()
      const first = Object.keys(previous).length ? previous : { ...next, captured_at: new Date().toISOString() }
      const latest = { ...previous, ...next, captured_at: new Date().toISOString() }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...latest, first_touch: first }))
    } catch { /* storage may be disabled */ }
  }, [])
  return null
}
