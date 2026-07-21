"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, CreditCard, Loader2, QrCode } from "lucide-react";

type Payment = { id: string; method: "pix" | "gateway"; amount_cents: number; description: string; status: string; external_reference: string; pix_copy_paste: string | null; checkout_url: string | null; created_at: string };

function money(cents: number) { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [method, setMethod] = useState<"pix" | "gateway">("pix");
  const [amount, setAmount] = useState("200");
  const [description, setDescription] = useState("Taxa de consulta");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() { const res = await fetch("/api/payments"); if (res.ok) setPayments((await res.json()).data ?? []); }
  useEffect(() => { void load(); }, []);

  async function createPayment(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, amount_cents: Math.round(Number(amount.replace(",", ".")) * 100), description, external_reference: reference || `consulta-${Date.now()}` }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível criar a cobrança");
      setMessage("Cobrança criada em sandbox. Use “Simular pagamento” para validar o fluxo."); setReference(""); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao criar cobrança"); } finally { setBusy(false); }
  }

  async function simulatePaid(id: string) { setBusy(true); const res = await fetch(`/api/payments/${id}/simulate-paid`, { method: "POST" }); const json = await res.json(); setMessage(res.ok ? "Pagamento confirmado e evento payment_confirmed emitido." : (json.error ?? "Não foi possível confirmar")); await load(); setBusy(false); }

  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <header className="rounded-2xl border border-border bg-card p-6"><div className="flex items-start gap-3"><CreditCard className="mt-1 h-6 w-6 text-primary" /><div><p className="text-sm font-medium text-primary">Pagamentos e cobranças</p><h1 className="mt-1 text-2xl font-bold">Pix direto ou gateway</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Crie cobranças e conecte a confirmação de pagamento às automações. Esta primeira versão usa sandbox e não acessa banco ou gateway real.</p></div></div></header>
    <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={createPayment} className="space-y-4 rounded-2xl border border-border bg-card p-6"><h2 className="font-semibold">Nova cobrança</h2><label className="grid gap-2 text-sm">Método<select value={method} onChange={e => setMethod(e.target.value as "pix" | "gateway")} className="h-10 rounded-md border border-input bg-background px-3"><option value="pix">Pix direto</option><option value="gateway">Gateway</option></select></label><label className="grid gap-2 text-sm">Valor (R$)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3" /></label><label className="grid gap-2 text-sm">Descrição<input value={description} onChange={e => setDescription(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3" /></label><label className="grid gap-2 text-sm">Referência idempotente<input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ex.: consulta-joao-2026-07-21" className="h-10 rounded-md border border-input bg-background px-3" /></label><button disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Criar cobrança</button>{message && <p className="text-sm text-muted-foreground">{message}</p>}</form>
      <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /><h2 className="font-semibold">Cobranças recentes</h2></div><div className="mt-4 space-y-3">{payments.length ? payments.map(payment => <article key={payment.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{payment.description}</p><p className="text-sm text-muted-foreground">{payment.method === "pix" ? "Pix direto" : "Gateway"} · {money(payment.amount_cents)}</p></div><span className={`rounded-full px-2 py-1 text-xs ${payment.status === "paid" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{payment.status}</span></div>{payment.pix_copy_paste && <button type="button" onClick={() => navigator.clipboard?.writeText(payment.pix_copy_paste ?? "")} className="mt-3 inline-flex items-center gap-2 text-xs text-primary"><Copy className="h-3 w-3" />Copiar Pix Copia e Cola</button>}{payment.checkout_url && <a href={payment.checkout_url} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-primary">Abrir checkout sandbox</a>}{payment.status === "pending" && <button type="button" disabled={busy} onClick={() => simulatePaid(payment.id)} className="mt-3 inline-flex items-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-xs text-primary"><CheckCircle2 className="h-3 w-3" />Simular pagamento confirmado</button>}</article>) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma cobrança criada.</p>}</div></section>
    </section>
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm"><strong>Limite desta etapa:</strong> a confirmação simulada gera o evento `payment_confirmed`; a conexão com banco/gateway real e a execução automática de mensagens/agendamentos entrarão após a escolha do provedor e aplicação da migration 058.</section>
  </main>;
}
