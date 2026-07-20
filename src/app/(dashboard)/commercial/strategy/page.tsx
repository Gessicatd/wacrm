"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Bot, ClipboardList, FileText, GitBranch, ListChecks, Target } from "lucide-react";

const sections = [
  { icon: ClipboardList, title: "1. Diagnóstico", description: "Mapeia maturidade, gargalos, origem dos leads, atendimento e capacidade de execução.", status: "Base pronta", href: "/commercial/diagnosis", action: "Abrir diagnóstico" },
  { icon: FileText, title: "2. Plano estratégico", description: "Transforma as evidências em posicionamento, prioridades, funil, metas e plano de 90 dias.", status: "Em construção", href: "/commercial/strategy-plan", action: "Abrir plano" },
  { icon: GitBranch, title: "3. Funil recomendado", description: "Define etapas, critérios de passagem, responsáveis, campos obrigatórios e próximos passos.", status: "Rascunho", href: "/commercial/funnel-builder", action: "Construir funil" },
  { icon: ListChecks, title: "4. Playbooks de execução", description: "Converte cada etapa em instruções práticas para atendimento, follow-up, no-show e recuperação.", status: "Rascunho", href: "/commercial/playbooks", action: "Ver playbooks" },
  { icon: BarChart3, title: "5. Indicadores e revisão", description: "Acompanha conversão, velocidade de resposta, perdas, origem e retorno para corrigir o plano.", status: "Planejado", href: "/marketing/attribution", action: "Ver atribuição" },
  { icon: Bot, title: "6. Agentes e automações", description: "Aplica a metodologia com agentes supervisionados, respeitando permissões e aprovação humana.", status: "Fundação pronta", href: "/commercial/agents", action: "Ver agentes" },
];

export default function StrategyHubPage() {
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <header className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-start gap-3"><Target className="mt-1 h-7 w-7 text-primary" /><div><p className="text-sm font-medium text-primary">Centro do plano estratégico</p><h1 className="mt-1 text-3xl font-bold">A estratégia é o coração da operação</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">Este é o caminho único para sair do diagnóstico e chegar a uma operação comercial executável. Cada bloco tem uma finalidade, uma evidência e um próximo passo claro.</p></div></div>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/commercial/onboarding" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Iniciar ou atualizar diagnóstico <ArrowRight className="h-4 w-4" /></Link><Link href="/commercial" className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium">Voltar à operação comercial</Link></div>
    </header>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sections.map(({ icon: Icon, title, description, status, href, action }) => <article key={title} className="flex flex-col rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><Icon className="h-5 w-5 text-primary" /><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">{status}</span></div><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p><Link href={href} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">{action}<ArrowRight className="h-4 w-4" /></Link></article>)}</section>
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><h2 className="font-semibold">Como usar este centro</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Sempre começamos pelo diagnóstico, validamos o plano com o proprietário, transformamos as decisões em funil e playbooks, e só então ativamos automações e agentes. O plano pode ser revisado a qualquer momento com novas evidências.</p></section>
  </main>;
}
