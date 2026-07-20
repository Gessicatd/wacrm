import type { AccountRole } from '@/lib/auth/roles'
export function canWriteKnowledge(role: AccountRole) { return role === 'owner' || role === 'admin' }
export function canReadKnowledge(role: AccountRole) { return ['owner','admin','agent','viewer'].includes(role) }
