import { describe, expect, it } from 'vitest';
import { validateResearchSource } from './research-source-validation';

describe('research source validation', () => {
  it('normalizes authorized source fields', () => {
    expect(
      validateResearchSource({
        title: ' Página A ',
        excerpt: ' Promessa observada. ',
        source_type: 'website',
        reference: 'https://example.com/oferta',
      })
    ).toMatchObject({ title: 'Página A', sourceType: 'website' });
  });

  it('rejects unsafe URL schemes and oversized excerpts', () => {
    expect(() =>
      validateResearchSource({ title: 'A', excerpt: 'B', reference: 'file:///x' })
    ).toThrow('http or https');
    expect(() =>
      validateResearchSource({
        title: 'A',
        excerpt: 'B',
        reference: 'javascript:alert(1)',
      })
    ).toThrow('http or https');
    expect(() =>
      validateResearchSource({ title: 'A', excerpt: 'x'.repeat(4001) })
    ).toThrow('maximum');
  });
});
