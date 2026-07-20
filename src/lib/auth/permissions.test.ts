import { describe, expect, it } from 'vitest';
import { canUseModule, normalizePermission } from './permissions';

describe('module permissions', () => {
  it('keeps admin access while allowing granular agent access', () => {
    expect(canUseModule('admin', [], 'marketing', 'approve')).toBe(true);
    expect(canUseModule('agent', [{ module: 'commercial', can_view: true, can_edit: true, can_approve: false }], 'commercial', 'edit')).toBe(true);
    expect(canUseModule('agent', [{ module: 'commercial', can_view: true, can_edit: true, can_approve: false }], 'marketing', 'view')).toBe(false);
  });

  it('makes higher permissions imply the lower permission', () => {
    expect(normalizePermission('marketing', { can_approve: true })).toEqual({ module: 'marketing', can_view: true, can_edit: true, can_approve: true });
  });
});
