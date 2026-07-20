import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { encryptToken, providerEnv, readOAuthState } from '@/lib/marketing/oauth'

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
    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token')
    tokenUrl.search = new URLSearchParams({ client_id: env.id!, client_secret: env.secret!, redirect_uri: env.redirect!, code }).toString()
    const tokenResponse = await fetch(tokenUrl)
    const token = await tokenResponse.json() as { access_token?: string; expires_in?: number; error?: { message?: string } }
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error?.message ?? 'A Meta não retornou um token.')
    const db = supabaseAdmin()
    const expires = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
    const { error } = await db.from('marketing_connections').upsert({ account_id: payload.accountId, provider: 'meta', status: 'connected', access_token_encrypted: encryptToken(token.access_token), scopes: ['business_management', 'ads_read', 'ads_management'], token_expires_at: expires, connected_at: new Date().toISOString(), last_error: null }, { onConflict: 'account_id,provider,provider_account_id' })
    if (error) throw error
    return NextResponse.redirect(`${base}/settings?tab=marketing&connected=meta`)
  } catch (error) {
    console.error('[marketing/meta/callback]', error)
    return NextResponse.redirect(`${base}/settings?tab=marketing&error=meta_oauth`)
  }
}
