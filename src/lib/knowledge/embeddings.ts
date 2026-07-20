import type { EmbeddingProvider } from './types'
export class NotConfiguredEmbeddingProvider implements EmbeddingProvider { async embed(): Promise<number[][]> { throw new Error('Embedding provider is not configured') } }
