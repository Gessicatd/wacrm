import { describe, expect, it } from 'vitest';
import { applyHumanStyleGuardrails, HUMAN_STYLE_POLICY_VERSION } from './human-style-policy';
describe('human style policy', () => {
  it('removes common AI openings and inflated wording', () => {
    expect(applyHumanStyleGuardrails('No mundo de hoje, vamos otimizar a jornada.')).toBe('vamos ajustar a processo.');
  });
  it('has a versioned policy for agent definitions', () => { expect(HUMAN_STYLE_POLICY_VERSION).toBe('human-direct-v1'); });
});
