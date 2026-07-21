import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { decryptToken, encryptToken, providerEnv } from '@/lib/marketing/oauth'

type Campaign = { id: string; name: string; status?: string; objective?: string; accountId?: string; raw?: Record<string, unknown> }

async function resolveGoogleToken(connection: Record<string, unknown>, db: ReturnType<typeof supabaseAdmin>) {
  const encrypted = typeof connection.access_token_encrypted === 'string' ? connection.access_token_encrypted : null
  const refreshEncrypted = typeof connection.refresh_token_encrypted === 'string' ? connection.refresh_token_encrypted : null
  const expiresAt = typeof connection.token_expires_at === 'string' ? Date.parse(connection.token_expires_at) : 0
  if (!encrypted) throw new Error('Google Ads não possui token salvo.')
  if (expiresAt > Date.now() + 60_000 || !refreshEncrypted) return decryptToken(encrypted)
  const env = providerEnv('google_ads')
  if (!env.id || !env.secret) throw new Error('Credenciais OAuth do Google Ads incompletas para renovar o token.')
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.id, client_secret: env.secret, refresh_token: decryptToken(refreshEncrypted), grant_type: 'refresh_token' }) })
  const body = await response.json() as { access_token?: string; expires_in?: number; error?: string }
  if (!response.ok || !body.access_token) throw new Error(body.error ?? 'Não foi possível renovar o token do Google Ads.')
  await db.from('marketing_connections').update({ access_token_encrypted: encryptToken(body.access_token), token_expires_at: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null, last_error: null }).eq('id', connection.id)
  return body.access_token
}

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount()
    const { data, error } = await supabaseAdmin().from('marketing_campaigns').select('id,provider,provider_campaign_id,provider_account_id,name,status,objective,spend,impressions,clicks,conversions,last_synced_at').eq('account_id', accountId).order('last_synced_at', { ascending: false }).limit(500)
    if (error) throw error
    return NextResponse.json({ campaigns: data ?? [] })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível consultar campanhas.' }, { status: 500 }) }
}

export async function POST() {
  try {
    const { accountId } = await getCurrentAccount()
    const db = supabaseAdmin()
    const { data: connections, error } = await db.from('marketing_connections').select('*').eq('account_id', accountId).eq('status', 'connected')
    if (error) throw error
    const campaigns: Array<Campaign & { provider: 'meta' | 'google_ads' }> = []
    const errors: Array<{ provider: string; message: string }> = []
    for (const connection of connections ?? []) {
      if (!connection.access_token_encrypted) continue
      try {
      const accessToken = connection.provider === 'google_ads'
        ? await resolveGoogleToken(connection as Record<string, unknown>, db)
        : decryptToken(connection.access_token_encrypted)
      if (connection.provider === 'meta') {
        const accountsResponse = await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name&limit=100&access_token=${encodeURIComponent(accessToken)}`)
        const accounts = await accountsResponse.json() as { data?: Array<{ id: string; name?: string }> }
        if (!accountsResponse.ok) throw new Error((accounts as { error?: { message?: string } }).error?.message ?? 'A Meta recusou a consulta de contas.')
        for (const adAccount of accounts.data ?? []) {
          const result = await fetch(`https://graph.facebook.com/v20.0/${adAccount.id}/campaigns?fields=id,name,status,objective&limit=500&access_token=${encodeURIComponent(accessToken)}`)
          const body = await result.json() as { data?: Array<{ id: string; name: string; status?: string; objective?: string }> }
          for (const campaign of body.data ?? []) campaigns.push({ provider: 'meta', id: campaign.id, name: campaign.name, status: campaign.status, objective: campaign.objective, accountId: adAccount.id, raw: campaign })
        }
      }
      if (connection.provider === 'google_ads' && connection.provider_account_id && process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
        const customer = connection.provider_account_id.replace(/-/g, '')
        const result = await fetch(`https://googleads.googleapis.com/v20/customers/${customer}/googleAds:searchStream`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign ORDER BY campaign.id' }) })
        const body = await result.json() as Array<{ results?: Array<{ campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string } }> }>
        if (!result.ok) throw new Error((body as unknown as { error?: { message?: string } }).error?.message ?? 'O Google Ads recusou a consulta.')
        for (const batch of body ?? []) for (const row of batch.results ?? []) if (row.campaign?.id && row.campaign.name) campaigns.push({ provider: 'google_ads', id: row.campaign.id, name: row.campaign.name, status: row.campaign.status, objective: row.campaign.advertisingChannelType, accountId: customer, raw: row })
      }
      await db.from('marketing_connections').update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id', connection.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao sincronizar campanha.'
        errors.push({ provider: connection.provider, message })
        await db.from('marketing_connections').update({ status: 'error', last_error: message }).eq('id', connection.id)
      }
    }
    for (const campaign of campaigns) await db.from('marketing_campaigns').upsert({ account_id: accountId, connection_id: (connections ?? []).find((item) => item.provider === campaign.provider)?.id, provider: campaign.provider, provider_campaign_id: campaign.id, provider_account_id: campaign.accountId ?? null, name: campaign.name, status: campaign.status ?? null, objective: campaign.objective ?? null, raw_data: campaign.raw ?? {}, last_synced_at: new Date().toISOString() }, { onConflict: 'account_id,provider,provider_campaign_id' })
    return NextResponse.json({ synced: campaigns.length, errors }, { status: errors.length && campaigns.length === 0 ? 502 : 200 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível sincronizar campanhas.' }, { status: 500 }) }
}
