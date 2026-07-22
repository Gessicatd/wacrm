import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { encrypt } from "@/lib/whatsapp/encryption";

const PROVIDER_DOCS: Record<string, string> = {
  mercado_pago: "https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials",
  asaas: "https://docs.asaas.com/docs/autenticacao",
  pagbank: "https://developer.pagbank.com.br/docs/apis-pagbank",
  banco_pix: "https://www.bcb.gov.br/estabilidadefinanceira/pix",
};

export async function GET() {
  try {
    const ctx = await requireRole("admin");
    const { data, error } = await ctx.supabase.from("payment_providers").select("id,kind,provider_key,display_name,status,credential_hint,metadata,updated_at").eq("account_id", ctx.accountId).order("created_at");
    if (error) return NextResponse.json({ error: "Failed to list payment providers" }, { status: 500 });
    return NextResponse.json({ data: (data ?? []).map((provider) => ({ ...provider, documentation_url: PROVIDER_DOCS[provider.provider_key] ?? null })) });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const kind = body?.kind;
    const providerKey = body?.provider_key;
    const credentials = body?.credentials;
    if ((kind !== "pix_direct" && kind !== "gateway") || typeof providerKey !== "string" || !/^[a-z0-9_:-]{2,80}$/.test(providerKey)) return NextResponse.json({ error: "kind and provider_key are required" }, { status: 400 });
    if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) return NextResponse.json({ error: "credentials must be an object" }, { status: 400 });
    const serialized = JSON.stringify(credentials);
    if (serialized.length > 8000) return NextResponse.json({ error: "credentials payload is too large" }, { status: 400 });
    const hint = typeof body.credential_hint === "string" ? body.credential_hint.slice(0, 120) : "Configurado pelo administrador";
    const { data, error } = await ctx.supabase.from("payment_providers").upsert({ account_id: ctx.accountId, kind, provider_key: providerKey, display_name: typeof body.display_name === "string" ? body.display_name.slice(0, 120) : providerKey, status: "sandbox", credentials_encrypted: encrypt(serialized), credential_hint: hint, metadata: { documentation_url: PROVIDER_DOCS[providerKey] ?? null }, created_by: ctx.userId }, { onConflict: "account_id,kind,provider_key" }).select("id,kind,provider_key,display_name,status,credential_hint,metadata,updated_at").single();
    if (error) return NextResponse.json({ error: "Failed to save payment provider" }, { status: 500 });
    return NextResponse.json({ data: { ...data, documentation_url: PROVIDER_DOCS[providerKey] ?? null }, credentials_saved: true }, { status: 200 });
  } catch (error) { return toErrorResponse(error); }
}
