import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { createOAuthState, googleAuthorizeUrl, providerEnv } from '@/lib/marketing/oauth'

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount()
    const env = providerEnv('google_ads')
    if (!env.id || !env.redirect) return NextResponse.json({ error: 'Google Ads OAuth ainda não foi configurado no servidor.' }, { status: 503 })
    return NextResponse.redirect(googleAuthorizeUrl(createOAuthState(accountId, 'google_ads'), env))
  } catch { return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')) }
}
