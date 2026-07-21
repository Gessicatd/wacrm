import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { encryptToken, providerEnv, providerIsConfigured, readOAuthState } from '@/lib/marketing/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin
  try {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) throw new Error('Autorização Google incompleta.')
    const payload = readOAuthState(state)
    if (payload.provider !== 'google_ads') throw new Error('Provedor OAuth inválido.')
    const env = providerEnv('google_ads')
    if (!providerIsConfigured('google_ads')) throw new Error('Google Ads OAuth não está configurado no servidor.')
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.id!, client_secret: env.secret!, redirect_uri: env.redirect!, grant_type: 'authorization_code' }) })
    const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }
    if (!response.ok || !token.access_token) throw new Error(token.error ?? 'O Google não retornou um token.')
    const db = supabaseAdmin()
    const expires = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '') || null
    const { error } = await db.from('marketing_connections').upsert({ account_id: payload.accountId, provider: 'google_ads', status: 'connected', provider_account_id: customerId, access_token_encrypted: encryptToken(token.access_token), refresh_token_encrypted: token.refresh_token ? encryptToken(token.refresh_token) : null, scopes: ['https://www.googleapis.com/auth/adwords'], token_expires_at: expires, connected_at: new Date().toISOString(), last_error: null }, { onConflict: 'account_id,provider,provider_account_id' })
    if (error) throw error
    return NextResponse.redirect(`${base}/settings?tab=marketing&connected=google`)
  } catch (error) {
    console.error('[marketing/google/callback]', error)
    return NextResponse.redirect(`${base}/settings?tab=marketing&error=google_oauth`)
  }
}
