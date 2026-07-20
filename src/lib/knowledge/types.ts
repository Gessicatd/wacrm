export type KnowledgeDocumentStatus = 'draft' | 'active' | 'archived' | 'error'
export type KnowledgeSourceType = 'manual' | 'upload' | 'transcription' | 'pdf' | 'playbook' | 'internal'
export type KnowledgeJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
export interface KnowledgeDocumentInput { title: string; description?: string | null; sourceType?: KnowledgeSourceType; sourceUri?: string | null; mimeType?: string | null; metadata?: Record<string, unknown> }
export interface KnowledgeChunk { index: number; content: string; checksum: string; tokenCount: number; metadata?: Record<string, unknown> }
export interface EmbeddingProvider { embed(input: string[]): Promise<number[][]> }
export interface KnowledgeIngestionResult { documentId: string; versionId: string; jobId?: string; chunkCount: number; deduplicated: boolean }
