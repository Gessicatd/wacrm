"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

type Answers = Record<string, string | string[]>;
type Assessment = { overall_score: number | null; dimension_scores: Record<string, number>; answers?: Answers };
type Profile = { business_name?: string | null; specialty?: string | null; primary_offer?: string | null; target_90_days?: string | null } | null;

export default function ClientDiagnosisPage() {
  const [profile, setProfile] = useState<Profile>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void fetch("/api/commercial/onboarding").then((response) => response.json()).then((data) => { setProfile(data.profile ?? null); setAssessment(data.assessments?.[0] ?? null); }).finally(() => setLoading(false)); }, []);
  if (loading) return <main className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Preparando sua leitura…</main>;
  if (!assessment) return <main className="mx-auto max-w-3xl p-6">Preencha o diagnóstico para gerar esta apresentação.</main>;

  const answers = assessment.answers ?? {};
  const firstSignals = [
    answers.responseTime ? `O tempo de resposta informado é “${answers.responseTime}”.` : "O tempo de resposta ainda precisa ser medido.",
    answers.followup ? `O acompanhamento após o primeiro contato foi descrito como “${answers.followup}”.` : "O acompanhamento de oportunidades ainda precisa ser documentado.",
    answers.crm ? `O uso atual de CRM foi informado como “${answers.crm}”.` : "A forma de acompanhar as oportunidades ainda precisa ser validada.",
  ];

  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <Link href="/commercial" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
    <header className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8"><Sparkles className="h-7 w-7" /><p className="mt-5 text-sm font-medium opacity-80">Leitura da sua operação comercial</p><h1 className="mt-2 text-3xl font-bold">{profile?.business_name || "Sua empresa"} tem oportunidades claras de crescimento.</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-90">Suas respostas mostram onde o processo já funciona e onde oportunidades podem estar sendo perdidas. A boa notícia é que esses pontos podem ser organizados, medidos e melhorados com um processo comercial adequado à sua realidade.</p></header>
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8"><h2 className="text-xl font-semibold">O que identificamos</h2><p className="mt-2 text-sm text-muted-foreground">Esta é uma leitura inicial, baseada nas informações fornecidas. A validação com dados reais torna o plano ainda mais preciso.</p><div className="mt-5 space-y-3">{firstSignals.map((signal) => <div key={signal} className="flex gap-3 rounded-xl bg-muted/40 p-4 text-sm"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>{signal}</p></div>)}</div></section>
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8"><h2 className="text-xl font-semibold">O que isso pode representar</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><Card title="Oportunidades sem retorno" text="Pessoas interessadas podem não receber uma próxima ação clara no momento certo." /><Card title="Decisões sem dados" text="Sem indicadores por etapa, fica difícil saber qual parte do processo precisa de atenção." /><Card title="Dependência de pessoas" text="Quando cada vendedor trabalha de um jeito, o resultado varia e o crescimento fica limitado." /></div></section>
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8"><h2 className="text-xl font-semibold">Como podemos resolver</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">A proposta é estruturar o caminho completo: posicionamento, entrada de oportunidades, atendimento, follow-up, CRM, indicadores e automações supervisionadas. A tecnologia apoia a equipe; não substitui decisões que exigem contexto, responsabilidade ou aprovação humana.</p><ol className="mt-5 space-y-3 text-sm"><Step n="1" text="Organizar o funil e definir o que deve acontecer em cada etapa." /><Step n="2" text="Criar padrões de atendimento e acompanhamento para reduzir perdas." /><Step n="3" text="Configurar o CRM para mostrar prioridades e próximas ações." /><Step n="4" text="Medir resultados e evoluir o processo com base em evidências." /></ol></section>
    <section className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8"><h2 className="text-xl font-semibold">Próxima etapa</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Em uma conversa de validação, confirmamos os pontos acima, analisamos exemplos reais e definimos o primeiro plano de implementação para sua empresa.</p><Link href="/commercial/diagnosis" className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ver plano completo <ArrowRight className="ml-2 h-4 w-4" /></Link></section>
  </main>;
}

function Card({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-border p-4"><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></div>; }
function Step({ n, text }: { n: string; text: string }) { return <li className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span><span>{text}</span></li>; }
