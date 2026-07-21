import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { encryptToken, providerEnv, providerIsConfigured, readOAuthState } from '@/lib/marketing/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin
  try {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) throw new Error('Autorização Meta incompleta.')
    const payload = readOAuthState(state)
    if (payload.provider !== 'meta') throw new Error('Provedor OAuth inválido.')
    const env = providerEnv('meta')
    if (!providerIsConfigured('meta')) throw new Error('Meta OAuth não está configurado no servidor.')
    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token')
    tokenUrl.search = new URLSearchParams({ client_id: env.id!, client_secret: env.secret!, redirect_uri: env.redirect!, code }).toString()
    const tokenResponse = await fetch(tokenUrl)
    const token = await tokenResponse.json() as { access_token?: string; expires_in?: number; error?: { message?: string } }
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error?.message ?? 'A Meta não retornou um token.')
    // Exchange the short-lived callback token for a long-lived token. If Meta
    // rejects the exchange, retain the valid callback token rather than
    // failing the connection entirely.
    let accessToken = token.access_token
    let expiresIn = token.expires_in
    const exchangeUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token')
    exchangeUrl.search = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: env.id!, client_secret: env.secret!, fb_exchange_token: accessToken }).toString()
    const exchangedResponse = await fetch(exchangeUrl)
    const exchanged = await exchangedResponse.json() as { access_token?: string; expires_in?: number }
    if (exchangedResponse.ok && exchanged.access_token) {
      accessToken = exchanged.access_token
      expiresIn = exchanged.expires_in ?? expiresIn
    }
    const profileResponse = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`)
    const profile = await profileResponse.json() as { id?: string; name?: string }
    const db = supabaseAdmin()
    const expires = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
    const { error } = await db.from('marketing_connections').upsert({ account_id: payload.accountId, provider: 'meta', status: 'connected', provider_account_id: profile.id ?? null, provider_account_name: profile.name ?? null, access_token_encrypted: encryptToken(accessToken), scopes: ['business_management', 'ads_read', 'ads_management', 'pages_show_list', 'instagram_basic'], token_expires_at: expires, connected_at: new Date().toISOString(), last_error: null }, { onConflict: 'account_id,provider,provider_account_id' })
    if (error) throw error
    return NextResponse.redirect(`${base}/settings?tab=marketing&connected=meta`)
  } catch (error) {
    console.error('[marketing/meta/callback]', error)
    return NextResponse.redirect(`${base}/settings?tab=marketing&error=meta_oauth`)
  }
}
