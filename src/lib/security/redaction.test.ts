import { describe, expect, it } from 'vitest';
import { redactText, sanitizeForLog } from './redaction';

describe('security log redaction', () => {
  it('redacts authorization headers and OAuth tokens', () => {
    expect(redactText('Authorization: Bearer abc.def-123')).not.toContain(
      'abc.def-123'
    );
    expect(redactText('refresh_token=super-secret&status=failed')).toBe(
      'refresh_token=[REDACTED]&status=failed'
    );
  });

  it('redacts secret-shaped object keys recursively', () => {
    const sanitized = sanitizeForLog({
      provider: 'meta',
      nested: {
        access_token: 'raw-token',
        clientSecret: 'raw-secret',
        status: 'failed',
      },
    });
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('raw-token');
    expect(serialized).not.toContain('raw-secret');
    expect(serialized).toContain('failed');
  });

  it('sanitizes error messages without returning stack traces', () => {
    const sanitized = sanitizeForLog(
      new Error('OAuth Bearer token-value failed')
    );
    expect(JSON.stringify(sanitized)).toContain('[REDACTED]');
    expect(JSON.stringify(sanitized)).not.toContain('token-value');
    expect(sanitized).not.toHaveProperty('stack');
  });
});
