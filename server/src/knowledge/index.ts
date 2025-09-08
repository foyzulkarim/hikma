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

// Smart Retrieval System Exports (only export what's not in ./services)
export * from './services/query-classifier.service';
export * from './services/query-processor.service';
export * from './services/graph-retrieval.service';
export * from './services/result-fusion.service';
export * from './services/personalization.service';
export * from './services/search-analytics.service';
export * from './services/search-cache.service';
export * from './services/smart-retrieval-orchestrator.service';

// Strategies
export * from './strategies';

// Smart Retrieval Types are exported through services to avoid conflicts

// Main orchestrator for easy access
export { SmartRetrievalOrchestratorService as SmartRetrieval } from './services/smart-retrieval-orchestrator.service';
