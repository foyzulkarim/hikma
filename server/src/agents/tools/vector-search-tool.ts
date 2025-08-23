import {
  ITool,
  ToolType,
  PipelineContext,
} from '@/core/types/agents';
import {
  VectorSearchOptions,
  VectorSearchResponse,
  VectorFilter,
} from '@/core/types/embeddings';
import { vectorSearchService } from '@/knowledge/services/vector-search';
import { logger } from '@/core/utils/logger';
import { ValidationError } from '@/core/errors/app-error';

// Vector search tool input interface
export interface VectorSearchInput {
  query: string;
  projectId?: string;
  topK?: number;
  threshold?: number;
  filters?: VectorFilter;
  namespace?: string; // Qdrant does not directly use namespaces, but can be used for metadata filtering
  includeMetadata?: boolean;
  rerank?: boolean;
}

// Vector search tool output interface
export interface VectorSearchOutput {
  results: Array<{
    id: string;
    score: number;
    title: string;
    content: string;
    path?: string;
    type: string;
    metadata: Record<string, any>;
  }>;
  totalCount: number;
  executionTime: number;
  query: string;
}

// Vector search tool implementation
export class VectorSearchTool implements ITool {
  readonly type = ToolType.VECTOR_SEARCH;
  readonly name = 'Vector Search';
  readonly description = 'Search for relevant documents and code using semantic similarity';

  async execute(input: VectorSearchInput, context?: PipelineContext): Promise<VectorSearchOutput> {
    const startTime = Date.now();

    try {
      logger.debug({
        query: input.query.substring(0, 100),
        projectId: input.projectId,
        topK: input.topK,
      }, 'Executing vector search tool');

      // Validate input
      if (!this.validate(input)) {
        throw new ValidationError('Invalid vector search input');
      }

      // Build search options
      const searchOptions: VectorSearchOptions = {
        topK: input.topK || 10,
        threshold: input.threshold || 0.0,
        namespace: input.namespace, // Pass namespace as a filter if needed
        includeMetadata: input.includeMetadata !== false,
        includeValues: false,
        rerank: input.rerank !== false,
        filter: this.buildFilter(input),
      };

      // Perform search
      const searchResponse = await vectorSearchService.searchByText(input.query, searchOptions);

      // Transform results to tool output format
      const results = searchResponse.results.map(result => ({
        id: result.id,
        score: result.score,
        title: result.metadata.title || 'Untitled',
        content: result.metadata.content || '',
        path: result.metadata.path,
        type: result.metadata.documentType || 'unknown',
        metadata: {
          sourceType: result.metadata.sourceType,
          sourceId: result.metadata.sourceId,
          language: result.metadata.language,
          author: result.metadata.author,
          createdAt: result.metadata.createdAt,
          updatedAt: result.metadata.updatedAt,
          tags: result.metadata.tags,
          chunkIndex: result.metadata.chunkIndex,
          totalChunks: result.metadata.totalChunks,
        },
      }));

      const executionTime = Date.now() - startTime;

      const output: VectorSearchOutput = {
        results,
        totalCount: results.length,
        executionTime,
        query: input.query,
      };

      logger.debug({
        query: input.query.substring(0, 100),
        resultCount: results.length,
        executionTime,
      }, 'Vector search tool completed');

      return output;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        query: input.query.substring(0, 100),
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Vector search tool failed');

      throw error;
    }
  }

