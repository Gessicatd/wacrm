import { describe, expect, it } from 'vitest'
import type { Deal } from '@/types'
import { calculateForecastTotals, getDealHealth } from './deal-health'

const base: Deal = {
  id: 'd1', user_id: 'u1', pipeline_id: 'p1', stage_id: 's1', contact_id: 'c1',
  title: 'Treatment plan', value: 10000, status: 'open', created_at: '2026-07-01T00:00:00Z',
}

describe('getDealHealth', () => {
  const now = new Date('2026-07-15T12:00:00Z')

  it('requires a concrete next action for open deals', () => {
    expect(getDealHealth(base, now).state).toBe('missing_action')
  })

  it('marks past actions as overdue', () => {
    expect(getDealHealth({ ...base, next_action: 'Call decision maker', next_action_at: '2026-07-15T10:00:00Z' }, now).state).toBe('overdue')
  })

  it('marks actions within 24 hours as due soon', () => {
    expect(getDealHealth({ ...base, next_action: 'Confirm evaluation', next_action_at: '2026-07-16T10:00:00Z' }, now).state).toBe('due_soon')
  })
})

describe('calculateForecastTotals', () => {
  it('groups only open revenue by evidence category', () => {
    const result = calculateForecastTotals([
      { ...base, value: 10000, forecast_category: 'commit' },
      { ...base, id: 'd2', value: 5000, forecast_category: 'best_case' },
      { ...base, id: 'd3', value: 9000, forecast_category: 'stretch', status: 'won' },
    ])
    expect(result).toEqual({ commit: 10000, best_case: 5000, stretch: 0, unclassified: 0 })
  })
})

