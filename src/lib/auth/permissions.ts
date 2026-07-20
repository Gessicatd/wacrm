import type { AccountRole } from './roles';

export const MODULES = ['client', 'commercial', 'marketing', 'automation', 'knowledge', 'reports', 'settings'] as const;
export type PermissionModule = (typeof MODULES)[number];
export type PermissionAction = 'view' | 'edit' | 'approve';
export type ModulePermission = { module: PermissionModule; can_view: boolean; can_edit: boolean; can_approve: boolean };

export function roleHasModuleAccess(role: AccountRole, action: PermissionAction) {
  if (role === 'owner' || role === 'admin') return true;
  return action === 'view' ? role === 'agent' : false;
}

export function canUseModule(role: AccountRole, permissions: ModulePermission[], module: PermissionModule, action: PermissionAction = 'view') {
  if (roleHasModuleAccess(role, action) && (role === 'owner' || role === 'admin')) return true;
  const configured = permissions.find((permission) => permission.module === module);
  if (!configured) return false;
  return action === 'edit' ? configured.can_edit : action === 'approve' ? configured.can_approve : configured.can_view;
}

export function normalizePermission(module: PermissionModule, input: Partial<ModulePermission>): ModulePermission {
  const canView = Boolean(input.can_view || input.can_edit || input.can_approve);
  const canEdit = Boolean(input.can_edit || input.can_approve);
  return { module, can_view: canView, can_edit: canEdit, can_approve: Boolean(input.can_approve && canEdit) };
}
