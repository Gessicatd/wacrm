import type { SupabaseClient } from '@supabase/supabase-js'
import { auditKnowledge } from './audit'
import { chunkText } from './chunks'
import { checksum, validateText } from './validation'
import type { KnowledgeIngestionResult } from './types'
export async function ingestText(db: SupabaseClient, input: { accountId:string; actorId:string; documentId:string; text:string; idempotencyKey:string; maxChars?:number; overlapChars?:number }): Promise<KnowledgeIngestionResult> {
  const text=validateText(input.text); const digest=checksum(text)
  const existing=await db.from('knowledge_document_versions').select('id,document_id').eq('account_id',input.accountId).eq('checksum',digest).maybeSingle(); if(existing.data) return {documentId:input.documentId,versionId:existing.data.id,chunkCount:0,deduplicated:true}
  const latest=await db.from('knowledge_document_versions').select('version_number').eq('account_id',input.accountId).eq('document_id',input.documentId).order('version_number',{ascending:false}).limit(1).maybeSingle(); const version=(latest.data?.version_number??0)+1
  const versionResult=await db.from('knowledge_document_versions').insert({account_id:input.accountId,document_id:input.documentId,version_number:version,content:text,checksum:digest,status:'processing',created_by:input.actorId}).select().single(); if(versionResult.error||!versionResult.data) throw versionResult.error??new Error('version creation failed')
  const chunks=chunkText(text,{maxChars:input.maxChars,overlapChars:input.overlapChars}); const rows=chunks.map(c=>({account_id:input.accountId,document_id:input.documentId,version_id:versionResult.data.id,chunk_index:c.index,content:c.content,checksum:c.checksum,token_count:c.tokenCount,metadata:c.metadata??{}})); const inserted=await db.from('knowledge_chunks').insert(rows); if(inserted.error) { await db.from('knowledge_document_versions').update({status:'error'}).eq('id',versionResult.data.id); throw inserted.error }
  const job=await db.from('knowledge_ingestion_jobs').insert({account_id:input.accountId,document_id:input.documentId,version_id:versionResult.data.id,idempotency_key:input.idempotencyKey,status:'completed',attempts:1,requested_by:input.actorId,started_at:new Date().toISOString(),completed_at:new Date().toISOString()}).select('id').maybeSingle()
  await db.from('knowledge_document_versions').update({status:'ready'}).eq('id',versionResult.data.id); await db.from('knowledge_documents').update({status:'active',checksum:digest,current_version_id:versionResult.data.id,updated_at:new Date().toISOString()}).eq('account_id',input.accountId).eq('id',input.documentId); await auditKnowledge(db,{accountId:input.accountId,actorId:input.actorId,documentId:input.documentId,action:'ingested',entityType:'version',entityId:versionResult.data.id,metadata:{chunk_count:chunks.length,checksum:digest}})
  return {documentId:input.documentId,versionId:versionResult.data.id,jobId:job.data?.id,chunkCount:chunks.length,deduplicated:false}
}
