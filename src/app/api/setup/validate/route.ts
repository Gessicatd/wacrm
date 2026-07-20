import { NextResponse } from 'next/server'

type Input = {
  supabaseUrl?: unknown; supabaseAnonKey?: unknown; supabaseServiceKey?: unknown; domain?: unknown; encryptionKey?: unknown;
  metaAppSecret?: unknown; instagramAppSecret?: unknown; ryzeApiUrl?: unknown; ryzeApiAdminToken?: unknown;
  googleCalendarClientId?: unknown; googleCalendarClientSecret?: unknown; googleCalendarRedirectUri?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Input
  const url = text(body.supabaseUrl)
  const anon = text(body.supabaseAnonKey)
  const service = text(body.supabaseServiceKey)
  const domain = text(body.domain)
  const encryption = text(body.encryptionKey)
  const instagram = text(body.instagramAppSecret)
  const ryzeUrl = text(body.ryzeApiUrl)
  const ryzeToken = text(body.ryzeApiAdminToken)
  const googleClientId = text(body.googleCalendarClientId)
  const googleClientSecret = text(body.googleCalendarClientSecret)
  const googleRedirect = text(body.googleCalendarRedirectUri)
  const checks = [
    { key: 'supabase-url', label: 'URL do Supabase', ok: isHttpsUrl(url), message: isHttpsUrl(url) ? 'Formato válido.' : 'Informe uma URL HTTPS válida.' },
    { key: 'supabase-anon', label: 'Anon key', ok: anon.length > 20, message: anon.length > 20 ? 'Formato recebido; o valor não foi armazenado.' : 'A chave parece incompleta.' },
    { key: 'supabase-service', label: 'Service role key', ok: service.length > 20, message: service.length > 20 ? 'Formato recebido; o valor não foi armazenado.' : 'A chave parece incompleta.' },
    { key: 'encryption', label: 'Encryption key', ok: /^[a-f0-9]{64}$/i.test(encryption), message: /^[a-f0-9]{64}$/i.test(encryption) ? 'Chave de 64 caracteres válida.' : 'Gere uma chave hexadecimal com 64 caracteres.' },
    { key: 'domain', label: 'Endereço público', ok: isHttpsUrl(domain), message: isHttpsUrl(domain) ? 'URL pública válida.' : 'Use HTTPS em produção.' },
    { key: 'meta', label: 'Meta App Secret', ok: !text(body.metaAppSecret) || text(body.metaAppSecret).length > 10, message: !text(body.metaAppSecret) ? 'Opcional nesta etapa.' : 'Formato recebido; o valor não foi armazenado.' },
    { key: 'instagram', label: 'Instagram App Secret', ok: !instagram || instagram.length > 10, message: !instagram ? 'Opcional nesta etapa.' : 'Formato recebido; o valor não foi armazenado.' },
    { key: 'ryze-url', label: 'URL do RyzeAPI', ok: !ryzeUrl || isHttpsUrl(ryzeUrl), message: !ryzeUrl ? 'Opcional nesta etapa.' : isHttpsUrl(ryzeUrl) ? 'URL HTTPS válida.' : 'Use uma URL HTTPS válida.' },
    { key: 'ryze-token', label: 'Token administrativo do RyzeAPI', ok: !ryzeUrl ? true : ryzeToken.length > 10, message: !ryzeUrl ? 'Não necessário sem URL do RyzeAPI.' : ryzeToken.length > 10 ? 'Formato recebido; o valor não foi armazenado.' : 'Informe o token ou remova a URL do RyzeAPI.' },
    { key: 'google-client-id', label: 'Google Calendar Client ID', ok: !googleClientId || googleClientId.endsWith('.apps.googleusercontent.com'), message: !googleClientId ? 'Opcional nesta etapa.' : googleClientId.endsWith('.apps.googleusercontent.com') ? 'Formato válido.' : 'Use o Client ID do Google Cloud Console.' },
    { key: 'google-client-secret', label: 'Google Calendar Client Secret', ok: !googleClientId ? true : googleClientSecret.length > 10, message: !googleClientId ? 'Não necessário sem Client ID.' : googleClientSecret.length > 10 ? 'Formato recebido; o valor não foi armazenado.' : 'Informe o Client Secret ou remova o Client ID.' },
    { key: 'google-redirect', label: 'Google Calendar Redirect URI', ok: !googleClientId ? true : isHttpsUrl(googleRedirect), message: !googleClientId ? 'Não necessário sem Client ID.' : isHttpsUrl(googleRedirect) ? 'URL HTTPS válida.' : 'Informe uma Redirect URI HTTPS válida.' },
  ]
  return NextResponse.json({ ok: checks.every((check) => check.ok), checks })
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function isHttpsUrl(value: string) { try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) } catch { return false } }
