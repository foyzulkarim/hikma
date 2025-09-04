// Export main knowledge service
export { knowledgeService, KnowledgeService } from './services/knowledge-service';
export type { 
  DocumentIngestionRequest, 
  KnowledgeSearchRequest, 
  KnowledgeSearchResult 
} from './services/knowledge-service';

// Export individual services
export * from './services';
export { EmbeddingService } from './services/embedding.service';
export { ChunkSyncService, chunkSyncService } from './services/chunk-sync.service';
export type { SyncOptions, SyncResult } from './services/chunk-sync.service';

// Export handlers
export { SearchHandler, searchHandler } from './handlers/search.handler';

// Export API routes
export { knowledgeRoutes } from './api/knowledge.routes';

// Export ingestion components
export * from './ingestion/connectors/base-connector';
export * from './ingestion/connectors/git-connector';
