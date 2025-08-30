// Export main knowledge service
export { knowledgeService, KnowledgeService } from './services/knowledge-service';
export type { 
  DocumentIngestionRequest, 
  KnowledgeSearchRequest, 
  KnowledgeSearchResult 
} from './services/knowledge-service';

// Export individual services
export * from './services';

// Export ingestion components
export * from './ingestion/connectors/base-connector';
export * from './ingestion/connectors/git-connector';
