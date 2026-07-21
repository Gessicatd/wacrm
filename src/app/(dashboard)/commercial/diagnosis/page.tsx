"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BarChart3, ClipboardList, Clock3, Database, ListChecks, Target } from "lucide-react";
import { QuickTutorial } from "@/components/commercial/quick-tutorial";

type Answers = Record<string, string | string[]>;
type Assessment = {
  overall_score: number | null;
  dimension_scores: Record<string, number>;
  evidence_status: Record<string, string>;
  answers?: Answers;
  created_at: string;
};
type Profile = {
  business_name?: string | null;
  specialty?: string | null;
  primary_offer?: string | null;
  target_90_days?: string | null;
  onboarding_status?: string | null;
  commercial_rules?: Record<string, unknown> | null;
} | null;

const DIMENSION_LABELS: Record<string, { title: string; description: string }> = {
  Estratégia: { title: "Estratégia e posicionamento", description: "Clareza sobre público, mercado e direção comercial." },
  Oferta: { title: "Oferta e proposta de valor", description: "Definição da oferta prioritária, ticket e percepção de valor." },
  Aquisição: { title: "Aquisição e percurso comercial", description: "Como as oportunidades chegam e avançam até a conversa de vendas." },
  Atendimento: { title: "Atendimento e vendas", description: "Velocidade, acompanhamento e condução das oportunidades." },
  Processo: { title: "Processo e indicadores", description: "Padronização, registro e capacidade de aprender com os resultados." },
  Governança: { title: "Governança e automação", description: "Consentimento, limites e segurança para escalar o atendimento." },
};

export default function CommercialDiagnosisPage() {
  const [profile, setProfile] = useState<Profile>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/commercial/onboarding")
      .then((response) => response.json())
      .then((data) => { setProfile(data.profile ?? null); setAssessment(data.assessments?.[0] ?? null); })
      .finally(() => setLoading(false));
  }, []);

  const scores = useMemo(() => assessment?.dimension_scores ?? {}, [assessment]);
  const priorities = useMemo(() => Object.entries(scores).sort(([, a], [, b]) => a - b).slice(0, 3), [scores]);
  const recommendations = useMemo(() => buildRecommendations(profile, assessment), [profile, assessment]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando diagnóstico…</div>;

  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <Link href="/commercial" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar ao comando comercial</Link>
    <header className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-sm font-medium text-primary">Diagnóstico comercial</p><h1 className="mt-1 text-2xl font-bold">{profile?.business_name || "Sua operação"}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Este relatório traduz o mapeamento em decisões práticas. Ele organiza hipóteses e recomendações; as evidências devem ser confirmadas no CRM, nas conversas e nos resultados reais.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/commercial/diagnosis/client" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ver versão para apresentar</Link><Link href="/commercial/onboarding" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">Atualizar diagnóstico</Link></div>
      </div>
    </header>
    {!assessment ? <EmptyState /> : <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Target} label="Maturidade comercial" value={`${assessment.overall_score ?? 0}/100`} /><Metric icon={Clock3} label="Status" value={profile?.onboarding_status === "needs_evidence" ? "Validar evidências" : "Em revisão"} /><Metric icon={Database} label="Oferta prioritária" value={profile?.primary_offer || "Não informada"} /><Metric icon={ListChecks} label="Prioridades" value={`${priorities.length} definidas`} /></section>

      <section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={ClipboardList} title="Resumo executivo" subtitle="O que já é possível afirmar com as informações fornecidas." /><div className="mt-5 grid gap-4 md:grid-cols-3"><Summary label="Segmento" value={profile?.specialty || "Ainda não informado"} /><Summary label="Objetivo para 90 dias" value={profile?.target_90_days || "Ainda não informado"} /><Summary label="Leitura atual" value={overallReading(assessment.overall_score)} /></div><p className="mt-5 rounded-xl bg-primary/5 p-4 text-sm leading-relaxed">A próxima etapa não é ativar automações indiscriminadamente. É confirmar as três prioridades abaixo, instrumentar o CRM e acompanhar os indicadores antes de ampliar o volume de oportunidades.</p></section>

      <section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={BarChart3} title="Leitura da operação" subtitle="Pontuações orientam a ordem de trabalho; não substituem os dados reais." /><div className="mt-5 grid gap-3 md:grid-cols-2">{Object.entries(scores).map(([key, value]) => <Dimension key={key} name={key} score={value} />)}</div></section>

      <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={Target} title="Prioridades recomendadas" subtitle="Comece pelo que tem maior potencial de destravar a operação." /><div className="mt-5 space-y-3">{priorities.map(([key, value], index) => <Priority key={key} index={index} name={key} score={value} recommendation={recommendations[index]} />)}</div></div><div className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={AlertTriangle} title="Evidências pendentes" subtitle="Itens que precisam ser confirmados antes de conclusões definitivas." /><div className="mt-5 space-y-3">{Object.entries(assessment.evidence_status ?? {}).map(([key, value]) => <div key={key} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><div><p className="font-medium">{formatKey(key)}</p><p className="mt-1 text-xs text-muted-foreground">{value === "available" ? "Disponível para análise." : "Ainda não validada. Solicitar dados, exemplos ou gravações."}</p></div></div>)}</div></div></section>

      <section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={ListChecks} title="Plano de implementação" subtitle="Sequência recomendada para os próximos 90 dias." /><div className="mt-5 grid gap-3 md:grid-cols-3"><Plan period="Dias 1–30" title="Organizar" text="Definir etapas do funil, campos obrigatórios, origem do lead, consentimento e próxima ação." /><Plan period="Dias 31–60" title="Padronizar" text="Implantar playbooks de resposta, follow-up, confirmação, recuperação de oportunidades e no-show." /><Plan period="Dias 61–90" title="Otimizar" text="Comparar canais, motivos de perda, conversão por etapa, tempo de resposta e desempenho da equipe." /></div></section>

      <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-border bg-card p-6"><SectionTitle title="Configuração que o CRM deverá receber" subtitle="A implementação transforma o diagnóstico em operação." /><ul className="mt-5 space-y-3 text-sm text-muted-foreground"><li>• Funil com etapas e critérios claros de avanço.</li><li>• Campos de origem, oferta, prioridade, consentimento e próxima ação.</li><li>• Tarefas automáticas para resposta e acompanhamento.</li><li>• Playbooks revisáveis para equipe e agente comercial.</li><li>• Painel com conversão, velocidade, perdas e receita.</li></ul></div><div className="rounded-2xl border border-border bg-card p-6"><SectionTitle title="Como o resultado será usado" subtitle="Cada área recebe uma orientação diferente." /><ul className="mt-5 space-y-3 text-sm text-muted-foreground"><li><strong className="text-foreground">Gestão:</strong> decide prioridades e aprova mudanças.</li><li><strong className="text-foreground">Equipe comercial:</strong> executa etapas, tarefas e roteiros.</li><li><strong className="text-foreground">Agente de IA:</strong> sugere respostas e próximos passos dentro dos limites aprovados.</li><li><strong className="text-foreground">Implementação:</strong> configura CRM, automações e indicadores.</li></ul></div></section>
    </>}
    <QuickTutorial title="Como interpretar o diagnóstico" steps={["Leia primeiro a linha de base e confira se os dados representam a operação real.", "Priorize dimensões com menor pontuação e maior impacto no objetivo de 90 dias.", "Separe fatos comprovados de respostas declaradas e evidências ainda ausentes.", "Use as prioridades aprovadas para criar o projeto e gerar o plano estratégico."]} note="Pontuação não é sentença: ela orienta investigação, priorização e acompanhamento da evolução." />
  </main>;
}

