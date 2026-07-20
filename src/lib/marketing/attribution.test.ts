import { describe, expect, it } from 'vitest'
import { mergeAttribution, normalizeAttribution } from './attribution'

describe('marketing attribution', () => {
  it('keeps only supported, bounded attribution fields', () => {
    expect(normalizeAttribution({ utm_source: 'meta', unknown: 'drop', utm_campaign: 'x'.repeat(600) })).toMatchObject({ utm_source: 'meta' })
    expect(normalizeAttribution({ unknown: 'drop' })).toEqual({})
  })

  it('merges last-touch values without losing the captured timestamp', () => {
    expect(mergeAttribution({ utm_source: 'google' }, { utm_campaign: 'brand' })).toMatchObject({ utm_source: 'google', utm_campaign: 'brand' })
  })
})
