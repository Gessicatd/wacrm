"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, GitBranch, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type StageDraft = { name: string; sla_hours: number; probability: number; exit_criteria: string };

const STARTER_STAGES: StageDraft[] = [
  { name: "Novo interessado", sla_hours: 2, probability: 5, exit_criteria: "Contato humano iniciado ou desqualificação justificada" },
  { name: "Pré-qualificação", sla_hours: 48, probability: 15, exit_criteria: "Objetivo, logística e aderência comercial compreendidos" },
  { name: "Avaliação agendada", sla_hours: 168, probability: 30, exit_criteria: "Data aceita e confirmação solicitada" },
  { name: "Avaliação realizada", sla_hours: 24, probability: 55, exit_criteria: "Comparecimento registrado e próximo passo definido" },
  { name: "Plano apresentado", sla_hours: 72, probability: 70, exit_criteria: "Oferta compreendida e retorno combinado" },
  { name: "Contratado", sla_hours: 48, probability: 100, exit_criteria: "Pagamento/documentos e handoff concluídos" },
];

export default function FunnelBuilderPage() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Jornada Comercial High Ticket");
  const [offer, setOffer] = useState("");
  const [stages, setStages] = useState<StageDraft[]>(STARTER_STAGES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const completion = useMemo(() => Math.round((step / 3) * 100), [step]);
  function updateStage(index: number, patch: Partial<StageDraft>) { setStages((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function addStage() { setStages((items) => [...items, { name: "Nova etapa", sla_hours: 48, probability: 50, exit_criteria: "Defina o que precisa estar concluído para avançar" }]); }
  function removeStage(index: number) { if (stages.length <= 2) return; setStages((items) => items.filter((_, itemIndex) => itemIndex !== index)); }
  async function createFunnel() {
    setError(""); setSaving(true);
    if (!accountId || !name.trim()) { setError("Informe um nome e verifique se sua conta está carregada."); setSaving(false); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Sua sessão expirou. Entre novamente para criar o funil."); setSaving(false); return; }
    const { data: pipeline, error: pipelineError } = await supabase.from("pipelines").insert({ name: name.trim(), user_id: auth.user.id, account_id: accountId }).select("id").single();
    if (pipelineError || !pipeline) { setError(pipelineError?.message || "Não foi possível criar o funil."); setSaving(false); return; }
    const { error: stagesError } = await supabase.from("pipeline_stages").insert(stages.map((stage, position) => ({ ...stage, pipeline_id: pipeline.id, position, color: ["#3b82f6", "#06b6d4", "#eab308", "#f97316", "#a855f7", "#22c55e"][position % 6] })));
    if (stagesError) { setError(stagesError.message); setSaving(false); return; }
    setSaved(true); setSaving(false);
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"><Link href="/commercial" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar ao comando comercial</Link><header className="rounded-2xl border border-border bg-card p-6"><div className="flex items-start gap-3"><GitBranch className="mt-1 h-6 w-6 text-primary" /><div><p className="text-sm font-medium text-primary">Criador de funil</p><h1 className="mt-1 text-2xl font-bold">Monte a jornada comercial em três passos</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">O funil mostra em que ponto cada oportunidade está, o que falta para avançar e quem precisa agir. Você poderá revisar tudo antes de usar com a equipe.</p></div></div><div className="mt-6 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">Passo {step} de 3</p></header>{saved ? <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6"><div className="flex items-start gap-3"><Check className="h-6 w-6 text-emerald-600" /><div><h2 className="font-semibold">Funil criado com sucesso</h2><p className="mt-1 text-sm text-muted-foreground">As etapas foram salvas no CRM. Agora você pode acompanhar negócios e ajustar as regras em Pipelines.</p><Link href="/pipelines" className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Abrir Pipelines</Link></div></div></section> : <><section className="rounded-2xl border border-border bg-card p-6">{step === 1 && <div className="space-y-5"><h2 className="text-lg font-semibold">1. Dê um nome à jornada</h2><p className="text-sm text-muted-foreground">Use um nome que a equipe reconheça, como “Captação de pacientes — procedimento premium”.</p><label className="block text-sm font-medium">Nome do funil<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3" /></label><label className="block text-sm font-medium">Oferta principal (opcional)<input value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Ex.: Protocolo facial premium" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3" /></label></div>}{step === 2 && <div className="space-y-5"><div><h2 className="text-lg font-semibold">2. Revise as etapas</h2><p className="mt-1 text-sm text-muted-foreground">Uma oportunidade só avança quando o critério da etapa estiver cumprido.</p></div><div className="space-y-3">{stages.map((stage, index) => <div key={`${index}-${stage.name}`} className="rounded-xl border border-border p-4"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span><div className="min-w-0 flex-1 space-y-3"><input value={stage.name} onChange={(event) => updateStage(index, { name: event.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium" /><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Prazo (horas)<input type="number" min={1} value={stage.sla_hours} onChange={(event) => updateStage(index, { sla_hours: Number(event.target.value) })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" /></label><label className="text-xs text-muted-foreground">Probabilidade (%)<input type="number" min={0} max={100} value={stage.probability} onChange={(event) => updateStage(index, { probability: Number(event.target.value) })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" /></label></div><label className="block text-xs text-muted-foreground">Critério para avançar<input value={stage.exit_criteria} onChange={(event) => updateStage(index, { exit_criteria: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" /></label></div><button type="button" title="Remover etapa" onClick={() => removeStage(index)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div></div>)}</div><button type="button" onClick={addStage} className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm hover:bg-muted"><Plus className="h-4 w-4" /> Adicionar etapa</button></div>}{step === 3 && <div className="space-y-5"><h2 className="text-lg font-semibold">3. Confirme antes de criar</h2><div className="rounded-xl bg-muted/40 p-4 text-sm"><p><strong>Funil:</strong> {name || "Sem nome"}</p>{offer && <p className="mt-1"><strong>Oferta:</strong> {offer}</p>}<p className="mt-1"><strong>Etapas:</strong> {stages.length}</p></div><p className="text-sm text-muted-foreground">Nada será automatizado agora. O funil será criado como estrutura do CRM; mensagens e automações só entram depois de revisão.</p>{error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}</div>}</section><div className="flex justify-between"><button type="button" disabled={step === 1} onClick={() => setStep((value) => value - 1)} className="h-10 rounded-md border border-input px-4 text-sm disabled:opacity-50">Voltar</button>{step < 3 ? <button type="button" onClick={() => setStep((value) => value + 1)} disabled={step === 1 && !name.trim()} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Continuar <ChevronRight className="h-4 w-4" /></button> : <button type="button" onClick={createFunnel} disabled={saving} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Criando…" : "Criar funil no CRM"}</button>}</div></>}</main>;
}