function buildRecommendations(profile: Profile, assessment: Assessment | null) {
  const answers = assessment?.answers ?? {};
  return [
    `Definir uma etapa de entrada e uma próxima ação obrigatória para cada oportunidade${answers.salesPath ? ` originada em ${answers.salesPath}` : ""}.`,
    `Padronizar o acompanhamento de leads sem resposta${answers.followup ? ` (modelo atual: ${answers.followup})` : ""}.`,
    `Validar a oferta prioritária${profile?.primary_offer ? ` “${profile.primary_offer}”` : ""} com dados de conversão, ticket e motivos de perda.`,
  ];
}

function overallReading(score: number | null | undefined) { if (score === null || score === undefined) return "Aguardando respostas"; if (score < 40) return "Fundação a estruturar"; if (score < 70) return "Processo parcialmente estruturado"; return "Boa base para otimização"; }
function formatKey(key: string) { return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function scoreLabel(score: number) { return score < 40 ? "Prioridade alta" : score < 70 ? "Aprimoramento necessário" : "Base consistente"; }
function SectionTitle({ icon: Icon, title, subtitle }: { icon?: typeof Target; title: string; subtitle?: string }) { return <div className="flex items-start gap-3">{Icon && <Icon className="mt-0.5 h-5 w-5 text-primary" />}<div><h2 className="font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div></div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) { return <div className="rounded-xl border border-border bg-card p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-bold">{value}</p></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-sm font-medium leading-relaxed">{value}</p></div>; }
function Dimension({ name, score }: { name: string; score: number }) { const meta = DIMENSION_LABELS[name]; return <div className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{meta?.title || name}</p><p className="mt-1 text-xs text-muted-foreground">{meta?.description}</p></div><span className="text-lg font-bold">{score}</span></div><div className="mt-3 h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${score < 40 ? "bg-amber-500" : score < 70 ? "bg-primary" : "bg-emerald-500"}`} style={{ width: `${Math.max(3, score)}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{scoreLabel(score)}</p></div>; }
function Priority({ index, name, score, recommendation }: { index: number; name: string; score: number; recommendation: string }) { return <div className="rounded-xl border border-border p-4"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</span><div><p className="font-medium">{DIMENSION_LABELS[name]?.title || name}</p><p className="mt-1 text-xs text-muted-foreground">Pontuação atual: {score}/100</p><p className="mt-3 text-sm leading-relaxed">{recommendation}</p></div></div></div>; }
function Plan({ period, title, text }: { period: string; title: string; text: string }) { return <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs font-medium text-primary">{period}</p><h3 className="mt-2 font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p></div>; }
function EmptyState() { return <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6"><div className="flex gap-3"><ClipboardList className="h-5 w-5 text-amber-600" /><div><h2 className="font-semibold">Diagnóstico ainda não preenchido</h2><p className="mt-1 text-sm text-muted-foreground">Responda ao mapeamento da operação para gerar o primeiro relatório.</p><Link href="/commercial/onboarding" className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Iniciar diagnóstico</Link></div></div></section>; }