  validate(input: any): boolean {
    try {
      if (!input || typeof input !== 'object') {
        return false;
      }

      if (!input.query || typeof input.query !== 'string' || input.query.trim().length === 0) {
        return false;
      }

      if (input.topK !== undefined && (typeof input.topK !== 'number' || input.topK <= 0 || input.topK > 100)) {
        return false;
      }

      if (input.threshold !== undefined && (typeof input.threshold !== 'number' || input.threshold < 0 || input.threshold > 1)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  getSchema(): any {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query text',
          minLength: 1,
          maxLength: 1000,
        },
        projectId: {
          type: 'string',
          description: 'Optional project ID to filter results',
        },
        topK: {
          type: 'number',
          description: 'Maximum number of results to return',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity score threshold',
          minimum: 0,
          maximum: 1,
          default: 0.0,
        },
        filters: {
          type: 'object',
          description: 'Additional filters to apply',
          properties: {
            documentType: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by document types',
            },
            sourceType: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by source types',
            },
            language: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by programming language',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags',
            },
          },
        },
        namespace: {
          type: 'string',
          description: 'Vector store namespace to search in (used as metadata filter in Qdrant)',
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Whether to include metadata in results',
          default: true,
        },
        rerank: {
          type: 'boolean',
          description: 'Whether to rerank results for relevance',
          default: true,
        },
      },
      required: ['query'],
    };
  }

  // Helper methods
  private buildFilter(input: VectorSearchInput): VectorFilter | undefined {
    const filter: VectorFilter = {};

    // Add project filter
    if (input.projectId) {
      filter.projectId = input.projectId;
    }

    // Add custom filters
    if (input.filters) {
      Object.assign(filter, input.filters);
    }

    // If namespace is provided, add it as a metadata filter for Qdrant
    if (input.namespace) {
      filter.namespace = input.namespace;
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  // Utility methods for different search types
  async searchCode(
    query: string,
    projectId?: string,
    language?: string,
    topK: number = 10
  ): Promise<VectorSearchOutput> {
    return this.execute({
      query,
      projectId,
      topK,
      filters: {
        documentType: ['code'],
        ...(language && { language: [language] }),
      },
      rerank: true,
    });
  }

  async searchDocumentation(
    query: string,
    projectId?: string,
    topK: number = 10
  ): Promise<VectorSearchOutput> {
    return this.execute({
      query,
      projectId,
      topK,
      filters: {
        documentType: ['documentation', 'readme', 'markdown'],
      },
      rerank: true,
    });
  }

  async searchCommits(
    query: string,
    projectId?: string,
    topK: number = 10
  ): Promise<VectorSearchOutput> {
    return this.execute({
      query,
      projectId,
      topK,
      filters: {
        documentType: ['commit'],
      },
      rerank: true,
    });
  }

  async searchByPath(
    query: string,
    pathPattern: string,
    projectId?: string,
    topK: number = 10
  ): Promise<VectorSearchOutput> {
    return this.execute({
      query,
      projectId,
      topK,
      filters: {
        path: { $regex: pathPattern },
      },
      rerank: true,
    });
  }

  async searchRecent(
    query: string,
    projectId?: string,
    daysBack: number = 30,
    topK: number = 10
  ): Promise<VectorSearchOutput> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    return this.execute({
      query,
      projectId,
      topK,
      filters: {
        updatedAt: { $gte: cutoffDate.toISOString() },
      },
      rerank: true,
    });
  }

  // Advanced search methods
  async hybridSearch(
    query: string,
    keywords: string[],
    projectId?: string,
    topK: number = 10
  ): Promise<VectorSearchOutput> {
    // This would use the hybrid search functionality from vector search service
    // For now, we'll do a regular search and post-process with keywords
    const results = await this.execute({
      query,
      projectId,
      topK: topK * 2, // Get more results for filtering
      rerank: true,
    });

    // Filter results that contain keywords
    const filteredResults = results.results.filter(result => {
      const content = (result.content + ' ' + result.title).toLowerCase();
      return keywords.some(keyword => content.includes(keyword.toLowerCase()));
    });

    return {
      ...results,
      results: filteredResults.slice(0, topK),
      totalCount: filteredResults.length,
    };
  }

  async multiSearch(
    queries: string[],
    projectId?: string,
    topK: number = 5
  ): Promise<VectorSearchOutput[]> {
    const searchPromises = queries.map(query =>
      this.execute({
        query,
        projectId,
        topK,
        rerank: true,
      })
    );

    return Promise.all(searchPromises);
  }

  // Result processing utilities
  formatResultsForLLM(output: VectorSearchOutput): string {
    if (output.results.length === 0) {
      return 'No relevant results found.';
    }

    let formatted = `Found ${output.results.length} relevant results:\n\n`;

    output.results.forEach((result, index) => {
      formatted += `[${index + 1}] ${result.title}\n`;
      
      if (result.path) {
        formatted += `File: ${result.path}\n`;
      }
      
      formatted += `Type: ${result.type}\n`;
      formatted += `Score: ${result.score.toFixed(3)}\n`;
      
      // Truncate content for LLM context
      const content = result.content.length > 500 
        ? result.content.substring(0, 500) + '...'
        : result.content;
      
      formatted += `Content: ${content}\n\n`;
    });

    return formatted;
  }

  extractTopResults(output: VectorSearchOutput, count: number = 3): VectorSearchOutput {
    return {
      ...output,
      results: output.results.slice(0, count),
      totalCount: Math.min(output.totalCount, count),
    };
  }

  groupResultsByType(output: VectorSearchOutput): Record<string, VectorSearchOutput['results']> {
    const grouped: Record<string, VectorSearchOutput['results']> = {};

    for (const result of output.results) {
      if (!grouped[result.type]) {
        grouped[result.type] = [];
      }
      grouped[result.type].push(result);
    }

    return grouped;
  }
}

// Export singleton instance
export const vectorSearchTool = new VectorSearchTool();


