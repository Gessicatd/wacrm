import type { Deal } from '@/types'

export type DealHealthState = 'healthy' | 'due_soon' | 'overdue' | 'missing_action'

export interface DealHealth {
  state: DealHealthState
  label: string
  actionable: boolean
}

/**
 * Operational health is deliberately independent from clinical data.
 * An open opportunity is healthy only when it has a concrete future action.
 */
export function getDealHealth(deal: Deal, now = new Date()): DealHealth {
  if (deal.status && deal.status !== 'open') {
    return { state: 'healthy', label: 'Closed', actionable: false }
  }

  if (!deal.next_action?.trim() || !deal.next_action_at) {
    return { state: 'missing_action', label: 'No next action', actionable: true }
  }

  const dueAt = new Date(deal.next_action_at)
  if (Number.isNaN(dueAt.getTime())) {
    return { state: 'missing_action', label: 'Invalid next action', actionable: true }
  }
  if (dueAt < now) {
    return { state: 'overdue', label: 'Action overdue', actionable: true }
  }

  const hoursUntilDue = (dueAt.getTime() - now.getTime()) / 3_600_000
  if (hoursUntilDue <= 24) {
    return { state: 'due_soon', label: 'Due within 24h', actionable: true }
  }
  return { state: 'healthy', label: 'Next action scheduled', actionable: false }
}

export function calculateForecastTotals(deals: Deal[]) {
  return deals.reduce(
    (totals, deal) => {
      if (deal.status !== 'open') return totals
      const value = Number(deal.value || 0)
      const category = deal.forecast_category ?? 'unclassified'
      totals[category] += value
      return totals
    },
    { commit: 0, best_case: 0, stretch: 0, unclassified: 0 },
  )
}

