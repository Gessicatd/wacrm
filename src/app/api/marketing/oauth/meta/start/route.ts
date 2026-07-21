import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { createOAuthState, metaAuthorizeUrl, providerEnv, providerIsConfigured } from '@/lib/marketing/oauth'

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount()
    const env = providerEnv('meta')
    if (!providerIsConfigured('meta')) return NextResponse.json({ error: 'Meta OAuth ainda não foi configurado no servidor. Configure App ID, App Secret, callback e ENCRYPTION_KEY.' }, { status: 503 })
    return NextResponse.redirect(metaAuthorizeUrl(createOAuthState(accountId, 'meta'), env))
  } catch { return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')) }
}
