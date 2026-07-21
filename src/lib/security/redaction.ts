const REDACTED = '[REDACTED]';
const SECRET_KEY =
  /(authorization|cookie|token|secret|password|api[-_]?key|client[-_]?secret|encryption[-_]?key)/i;

export function redactText(value: string): string {
  return value
    .replace(
      /\bOAuth\s+Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
      `OAuth Bearer ${REDACTED}`
    )
    .replace(/\b(Bearer|OAuth)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(
      /\b(access_token|refresh_token|client_secret|api_key|apikey|password)=([^&\s]+)/gi,
      `$1=${REDACTED}`
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      REDACTED
    );
}

export function sanitizeForLog(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (typeof value === 'string') return redactText(value).slice(0, 2000);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (value instanceof Error)
    return {
      name: value.name,
      message: redactText(value.message).slice(0, 500),
    };
  if (Array.isArray(value))
    return value
      .slice(0, 50)
      .map((item) => sanitizeForLog(item, depth + 1, seen));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? REDACTED : sanitizeForLog(item, depth + 1, seen),
      ])
  );
}
