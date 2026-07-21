import { describe, expect, it } from 'vitest';
import {
  CONSULTING_AGENT_CATALOG,
  runDiagnosisStrategyAgent,
} from './agent-runtime';

describe('consulting agent runtime', () => {
  it('declares tools, required inputs and a governed output schema', () => {
    const definition = CONSULTING_AGENT_CATALOG['diagnosis-strategy-v1'];
    expect(definition.allowed_tools).toEqual([
      'read_commercial_profile',
      'read_latest_assessment',
      'build_strategy_plan',
    ]);
    expect(definition.output_schema.properties.requires_human_review).toEqual({
      const: true,
    });
  });

  it('generates an in-review strategic result without external research', () => {
    const result = runDiagnosisStrategyAgent(
      { specialty: 'Clínica estética', primary_offer: 'Programa premium' },
      {
        answers: { goal: 'Organizar vendas' },
        dimension_scores: { Estratégia: 2 },
      }
    );
    expect(result.artifact_type).toBe('strategic_plan');
    expect(result.requires_human_review).toBe(true);
    expect(result.output.version).toContain('revisão humana');
    expect(
      result.evidence.some((item) =>
        item.limitations.includes('Não inclui pesquisa externa real.')
      )
    ).toBe(true);
    expect(result.tools.every((tool) => tool.status === 'completed')).toBe(
      true
    );
  });

  it('keeps missing sources explicit instead of inventing data', () => {
    const result = runDiagnosisStrategyAgent(null, null);
    expect(
      result.tools.filter((tool) => tool.status === 'skipped')
    ).toHaveLength(2);
    expect(result.output.evidenceNeeded.length).toBeGreaterThan(0);
  });
});
