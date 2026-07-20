import { createHash } from 'node:crypto'
import type { KnowledgeDocumentInput, KnowledgeSourceType } from './types'
const sources: KnowledgeSourceType[] = ['manual','upload','transcription','pdf','playbook','internal']
export const MAX_DOCUMENT_CHARS = 2_000_000
export function checksum(value: string) { return createHash('sha256').update(value, 'utf8').digest('hex') }
export function validateDocumentInput(input: KnowledgeDocumentInput) {
  const title = input.title?.trim()
  if (!title || title.length > 240) throw new Error('title is required and must be <= 240 characters')
  if (input.description && input.description.length > 5000) throw new Error('description is too long')
  if (input.sourceType && !sources.includes(input.sourceType)) throw new Error('invalid sourceType')
  return { ...input, title, metadata: input.metadata ?? {} }
}
export function validateText(text: string) { if (!text?.trim()) throw new Error('content is required'); if (text.length > MAX_DOCUMENT_CHARS) throw new Error('content exceeds maximum size'); return text.trim() }
