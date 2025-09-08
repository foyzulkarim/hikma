import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logger } from '@/core/utils/logger';
import { ValidationError, ProcessingError } from '@/core/errors/app-error';
import { VectorService } from '@/config/vector-db';
import { EmbeddingService } from '../services/embedding.service';
import { ChunkSyncService } from '../services/chunk-sync.service';

// Request schema
const SearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  project_id: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
  filters: z.object({
    document_id: z.string().optional(),
    chunk_index_min: z.number().optional(),
    chunk_index_max: z.number().optional(),
  }).optional(),
});

// Response types
interface SearchResult {
  id: string;
  content: string;
  document_id: string;
  project_id?: string;
  chunk_index: number;
  score: number;
  metadata?: Record<string, any>;
}

interface SearchResponse {
  success: boolean;
  data: {
    results: SearchResult[];
    total: number;
    query: string;
    execution_time: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class SearchHandler {
  private vectorService: VectorService;
  private embeddingService: EmbeddingService;
  private chunkSyncService: ChunkSyncService;

  constructor() {
    this.vectorService = new VectorService();
    this.embeddingService = new EmbeddingService();
    this.chunkSyncService = new ChunkSyncService();
  }

  /**
   * Handle semantic search requests
   */
  async handleSearch(
    request: FastifyRequest<{
      Body: z.infer<typeof SearchRequestSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate request body
      const validation = SearchRequestSchema.safeParse(request.body);
      if (!validation.success) {
        throw new ValidationError(
          'Invalid search request',
          validation.error.errors
        );
      }

      const { query, project_id, limit, filters } = validation.data;
      const userId = (request as any).user?.id;

      logger.info({
        correlationId: request.id,
        userId,
        projectId: project_id,
        query: query.substring(0, 100),
        limit,
      }, 'Processing semantic search request');

      // Generate embedding for the search query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Prepare search filters
      const searchFilters: Record<string, any> = {};
      if (project_id) {
        searchFilters.project_id = project_id;
      }
      if (filters?.document_id) {
        searchFilters.document_id = filters.document_id;
      }
      if (filters?.chunk_index_min !== undefined) {
        searchFilters.chunk_index_min = filters.chunk_index_min;
      }
      if (filters?.chunk_index_max !== undefined) {
        searchFilters.chunk_index_max = filters.chunk_index_max;
      }

      // Perform vector search
      const searchResults = await this.vectorService.searchChunks(
        queryEmbedding,
        {
          limit,
          projectId: project_id,
          fileId: filters?.document_id,
          filter: searchFilters,
        }
      );

      // Transform results
      const results: SearchResult[] = searchResults.results.map(result => ({
        id: result.payload.chunk_id,
        content: result.payload.content,
        document_id: result.payload.file_id as string,
        project_id: result.payload.project_id,
        chunk_index: result.payload.chunk_index as number,
        score: result.score,
        metadata: result.payload.metadata,
      }));

      const executionTime = Date.now() - startTime;

      const response: SearchResponse = {
        success: true,
        data: {
          results,
          total: results.length,
          query,
          execution_time: executionTime,
        },
      };

      logger.info({
        correlationId: request.id,
        userId,
        projectId: project_id,
        resultsCount: results.length,
        executionTime,
      }, 'Semantic search completed successfully');

      reply.code(200).send(response);

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        executionTime,
      }, 'Semantic search failed');

      if (error instanceof ValidationError) {
        const response: SearchResponse = {
          success: false,
          data: {
            results: [],
            total: 0,
            query: request.body?.query || '',
            execution_time: executionTime,
          },
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        };
        reply.code(400).send(response);
      } else if (error instanceof ProcessingError) {
        const response: SearchResponse = {
          success: false,
          data: {
            results: [],
            total: 0,
            query: request.body?.query || '',
            execution_time: executionTime,
          },
          error: {
            code: 'PROCESSING_ERROR',
            message: error.message,
          },
        };
        reply.code(422).send(response);
      } else {
        const response: SearchResponse = {
          success: false,
          data: {
            results: [],
            total: 0,
            query: request.body?.query || '',
            execution_time: executionTime,
          },
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal error occurred during search',
          },
        };
        reply.code(500).send(response);
      }
    }
  }

  /**
   * Handle search statistics requests
   */
  async handleSearchStats(
    request: FastifyRequest<{
      Querystring: {
        project_id?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { project_id } = request.query;
      const userId = (request as any).user?.id;

      logger.info({
        correlationId: request.id,
        userId,
        projectId: project_id,
      }, 'Fetching search statistics');

      // Get sync statistics
      const syncStats = await this.chunkSyncService.getSyncStats(project_id);

      // Get vector store statistics
      const vectorStats = await this.vectorService.getStats();

      const response = {
        success: true,
        data: {
          sync_stats: syncStats,
          vector_stats: vectorStats,
        },
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }, 'Failed to fetch search statistics');

      reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch search statistics',
        },
      });
    }
  }
}

// Export singleton instance
export const searchHandler = new SearchHandler();