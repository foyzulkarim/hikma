// Embedding service
export {
  OpenAIEmbeddingService,
  embeddingService,
  TokenEstimator,
  RateLimiter,
} from './embedding-service.js';

// Vector store
export {
  PineconeVectorStore,
  vectorStore,
} from './vector-store.js';

// Document processor
export {
  DocumentProcessor,
  documentProcessor,
  TextChunker,
} from './document-processor.js';

// Vector search
export {
  VectorSearchService,
  vectorSearchService,
  SearchResultRanker,
  KeywordSearcher,
} from './vector-search.js';

// Knowledge service orchestrator
export class KnowledgeService {
  constructor(
    private embeddingService = embeddingService,
    private vectorStore = vectorStore,
    private documentProcessor = documentProcessor,
    private searchService = vectorSearchService
  ) {}

  // Initialize all services
  async initialize(): Promise<void> {
    try {
      // Connect to vector store
      await this.vectorStore.connect();
      
      // Test embedding service
      const isEmbeddingReady = await this.embeddingService.testConnection();
      if (!isEmbeddingReady) {
        throw new Error('Embedding service not ready');
      }

      // Warm up services
      await this.embeddingService.warmup();

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
      const embeddingHealth = await this.embeddingService.testConnection();
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
    return this.searchService;
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();

// Export all types
export * from '@/core/types/embeddings.js';

