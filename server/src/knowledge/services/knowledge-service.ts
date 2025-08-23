import { eventBus } from '@/shared/events/event-bus';
import { DocumentIngestedEvent, SyncJobStartedEvent, SyncJobCompletedEvent } from '@/shared/events/event-types';
import { logger } from '@/core/utils/logger';
import { embeddingService } from './embedding-service';
import { vectorStore, documentProcessor, vectorSearchService } from './index';

export interface DocumentIngestionRequest {
  documentId: string;
  projectId: string;
  content: string;
  type: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeSearchRequest {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface KnowledgeSearchResult {
  documents: Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    score: number;
  }>;
  totalCount: number;
  searchTime: number;
}

export class KnowledgeService {
  private initialized = false;

  constructor() {
    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for sync job events to coordinate knowledge updates
    eventBus.on<SyncJobStartedEvent>('sync-job-started', this.handleSyncJobStarted.bind(this));
    eventBus.on<SyncJobCompletedEvent>('sync-job-completed', this.handleSyncJobCompleted.bind(this));
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Knowledge Service...');

      // Initialize services if they have initialize methods
      if (typeof (embeddingService as any).initialize === 'function') {
        await (embeddingService as any).initialize();
      }

      if (typeof (vectorStore as any).initialize === 'function') {
        await (vectorStore as any).initialize();
      }

      if (typeof (documentProcessor as any).initialize === 'function') {
        await (documentProcessor as any).initialize();
      }

      if (typeof (vectorSearchService as any).initialize === 'function') {
        await (vectorSearchService as any).initialize();
      }

      this.initialized = true;
      logger.info('Knowledge Service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Knowledge Service');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Knowledge Service...');

      // Cleanup services in reverse order if they have cleanup methods
      if (typeof (vectorSearchService as any).cleanup === 'function') {
        await (vectorSearchService as any).cleanup();
      }
      if (typeof (documentProcessor as any).cleanup === 'function') {
        await (documentProcessor as any).cleanup();
      }
      if (typeof (vectorStore as any).cleanup === 'function') {
        await (vectorStore as any).cleanup();
      }
      if (typeof (embeddingService as any).cleanup === 'function') {
        await (embeddingService as any).cleanup();
      }

      this.initialized = false;
      logger.info('Knowledge Service cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Knowledge Service');
    }
  }

  async ingestDocument(request: DocumentIngestionRequest): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge Service not initialized');
    }

    const startTime = Date.now();

    try {
      logger.info({ 
        documentId: request.documentId, 
        projectId: request.projectId,
        type: request.type 
      }, 'Starting document ingestion');

      // Process document into chunks
      const processResult = await documentProcessor.processDocument(
        request.documentId,
        request.content,
        {
          documentType: request.type,
          sourceType: 'manual',
          sourceId: request.documentId,
          projectId: request.projectId,
          title: request.metadata?.title || request.documentId,
          path: request.metadata?.path,
          language: request.metadata?.language || 'en',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customFields: {
            ingestedAt: new Date().toISOString(),
            ...request.metadata
          }
        }
      );

      // The processDocument already generates vectors, so we can use them directly
      await vectorStore.upsert(processResult.vectors, request.projectId);

      // Emit event for successful ingestion
      eventBus.emit<DocumentIngestedEvent>('document-ingested', {
        documentId: request.documentId,
        projectId: request.projectId,
        type: request.type
      });

      const processingTime = Date.now() - startTime;
      logger.info({ 
        documentId: request.documentId,
        projectId: request.projectId,
        chunksCreated: processResult.chunks.length,
        vectorsStored: processResult.vectors.length,
        processingTime
      }, 'Document ingestion completed successfully');

    } catch (error) {
      logger.error({ 
        error, 
        documentId: request.documentId,
        projectId: request.projectId 
      }, 'Document ingestion failed');
      throw error;
    }
  }

  async searchKnowledge(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResult> {
    if (!this.initialized) {
      throw new Error('Knowledge Service not initialized');
    }

    const startTime = Date.now();

    try {
      logger.debug({ 
        query: request.query.substring(0, 100),
        projectId: request.projectId,
        limit: request.limit 
      }, 'Starting knowledge search');

      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(request.query);

      // Search vector store using the correct API
      const searchResults = await vectorStore.query({
        vector: queryEmbedding,
        topK: request.limit || 10,
        filter: {
          projectId: request.projectId,
          ...request.filters
        }
      });

      // Format results
      const documents = searchResults.results.map((match: any) => ({
        id: match.id,
        content: match.metadata?.content || '',
        metadata: match.metadata || {},
        score: match.score
      }));

      const searchTime = Date.now() - startTime;
      const result: KnowledgeSearchResult = {
        documents,
        totalCount: documents.length,
        searchTime
      };

      logger.debug({ 
        query: request.query.substring(0, 100),
        projectId: request.projectId,
        resultsCount: documents.length,
        searchTime
      }, 'Knowledge search completed');

      return result;

    } catch (error) {
      logger.error({ 
        error, 
        query: request.query.substring(0, 100),
        projectId: request.projectId 
      }, 'Knowledge search failed');
      throw error;
    }
  }

  private async handleSyncJobStarted(event: SyncJobStartedEvent): Promise<void> {
    logger.info({ 
      jobId: event.jobId,
      projectId: event.projectId,
      dataSourceType: event.dataSourceType 
    }, 'Sync job started - preparing knowledge base');

    // Could implement pre-sync preparation here
    // e.g., clearing old data, preparing indexes, etc.
  }

  private async handleSyncJobCompleted(event: SyncJobCompletedEvent): Promise<void> {
    logger.info({ 
      jobId: event.jobId,
      projectId: event.projectId,
      status: event.status,
      documentsProcessed: event.documentsProcessed 
    }, 'Sync job completed - knowledge base updated');

    // Could implement post-sync optimization here
    // e.g., index optimization, cache warming, etc.
  }

  // Health check method
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    embedding: boolean;
    vectorStore: boolean;
    details?: any;
  }> {
    try {
      const embeddingHealthy = typeof (embeddingService as any).healthCheck === 'function' 
        ? await (embeddingService as any).healthCheck() 
        : true;
      const vectorStoreHealthy = typeof (vectorStore as any).healthCheck === 'function' 
        ? await (vectorStore as any).healthCheck() 
        : true;

      return {
        status: (embeddingHealthy && vectorStoreHealthy) ? 'healthy' : 'unhealthy',
        embedding: embeddingHealthy,
        vectorStore: vectorStoreHealthy,
        details: {
          initialized: this.initialized,
          embeddingService: embeddingHealthy,
          vectorStore: vectorStoreHealthy
        }
      };
    } catch (error) {
      logger.error({ error }, 'Knowledge service health check failed');
      return {
        status: 'unhealthy',
        embedding: false,
        vectorStore: false,
        details: { error: (error as Error).message }
      };
    }
  }

  // Legacy compatibility method
  async healthCheck(): Promise<{
    embedding: boolean;
    vectorStore: boolean;
    overall: boolean;
  }> {
    const health = await this.getHealthStatus();
    return {
      embedding: health.embedding,
      vectorStore: health.vectorStore,
      overall: health.status === 'healthy'
    };
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();
