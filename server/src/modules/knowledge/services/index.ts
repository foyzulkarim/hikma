import { QdrantVectorStore } from './vector-store';
import { DocumentProcessor } from './document-processor';
import { VectorSearchService } from './vector-search';
import { VectorStoreType } from '@/core/types/embeddings';
import type { IEmbeddingService, IVectorStore, IDocumentProcessor, IVectorSearchService, VectorStoreConfig } from '@/core/types/embeddings';

// Re-export services
import { embeddingService } from './embedding-service';
export { embeddingService };
export { QdrantVectorStore } from './vector-store';
export { DocumentProcessor } from './document-processor';
export { VectorSearchService } from './vector-search';

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

// Service instances
export const vectorStore = new QdrantVectorStore(defaultVectorStoreConfig);
export const documentProcessor = new DocumentProcessor();
export const vectorSearchService = new VectorSearchService();

// Knowledge service orchestrator
export class KnowledgeService {
  private embeddingService: IEmbeddingService;
  private vectorStore: IVectorStore;
  private documentProcessor: IDocumentProcessor;
  private vectorSearchService: IVectorSearchService;

  constructor(
    embeddingServiceParam?: IEmbeddingService,
    vectorStoreParam?: IVectorStore,
    documentProcessorParam?: IDocumentProcessor,
    vectorSearchServiceParam?: IVectorSearchService
  ) {
    this.embeddingService = embeddingServiceParam || embeddingService;
    this.vectorStore = vectorStoreParam || vectorStore;
    this.documentProcessor = documentProcessorParam || documentProcessor;
    this.vectorSearchService = vectorSearchServiceParam || vectorSearchService;
  }

  // Initialize all services
  async initialize(): Promise<void> {
    try {
      // Connect to vector store
      await this.vectorStore.connect();
      
      // Test embedding service (using concrete implementation)
      const concreteEmbeddingService = this.embeddingService as any;
      if (concreteEmbeddingService.testConnection) {
        const isEmbeddingReady = await concreteEmbeddingService.testConnection();
        if (!isEmbeddingReady) {
          throw new Error('Embedding service not ready');
        }
      }

      // Warm up services (using concrete implementation)
      if (concreteEmbeddingService.warmup) {
        await concreteEmbeddingService.warmup();
      }

      console.log('Knowledge service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize knowledge service:', error);
      throw error;
    }
  }

  // Cleanup all services
  async cleanup(): Promise<void> {
    try {
      await this.vectorStore.disconnect();
      console.log('Knowledge service cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup knowledge service:', error);
      throw error;
    }
  }

  // Health check for all services
  async healthCheck(): Promise<{
    embedding: boolean;
    vectorStore: boolean;
    overall: boolean;
  }> {
    try {
      const concreteEmbeddingService = this.embeddingService as any;
      const embeddingHealth = concreteEmbeddingService.testConnection ? 
        await concreteEmbeddingService.testConnection() : true;
      const vectorStoreHealth = await this.vectorStore.testConnection();

      return {
        embedding: embeddingHealth,
        vectorStore: vectorStoreHealth,
        overall: embeddingHealth && vectorStoreHealth,
      };
    } catch (error) {
      return {
        embedding: false,
        vectorStore: false,
        overall: false,
      };
    }
  }

  // Get service instances
  getEmbeddingService() {
    return this.embeddingService;
  }

  getVectorStore() {
    return this.vectorStore;
  }

  getDocumentProcessor() {
    return this.documentProcessor;
  }

  getSearchService() {
    return this.vectorSearchService;
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();

// Export all types
export * from '@/core/types/embeddings';

