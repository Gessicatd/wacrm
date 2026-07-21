import { describe, expect, it } from 'vitest';
import { getResearchBaseCatalog } from './research-catalog';

describe('research base catalog', () => {
  it('versions the reusable research modules', () => {
    const catalog = getResearchBaseCatalog();
    expect(catalog.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(catalog.modules.map((module) => module.key)).toEqual([
      'market-sector',
      'benchmark',
      'icp-persona',
      'positioning',
      'offer-pricing',
    ]);
  });

  it('forbids unsourced observations and invented pricing', () => {
    const rules = getResearchBaseCatalog().policy.rules.join(' ');
    expect(rules).toContain('fonte');
    expect(rules).toContain('preço numérico');
    expect(rules).toContain('revisão humana');
  });
});
