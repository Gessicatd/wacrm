import type { StrategyPlan } from '@/lib/commercial/strategy-plan';
import type { AgentEvidence, ToolExecutionLog } from './agent-runtime';
import { getResearchBaseCatalog } from './research-catalog';

export type ResearchSource = {
  id: string;
  title: string;
  excerpt: string;
  reference?: string;
};

export function runSimulatedResearch(strategy: StrategyPlan, input: unknown) {
  const sources: ResearchSource[] = Array.isArray(input)
    ? input.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const value = item as Record<string, unknown>;
        if (
          typeof value.title !== 'string' ||
          typeof value.excerpt !== 'string' ||
          !value.title.trim() ||
          !value.excerpt.trim()
        )
          return [];
        return [
          {
            id:
              typeof value.id === 'string' && value.id.trim()
                ? value.id.trim().slice(0, 120)
                : `source-${index + 1}`,
            title: value.title.trim().slice(0, 240),
            excerpt: value.excerpt.trim().slice(0, 4000),
            reference:
              typeof value.reference === 'string'
                ? value.reference.trim().slice(0, 1000)
                : undefined,
          },
        ];
      })
    : [];
  const evidence: AgentEvidence[] = [
    {
      kind: 'fact',
      source: 'approved_strategic_plan',
      summary: 'Plano aprovado usado como briefing.',
      confidence: 1,
      limitations: ['Dados declarados continuam sujeitos a comprovação.'],
      requires_human_review: true,
    },
    ...sources.map((source) => ({
      kind: 'fact' as const,
      source: source.id,
      summary: source.title,
      confidence: 0.8,
      limitations: ['Trecho fornecido; conferir o contexto integral.'],
      requires_human_review: true,
    })),
    {
      kind: 'hypothesis',
      source: 'methodology-corpus',
      summary: 'Hipóteses organizadas pelas dimensões da metodologia.',
      confidence: 0.5,
      limitations: ['Nenhuma navegação ou validação externa foi executada.'],
      requires_human_review: true,
    },
  ];
  const tools: ToolExecutionLog[] = [
    {
      tool: 'read_approved_strategy',
      status: 'completed',
      summary: 'Briefing estratégico carregado.',
    },
    {
      tool: 'read_supplied_sources',
      status: sources.length ? 'completed' : 'skipped',
      summary: sources.length
        ? `${sources.length} fonte(s) processada(s).`
        : 'Nenhuma fonte fornecida.',
    },
    {
      tool: 'build_benchmark_matrix',
      status: sources.length ? 'completed' : 'skipped',
      summary: sources.length
        ? 'Observações vinculadas às fontes.'
        : 'Matriz aguarda fontes.',
    },
  ];
  return {
    agent_key: 'research-benchmark-v1' as const,
    artifact_type: 'market_research' as const,
    title: `Pesquisa e benchmark — ${strategy.positioning.specialty}`,
    output: {
      research_base: getResearchBaseCatalog(),
      mode: 'simulated' as const,
      status: sources.length
        ? ('ready_for_review' as const)
        : ('needs_sources' as const),
      research_questions: strategy.market.questions,
      observations: sources.map((source) => ({
        source_id: source.id,
        observation: source.excerpt,
      })),
      benchmark_dimensions: [
        'Público e consciência',
        'Problema e promessa',
        'Mecanismo e diferenciais',
        'Oferta e preço publicado',
        'Provas',
        'CTA e funil',
      ],
      missing_evidence: sources.length
        ? ['Confirmar observações em fontes adicionais.']
        : [
            'Adicionar páginas, anúncios, propostas ou transcrições autorizadas.',
            'Registrar ao menos três referências comparáveis.',
          ],
      next_actions: sources.length
        ? [
            'Revisar observações contra as fontes.',
            'Aprovar decisões antes de gerar ICP/persona.',
          ]
        : ['Anexar fontes autorizadas.', 'Executar novamente o agente.'],
    },
    evidence,
    tools,
    requires_human_review: true as const,
  };
}
