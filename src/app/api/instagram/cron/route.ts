import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { refreshExpiringTokens } from '@/lib/instagram/token-refresh'

/**
 * Sweep connected Instagram configs with tokens near expiry (< 7 days)
 * and attempt to refresh each one via Meta's /oauth/access_token.
 *
 * Auth: re-uses AUTOMATION_CRON_SECRET (same pattern as
 * /api/automations/cron and /api/flows/cron).
 *
 * Hosting: hit on a schedule — once daily is sufficient. A 60-day
 * token with a 7-day refresh window has plenty of room.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }

  const supplied = request.headers.get('x-cron-secret') ?? ''
  const suppliedBuf = Buffer.from(supplied)
  const expectedBuf = Buffer.from(expected)
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await refreshExpiringTokens()

  return NextResponse.json(result)
}
