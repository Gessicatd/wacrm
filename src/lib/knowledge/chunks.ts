import { checksum } from './validation'
import type { KnowledgeChunk } from './types'
export interface ChunkOptions { maxChars?: number; overlapChars?: number }
export function chunkText(text: string, options: ChunkOptions = {}): KnowledgeChunk[] {
  const max = Math.max(100, options.maxChars ?? 4000); const overlap = Math.max(0, Math.min(options.overlapChars ?? 400, max - 1)); const out: KnowledgeChunk[] = []
  let start = 0; let index = 0
  while (start < text.length) { let end = Math.min(text.length, start + max); if (end < text.length) { const boundary = text.lastIndexOf('\n', end); if (boundary > start + max * .5) end = boundary } const content = text.slice(start, end).trim(); if (content) out.push({ index, content, checksum: checksum(content), tokenCount: content.split(/\s+/).length }); if (end >= text.length) break; start = Math.max(start + 1, end - overlap); index++ }
  return out
}
