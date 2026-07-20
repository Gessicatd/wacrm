"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock3, ShieldCheck, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateForecastTotals, getDealHealth } from "@/lib/commercial/deal-health";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/hooks/use-auth";
import type { Deal } from "@/types";

export default function CommercialPage() {
  const supabase = createClient();
  const { defaultCurrency } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [referenceTime, setReferenceTime] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("deals").select("*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)").order("next_action_at", { ascending: true, nullsFirst: true });
      if (cancelled) return;
      setDeals((data ?? []) as Deal[]);
      setReferenceTime(Date.now());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const stats = useMemo(() => {
    const open = deals.filter((d) => d.status === "open");
    const exceptions = open.filter((d) => getDealHealth(d).actionable);
    const now = referenceTime;
    const week = now + 7 * 86_400_000;
    const appointments = open.filter((d) => d.appointment_at && new Date(d.appointment_at).getTime() >= now && new Date(d.appointment_at).getTime() <= week);
    return {
      exceptions,
      appointments,
      noShows: deals.filter((d) => d.appointment_status === "no_show"),
      consentUnknown: open.filter((d) => d.consent_status === "unknown"),
      pendingHandoff: deals.filter((d) => d.status === "won" && d.handoff_status !== "complete"),
      forecast: calculateForecastTotals(deals),
    };
  }, [deals, referenceTime]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading commercial operation…</div>;

  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-primary">Health & aesthetics high-ticket</p><h1 className="mt-1 text-2xl font-bold text-foreground">Commercial command center</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Exceptions first: protect response time, attendance, next actions, consent and delivery handoff without storing clinical records.</p></div><div className="flex flex-wrap gap-2"><Link href="/commercial/diagnosis" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">Ver diagnóstico</Link><Link href="/commercial/strategy-plan" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">Plano estratégico</Link><Link href="/commercial/agents" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">Agentes</Link><Link href="/commercial/playbooks" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">Playbooks</Link><Link href="/commercial/funnel-builder" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">Criar funil</Link><Link href="/marketing/attribution" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">Rastrear campanhas</Link><Link href="/commercial/onboarding" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Iniciar diagnóstico</Link></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={Target} label="Commit forecast" value={formatCurrency(stats.forecast.commit, defaultCurrency)} tone="text-emerald-500" />
      <Stat icon={AlertTriangle} label="Action exceptions" value={String(stats.exceptions.length)} tone="text-red-500" />
      <Stat icon={CalendarCheck} label="Evaluations next 7 days" value={String(stats.appointments.length)} tone="text-blue-500" />
      <Stat icon={CheckCircle2} label="Pending handoffs" value={String(stats.pendingHandoff.length)} tone="text-amber-500" />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Queue title="Needs action now" subtitle="Missing or overdue next actions" deals={stats.exceptions} empty="No action exceptions." />
      <Queue title="Upcoming evaluations" subtitle="Next seven days" deals={stats.appointments} empty="No evaluations scheduled for the next seven days." appointment />
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Guardrail icon={Clock3} title="No-show recovery" value={stats.noShows.length} description="Opportunities marked as no-show and eligible for a consented recovery flow." />
      <Guardrail icon={ShieldCheck} title="Consent review" value={stats.consentUnknown.length} description="Open opportunities where contact consent provenance is still unknown." />
      <Guardrail icon={CheckCircle2} title="Handoff completion" value={stats.pendingHandoff.length} description="Won deals that have not completed the commercial-to-delivery handoff." />
    </div>
  </div>;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Target; label: string; value: string; tone: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className={`h-4 w-4 ${tone}`} />{label}</div><p className="mt-3 text-2xl font-bold text-foreground">{value}</p></div>;
}

function Queue({ title, subtitle, deals, empty, appointment = false }: { title: string; subtitle: string; deals: Deal[]; empty: string; appointment?: boolean }) {
  return <section className="rounded-xl border border-border bg-card p-4"><div className="mb-4"><h2 className="font-semibold text-foreground">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div><div className="space-y-2">{deals.length === 0 ? <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">{empty}</p> : deals.slice(0, 8).map((deal) => <Link key={deal.id} href="/pipelines" className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/50"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{deal.title}</p><p className="truncate text-xs text-muted-foreground">{deal.contact?.name || deal.contact?.phone || deal.service_name || "No contact"}</p></div><span className="shrink-0 text-xs text-muted-foreground">{appointment ? formatWhen(deal.appointment_at) : getDealHealth(deal).label}</span></Link>)}</div></section>;
}

function Guardrail({ icon: Icon, title, value, description }: { icon: typeof Clock3; title: string; value: number; description: string }) {
  return <div className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-primary" /><b className="text-xl text-foreground">{value}</b></div><h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>;
}

function formatWhen(value?: string | null) {
  return value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not scheduled";
}
