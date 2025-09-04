import { QdrantVectorStore } from './vector-store';
import { DocumentProcessor } from './document-processor';
import { VectorSearchService } from './vector-search';
import { VectorStoreType } from '@/core/types/embeddings';
import type { IEmbeddingService, IVectorStore, IDocumentProcessor, IVectorSearchService, VectorStoreConfig } from '@/core/types/embeddings';

// Re-export services
import { embeddingService } from './embedding.service';
export { embeddingService };
export { QdrantVectorStore } from './vector-store';
export { DocumentProcessor } from './document-processor';
export { VectorSearchService } from './vector-search';

// Export new knowledge service (replaces old implementation)
export { KnowledgeService, knowledgeService } from './knowledge-service';
export type { DocumentIngestionRequest, KnowledgeSearchRequest, KnowledgeSearchResult } from './knowledge-service';

// Re-export types
export type { IEmbeddingService, IVectorStore, IDocumentProcessor, IVectorSearchService } from '@/core/types/embeddings';

// Default vector store configuration
const defaultVectorStoreConfig: VectorStoreConfig = {
  type: VectorStoreType.QDRANT,
  indexName: process.env.QDRANT_COLLECTION_NAME || 'hikma-embeddings',
  dimensions: parseInt(process.env.QDRANT_DIMENSION || '1536', 10),
  metric: 'cosine',
  apiKey: process.env.QDRANT_API_KEY || '',
  baseUrl: process.env.QDRANT_URL || 'http://localhost:6333'
};

// Service instances (for backward compatibility)
export const vectorStore = new QdrantVectorStore(defaultVectorStoreConfig);
export const documentProcessor = new DocumentProcessor();
export const vectorSearchService = new VectorSearchService();

// Export all types
export * from '@/core/types/embeddings';
