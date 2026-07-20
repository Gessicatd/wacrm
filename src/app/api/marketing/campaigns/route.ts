import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { decryptToken } from '@/lib/marketing/oauth'

type Campaign = { id: string; name: string; status?: string; objective?: string; accountId?: string; raw?: Record<string, unknown> }

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
    for (const connection of connections ?? []) {
      if (!connection.access_token_encrypted) continue
      const accessToken = decryptToken(connection.access_token_encrypted)
      if (connection.provider === 'meta') {
        const accountsResponse = await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name&limit=100&access_token=${encodeURIComponent(accessToken)}`)
        const accounts = await accountsResponse.json() as { data?: Array<{ id: string; name?: string }> }
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
        for (const batch of body ?? []) for (const row of batch.results ?? []) if (row.campaign?.id && row.campaign.name) campaigns.push({ provider: 'google_ads', id: row.campaign.id, name: row.campaign.name, status: row.campaign.status, objective: row.campaign.advertisingChannelType, accountId: customer, raw: row })
      }
      await db.from('marketing_connections').update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id', connection.id)
    }
    for (const campaign of campaigns) await db.from('marketing_campaigns').upsert({ account_id: accountId, connection_id: (connections ?? []).find((item) => item.provider === campaign.provider)?.id, provider: campaign.provider, provider_campaign_id: campaign.id, provider_account_id: campaign.accountId ?? null, name: campaign.name, status: campaign.status ?? null, objective: campaign.objective ?? null, raw_data: campaign.raw ?? {}, last_synced_at: new Date().toISOString() }, { onConflict: 'account_id,provider,provider_campaign_id' })
    return NextResponse.json({ synced: campaigns.length })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível sincronizar campanhas.' }, { status: 500 }) }
}
