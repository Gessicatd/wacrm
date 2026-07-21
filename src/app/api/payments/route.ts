import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { createSandboxCharge, validateCreatePaymentInput } from "@/lib/payments/runtime";

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase.from("payments").select("*").eq("account_id", ctx.accountId).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Failed to list payments" }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const input = validateCreatePaymentInput(body);
    const existing = await ctx.supabase.from("payments").select("*").eq("account_id", ctx.accountId).eq("external_reference", input.externalReference).maybeSingle();
    if (existing.error) return NextResponse.json({ error: "Failed to check idempotency" }, { status: 500 });
    if (existing.data) return NextResponse.json({ data: existing.data, idempotent: true });

    const kind = input.method === "pix" ? "pix_direct" : "gateway";
    const providerKey = input.method === "pix" ? "sandbox_pix" : "sandbox_gateway";
    const provider = await ctx.supabase.from("payment_providers").upsert({ account_id: ctx.accountId, kind, provider_key: providerKey, display_name: input.method === "pix" ? "Pix (sandbox)" : "Gateway (sandbox)", status: "sandbox", created_by: ctx.userId }, { onConflict: "account_id,kind,provider_key" }).select("id").single();
    if (provider.error || !provider.data) return NextResponse.json({ error: "Failed to configure payment provider" }, { status: 500 });
    const charge = createSandboxCharge(input);
    const { data, error } = await ctx.supabase.from("payments").insert({ account_id: ctx.accountId, provider_id: provider.data.id, contact_id: typeof body?.contact_id === "string" ? body.contact_id : null, conversation_id: typeof body?.conversation_id === "string" ? body.conversation_id : null, external_reference: input.externalReference, amount_cents: input.amountCents, currency: "BRL", description: input.description, method: input.method, status: "pending", provider_payment_id: charge.providerPaymentId, checkout_url: charge.checkoutUrl, pix_copy_paste: charge.pixCopyPaste, expires_at: charge.expiresAt, created_by: ctx.userId }).select("*").single();
    if (error) return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
    await ctx.supabase.from("payment_events").insert({ account_id: ctx.accountId, payment_id: data.id, provider_key: providerKey, idempotency_key: `created:${charge.providerPaymentId}`, event_type: "created", payload: { method: input.method, amount_cents: input.amountCents } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /required|must be|between/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    return toErrorResponse(error);
  }
}
