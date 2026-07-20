import crypto from 'node:crypto'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

export type MarketingProvider = 'meta' | 'google_ads'

export function providerEnv(provider: MarketingProvider) {
  if (provider === 'meta') return { id: process.env.META_ADS_APP_ID, secret: process.env.META_ADS_APP_SECRET, redirect: process.env.META_ADS_REDIRECT_URI }
  return { id: process.env.GOOGLE_ADS_CLIENT_ID, secret: process.env.GOOGLE_ADS_CLIENT_SECRET, redirect: process.env.GOOGLE_ADS_REDIRECT_URI }
}

export function createOAuthState(accountId: string, provider: MarketingProvider) {
  const payload = JSON.stringify({ accountId, provider, nonce: crypto.randomBytes(16).toString('hex'), exp: Date.now() + 10 * 60 * 1000 })
  return encrypt(payload)
}

export function readOAuthState(state: string) {
  const payload = JSON.parse(decrypt(state)) as { accountId: string; provider: MarketingProvider; exp: number }
  if (!payload.accountId || !['meta', 'google_ads'].includes(payload.provider) || payload.exp < Date.now()) throw new Error('OAuth state expired')
  return payload
}

export function metaAuthorizeUrl(state: string, env: ReturnType<typeof providerEnv>) {
  const params = new URLSearchParams({ client_id: env.id!, redirect_uri: env.redirect!, state, response_type: 'code', scope: 'business_management,ads_read,ads_management,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights' })
  return `https://www.facebook.com/v20.0/dialog/oauth?${params}`
}

export function googleAuthorizeUrl(state: string, env: ReturnType<typeof providerEnv>) {
  const params = new URLSearchParams({ client_id: env.id!, redirect_uri: env.redirect!, state, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/adwords' })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function encryptToken(token: string) { return encrypt(token) }
export function decryptToken(token: string) { return decrypt(token) }
