import { NextResponse } from 'next/server'

type Input = { supabaseUrl?: unknown; supabaseAnonKey?: unknown; supabaseServiceKey?: unknown; domain?: unknown; encryptionKey?: unknown; metaAppSecret?: unknown }

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Input
  const url = text(body.supabaseUrl)
  const anon = text(body.supabaseAnonKey)
  const service = text(body.supabaseServiceKey)
  const domain = text(body.domain)
  const encryption = text(body.encryptionKey)
  const checks = [
    { key: 'supabase-url', label: 'URL do Supabase', ok: isHttpsUrl(url), message: isHttpsUrl(url) ? 'Formato válido.' : 'Informe uma URL HTTPS válida.' },
    { key: 'supabase-anon', label: 'Anon key', ok: anon.length > 20, message: anon.length > 20 ? 'Formato recebido; o valor não foi armazenado.' : 'A chave parece incompleta.' },
    { key: 'supabase-service', label: 'Service role key', ok: service.length > 20, message: service.length > 20 ? 'Formato recebido; o valor não foi armazenado.' : 'A chave parece incompleta.' },
    { key: 'encryption', label: 'Encryption key', ok: /^[a-f0-9]{64}$/i.test(encryption), message: /^[a-f0-9]{64}$/i.test(encryption) ? 'Chave de 64 caracteres válida.' : 'Gere uma chave hexadecimal com 64 caracteres.' },
    { key: 'domain', label: 'Endereço público', ok: isHttpsUrl(domain), message: isHttpsUrl(domain) ? 'URL pública válida.' : 'Use HTTPS em produção.' },
    { key: 'meta', label: 'Meta App Secret', ok: !text(body.metaAppSecret) || text(body.metaAppSecret).length > 10, message: !text(body.metaAppSecret) ? 'Opcional nesta etapa.' : 'Formato recebido; o valor não foi armazenado.' },
  ]
  return NextResponse.json({ ok: checks.every((check) => check.ok), checks })
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function isHttpsUrl(value: string) { try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) } catch { return false } }
