import { describe, expect, it } from 'vitest';
import { runDiagnosisStrategyAgent } from './agent-runtime';
import { runSimulatedResearch } from './research-runtime';

describe('simulated research provider', () => {
  it('does not invent observations when no sources exist', () => {
    const result = runSimulatedResearch(
      runDiagnosisStrategyAgent(null, null).output,
      []
    );
    expect(result.output.status).toBe('needs_sources');
    expect(result.output.observations).toEqual([]);
    expect(
      result.evidence.some((item) =>
        item.limitations.includes(
          'Nenhuma navegação ou validação externa foi executada.'
        )
      )
    ).toBe(true);
  });

  it('ties every observation to its supplied source', () => {
    const strategy = runDiagnosisStrategyAgent(
      { specialty: 'Estética' },
      null
    ).output;
    const result = runSimulatedResearch(strategy, [
      { id: 'a', title: 'Página A', excerpt: 'Promessa observada.' },
    ]);
    expect(result.output.status).toBe('ready_for_review');
    expect(result.output.observations).toEqual([
      { source_id: 'a', observation: 'Promessa observada.' },
    ]);
    expect(result.evidence.some((item) => item.source === 'a')).toBe(true);
  });
});
