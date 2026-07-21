import {
  buildStrategyPlan,
  type StrategyPlan,
} from '@/lib/commercial/strategy-plan';

export type EvidenceKind =
  'fact' | 'hypothesis' | 'inference' | 'recommendation';

export interface AgentEvidence {
  kind: EvidenceKind;
  source: string;
  summary: string;
  confidence: number;
  limitations: string[];
  requires_human_review: boolean;
}

export interface ToolExecutionLog {
  tool: string;
  status: 'completed' | 'skipped';
  summary: string;
}

export interface DiagnosisAgentResult {
  agent_key: 'diagnosis-strategy-v1';
  schema_version: '1.0';
  artifact_type: 'strategic_plan';
  title: string;
  output: StrategyPlan;
  evidence: AgentEvidence[];
  tools: ToolExecutionLog[];
  requires_human_review: true;
}

export const CONSULTING_AGENT_CATALOG = {
  'diagnosis-strategy-v1': {
    name: 'Diagnóstico e Estratégia',
    objective:
      'Transformar onboarding e assessment em um plano estratégico rastreável, sem inventar pesquisa ou números.',
    allowed_tools: [
      'read_commercial_profile',
      'read_latest_assessment',
      'build_strategy_plan',
    ],
    required_inputs: ['commercial_profile', 'commercial_assessment'],
    output_schema: {
      type: 'object',
      required: [
        'agent_key',
        'schema_version',
        'artifact_type',
        'title',
        'output',
        'evidence',
        'tools',
        'requires_human_review',
      ],
      properties: {
        artifact_type: { const: 'strategic_plan' },
        evidence: { type: 'array' },
        requires_human_review: { const: true },
      },
    },
  },
  'research-benchmark-v1': {
    name: 'Pesquisa e Benchmark',
    objective:
      'Personalizar a pesquisa-base usando somente plano aprovado e fontes autorizadas rastreáveis.',
    allowed_tools: [
      'read_approved_strategy',
      'read_supplied_sources',
      'build_benchmark_matrix',
    ],
    required_inputs: ['approved_strategic_plan', 'authorized_sources'],
    output_schema: {
      type: 'object',
      required: ['agent_key', 'artifact_type', 'output', 'evidence', 'tools'],
      properties: {
        artifact_type: { const: 'market_research' },
        requires_human_review: { const: true },
      },
    },
  },
} as const;

function evidence(
  profile: Record<string, unknown> | null,
  assessment: Record<string, unknown> | null
): AgentEvidence[] {
  const items: AgentEvidence[] = [];
  if (profile)
    items.push({
      kind: 'fact',
      source: 'commercial_profiles',
      summary: 'Perfil comercial mais recente da conta.',
      confidence: 1,
      limitations: [
        'Dados declarados pelo usuário e ainda sujeitos a revisão.',
      ],
      requires_human_review: true,
    });
  if (assessment)
    items.push({
      kind: 'fact',
      source: 'commercial_assessments',
      summary: 'Assessment comercial mais recente da conta.',
      confidence: 1,
      limitations: [
        'Respostas declaradas; métricas operacionais ainda precisam de comprovação.',
      ],
      requires_human_review: true,
    });
  items.push({
    kind: 'inference',
    source: 'methodology-corpus',
    summary:
      'Prioridades e plano derivados deterministicamente da metodologia estruturada.',
    confidence: 0.75,
    limitations: [
      'Não inclui pesquisa externa real.',
      'Não substitui validação do proprietário ou gestor.',
    ],
    requires_human_review: true,
  });
  return items;
}

export function runDiagnosisStrategyAgent(
  profile: Record<string, unknown> | null,
  assessment: Record<string, unknown> | null
): DiagnosisAgentResult {
  const plan = buildStrategyPlan(profile, assessment);
  return {
    agent_key: 'diagnosis-strategy-v1',
    schema_version: '1.0',
    artifact_type: 'strategic_plan',
    title: plan.title,
    output: plan,
    evidence: evidence(profile, assessment),
    tools: [
      {
        tool: 'read_commercial_profile',
        status: profile ? 'completed' : 'skipped',
        summary: profile
          ? 'Perfil carregado.'
          : 'Perfil não disponível; lacuna mantida no plano.',
      },
      {
        tool: 'read_latest_assessment',
        status: assessment ? 'completed' : 'skipped',
        summary: assessment
          ? 'Assessment carregado.'
          : 'Assessment não disponível; lacuna mantida no plano.',
      },
      {
        tool: 'build_strategy_plan',
        status: 'completed',
        summary: 'Plano determinístico gerado em modo de revisão.',
      },
    ],
    requires_human_review: true,
  };
}
