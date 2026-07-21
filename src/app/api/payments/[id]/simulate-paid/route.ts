import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { assertPaymentTransition } from "@/lib/payments/runtime";
import { runAutomationsForTrigger } from "@/lib/automations/engine";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const payment = await ctx.supabase.from("payments").select("*").eq("account_id", ctx.accountId).eq("id", id).maybeSingle();
    if (payment.error) return NextResponse.json({ error: "Failed to load payment" }, { status: 500 });
    if (!payment.data) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    assertPaymentTransition(payment.data.status, "paid");
    const paidAt = new Date().toISOString();
    const updated = await ctx.supabase.from("payments").update({ status: "paid", paid_at: paidAt, updated_at: paidAt }).eq("account_id", ctx.accountId).eq("id", id).eq("status", "pending").select("*").single();
    if (updated.error || !updated.data) return NextResponse.json({ error: "Payment was already processed" }, { status: 409 });
    const eventKey = `paid:${payment.data.provider_payment_id ?? id}`;
    await ctx.supabase.from("payment_events").insert({ account_id: ctx.accountId, payment_id: id, provider_key: "sandbox", idempotency_key: eventKey, event_type: "paid", payload: { simulated: true, paid_at: paidAt } });
    await runAutomationsForTrigger({ accountId: ctx.accountId, triggerType: "payment_confirmed", contactId: updated.data.contact_id, context: { conversation_id: updated.data.conversation_id ?? undefined, payment: { id: updated.data.id, amount_cents: updated.data.amount_cents, method: updated.data.method, external_reference: updated.data.external_reference }, vars: { payment_id: updated.data.id, payment_amount_cents: updated.data.amount_cents, payment_method: updated.data.method } } });
    return NextResponse.json({ data: updated.data, event: "paid", automation_event: "payment_confirmed" });
  } catch (error) {
    if (error instanceof Error && /Invalid payment transition/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    return toErrorResponse(error);
  }
}
