import type { SupabaseClient } from '@supabase/supabase-js'
export async function auditKnowledge(db: SupabaseClient, input: { accountId: string; actorId?: string | null; documentId?: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> }) {
  const safe = { ...input.metadata, content: undefined, text: undefined }
  const { error } = await db.from('knowledge_audit_logs').insert({ account_id: input.accountId, actor_id: input.actorId ?? null, document_id: input.documentId ?? null, action: input.action, entity_type: input.entityType, entity_id: input.entityId ?? null, metadata: safe })
  if (error) throw error
}
