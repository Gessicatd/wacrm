const TYPES = new Set([
  'website',
  'ad',
  'proposal',
  'interview',
  'transcript',
  'report',
  'internal',
  'other',
]);

export function validateResearchSource(input: unknown) {
  const value = (input ?? {}) as Record<string, unknown>;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const excerpt = typeof value.excerpt === 'string' ? value.excerpt.trim() : '';
  const sourceType =
    typeof value.source_type === 'string' && TYPES.has(value.source_type)
      ? value.source_type
      : 'other';
  const reference =
    typeof value.reference === 'string' ? value.reference.trim() : '';
  if (!title) throw new Error('title is required');
  if (!excerpt) throw new Error('excerpt is required');
  if (title.length > 240) throw new Error('title exceeds the maximum length');
  if (excerpt.length > 4000)
    throw new Error('excerpt exceeds the maximum length');
  if (reference.length > 1000)
    throw new Error('reference exceeds the maximum length');
  if (reference && /^[a-z][a-z\d+.-]*:/i.test(reference)) {
    const url = new URL(reference);
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('reference must use http or https');
    url.username = '';
    url.password = '';
    return { title, excerpt, sourceType, reference: url.toString() };
  }
  return { title, excerpt, sourceType, reference: reference || null };
}
