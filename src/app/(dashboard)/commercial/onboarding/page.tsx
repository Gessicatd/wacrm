"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ONBOARDING_OPTIONS } from "@/lib/commercial/onboarding-options";

type Answers = Record<string, string | string[]>;

const steps = [
  { title: "Empresa", description: "Contexto e objetivos da operação." },
  { title: "Oferta e cliente", description: "Serviço prioritário, público e posicionamento." },
  { title: "Aquisição e funil", description: "Canais de entrada e percurso comercial." },
  { title: "Atendimento e vendas", description: "Resposta, acompanhamento e condução da oportunidade." },
  { title: "Processos e indicadores", description: "Ferramentas, equipe, dados e gargalos." },
  { title: "Governança e automação", description: "Consentimento, limites e responsabilidades." },
];

const selectOptions: Record<string, readonly string[]> = ONBOARDING_OPTIONS;

function scoreFor(value: string | string[] | undefined, options: readonly string[]) {
  if (!value || Array.isArray(value)) return 0;
  const index = options.indexOf(value);
  return Math.max(0, 100 - index * 25);
}

export default function CommercialOnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ automationBoundary: [] });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const current = steps[step];
  const set = (key: string, value: string | string[]) => setAnswers((old) => ({ ...old, [key]: value }));

  const scores = useMemo(() => ({
    Estratégia: Math.round((scoreFor(answers.awareness, selectOptions.awareness) + scoreFor(answers.research, selectOptions.research)) / 2),
    Oferta: Math.round((scoreFor(answers.ticket, selectOptions.ticket) + (answers.mainOffer ? 100 : 0)) / 2),
    Aquisição: Math.round((scoreFor(answers.salesPath, selectOptions.salesPath) + scoreFor(answers.funnelType, selectOptions.funnelType)) / 2),
    Atendimento: Math.round((scoreFor(answers.responseTime, selectOptions.responseTime) + scoreFor(answers.followup, selectOptions.followup) + scoreFor(answers.callProcess, selectOptions.callProcess)) / 3),
    Processo: Math.round(((answers.crm === "Sim" ? 100 : answers.crm === "Parcialmente" ? 50 : 0) + scoreFor(answers.followup, selectOptions.followup)) / 2),
    Governança: scoreFor(answers.consent, selectOptions.consent),
  }), [answers]);

  const overall = Math.round(Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.values(scores).length);

  async function submit() {
    setStatus("saving");
    const response = await fetch("/api/commercial/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, dimension_scores: scores, overall_score: overall, evidence_status: { crm_export: answers.crm === "Sim" ? "available" : "missing", won_conversations: "missing", lost_conversations: "missing" } }) });
    setStatus(response.ok ? "saved" : "error");
  }

  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <Link href="/commercial" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar ao comando comercial</Link>
    <header className="rounded-2xl border border-border bg-card p-6"><div className="flex items-start gap-3"><ClipboardCheck className="mt-1 h-6 w-6 text-primary" /><div><p className="text-sm font-medium text-primary">Diagnóstico comercial</p><h1 className="mt-1 text-2xl font-bold">Mapeamento da operação</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Responda com a maior precisão possível. Quando uma informação não estiver disponível, selecione “Ainda não sei”; esse ponto será validado posteriormente.</p></div></div><div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">{steps.map((item, index) => <div key={item.title} className="space-y-1"><div className={`h-2 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} /><p className="truncate text-[11px] text-muted-foreground">{index + 1}. {item.title}</p></div>)}</div></header>
    <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-6"><h2 className="text-lg font-semibold">{current.title}</h2><p className="text-sm text-muted-foreground">{current.description}</p></div>
      {step === 0 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Nome da empresa" value={answers.businessName} onChange={(value) => set("businessName", value)} /><Field label="Função do respondente" value={answers.role} onChange={(value) => set("role", value)} options={["Proprietário(a)", "Gerente", "Responsável comercial", "Outro"]} /><Field label="Capacidade mensal de novos atendimentos" value={answers.capacity} onChange={(value) => set("capacity", value)} type="number" /><Field label="Especialidade ou segmento principal" value={answers.specialty} onChange={(value) => set("specialty", value)} options={selectOptions.specialty} /><Field label="Objetivo comercial para os próximos 90 dias" value={answers.goal} onChange={(value) => set("goal", value)} /></div>}
      {step === 1 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Oferta ou serviço prioritário" value={answers.mainOffer} onChange={(value) => set("mainOffer", value)} /><Field label="Faixa de ticket da oferta" value={answers.ticket} onChange={(value) => set("ticket", value)} options={selectOptions.ticket} /><Field label="Descrição do cliente ideal" value={answers.idealCustomer} onChange={(value) => set("idealCustomer", value)} /><Field label="Estágio de consciência predominante do público" value={answers.awareness} onChange={(value) => set("awareness", value)} options={selectOptions.awareness} /><Field label="Prioridade comercial atual" value={answers.priority} onChange={(value) => set("priority", value)} options={selectOptions.priority} /></div>}
      {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Como a empresa pesquisa concorrentes e mercado?" value={answers.research} onChange={(value) => set("research", value)} options={selectOptions.research} /><Field label="Qual percurso comercial o cliente normalmente faz?" value={answers.funnelType} onChange={(value) => set("funnelType", value)} options={selectOptions.funnelType} /><Field label="Principais canais de entrada de oportunidades" value={answers.salesPath} onChange={(value) => set("salesPath", value)} options={selectOptions.salesPath} /><Field label="Diferencial percebido pelo cliente" value={answers.differentiator} onChange={(value) => set("differentiator", value)} /></div>}
      {step === 3 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Tempo médio até a primeira resposta" value={answers.responseTime} onChange={(value) => set("responseTime", value)} options={selectOptions.responseTime} /><Field label="Como é feito o acompanhamento de leads sem resposta?" value={answers.followup} onChange={(value) => set("followup", value)} options={selectOptions.followup} /><Field label="Como a call de vendas é conduzida?" value={answers.callProcess} onChange={(value) => set("callProcess", value)} options={selectOptions.callProcess} /><Field label="Responsável pelo atendimento comercial" value={answers.team} onChange={(value) => set("team", value)} /><Field label="Principal gargalo no atendimento" value={answers.bottleneck} onChange={(value) => set("bottleneck", value)} /></div>}
      {step === 4 && <div className="grid gap-4 sm:grid-cols-2"><Field label="CRM ou sistema de acompanhamento" value={answers.crm} onChange={(value) => set("crm", value)} options={["Sim", "Parcialmente", "Não"]} /><Field label="Como a empresa mede conversão e desempenho?" value={answers.measurement} onChange={(value) => set("measurement", value)} /><Field label="Tamanho da equipe comercial" value={answers.salespeople} onChange={(value) => set("salespeople", value)} type="number" /><Field label="Volume aproximado de novos leads por mês" value={answers.monthlyLeads} onChange={(value) => set("monthlyLeads", value)} type="number" /><div className="sm:col-span-2"><Label>Principal correção necessária neste momento</Label><Textarea className="mt-2" value={String(answers.firstFix ?? "")} onChange={(event) => set("firstFix", event.target.value)} /></div></div>}
      {step === 5 && <div className="space-y-4"><Field label="Como o consentimento para contato é registrado?" value={answers.consent} onChange={(value) => set("consent", value)} options={selectOptions.consent} /><div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><div className="flex gap-2"><ShieldCheck className="h-5 w-5 text-amber-500" /><p>Não inclua diagnósticos, exames, prescrições ou imagens de pacientes. Este diagnóstico trata exclusivamente da operação comercial.</p></div></div><div><Label>Limites e aprovações necessários para automação</Label><Textarea className="mt-2" value={Array.isArray(answers.automationBoundary) ? answers.automationBoundary.join("\n") : ""} onChange={(event) => set("automationBoundary", event.target.value.split("\n"))} placeholder="Ex.: mensagens sobre questões clínicas exigem aprovação de um profissional" /></div></div>}
      <div className="mt-8 flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>{step < steps.length - 1 ? <Button onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Próxima etapa <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={submit} disabled={status === "saving"}>{status === "saving" ? "Salvando…" : "Finalizar diagnóstico"}</Button>}</div>
    </section>
    {step === steps.length - 1 && <section className="rounded-2xl border border-border bg-muted/30 p-6"><p className="text-sm font-medium">Prévia do diagnóstico</p><div className="mt-4 grid gap-3 sm:grid-cols-5">{Object.entries(scores).map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div><p className="mt-4 text-sm text-muted-foreground">Pontuação geral: <strong className="text-foreground">{overall}/100</strong>. {status === "saved" && <span className="text-emerald-600"><CheckCircle2 className="mr-1 inline h-4 w-4" /> Diagnóstico salvo.</span>}{status === "error" && <span className="text-red-600">Não foi possível salvar. Tente novamente.</span>}</p></section>}
  </main>;
}

function Field({ label, value, onChange, type = "text", options }: { label: string; value?: string | string[]; onChange: (value: string) => void; type?: string; options?: readonly string[] }) {
  return <div><Label>{label}</Label>{options ? <select className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}><option value="">Escolha uma opção…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}<option value="Ainda não sei">Ainda não sei</option></select> : <Input className="mt-2" type={type} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />}</div>;
}
