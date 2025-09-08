import {
  IVectorSearchService,
  VectorSearchOptions,
  VectorSearchResponse,
  VectorSearchResult,
  VectorSearchQuery,
  HybridSearchQuery,
  VectorFilter,
  EmbeddingModel,
} from '@/core/types/embeddings';
import { embeddingService } from './embedding.service';
import { vectorDbManager } from '@/config/vector-db'; // Import vectorDbManager
import { logger } from '@/core/utils/logger';
import { ValidationError } from '@/core/errors/app-error';

// Search result ranking and scoring
class SearchResultRanker {
  static rerank(results: VectorSearchResult[], query: string): VectorSearchResult[] {
    // Simple reranking based on content relevance
    return results.map(result => {
      const contentScore = this.calculateContentScore(result.payload?.docstring_summary || result.metadata?.docstring_summary || '', query);
      const titleScore = this.calculateTitleScore(result.payload?.node_name || result.metadata?.node_name || '', query);
      const pathScore = this.calculatePathScore(result.payload?.file_path || result.metadata?.file_path || '', query);
      
      // Combine scores with weights
      const combinedScore = (
        result.score * 0.6 +
        contentScore * 0.25 +
        titleScore * 0.1 +
        pathScore * 0.05
      );

      return {
        ...result,
        score: combinedScore,
      };
    }).sort((a, b) => b.score - a.score);
  }

  private static calculateContentScore(content: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let score = 0;
    let totalTerms = queryTerms.length;

    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        // Exact match gets higher score
        const exactMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
        score += exactMatches * 0.1;
        
        // Bonus for term frequency
        const termFrequency = exactMatches / content.split(/\s+/).length;
        score += termFrequency * 0.5;
      }
    }

    return Math.min(score / totalTerms, 1.0);
  }

  private static calculateTitleScore(title: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const titleLower = title.toLowerCase();
    
    let matches = 0;
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        matches++;
      }
    }

    return matches / queryTerms.length;
  }

  private static calculatePathScore(path: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const pathLower = path.toLowerCase();
    
    let matches = 0;
    for (const term of queryTerms) {
      if (pathLower.includes(term)) {
        matches++;
      }
    }

    return matches / Math.max(queryTerms.length, 1);
  }

  static diversifyResults(results: VectorSearchResult[], maxPerSource: number = 3): VectorSearchResult[] {
    const sourceGroups = new Map<string, VectorSearchResult[]>();
    
    // Group by source
    for (const result of results) {
      const sourceKey = `${result.payload?.node_type}:${result.payload?.chunk_id}`;
      if (!sourceGroups.has(sourceKey)) {
        sourceGroups.set(sourceKey, []);
      }
      sourceGroups.get(sourceKey)!.push(result);
    }

    // Take top results from each source
    const diversified: VectorSearchResult[] = [];
    const sourceIterators = new Map<string, number>();
    
    // Initialize iterators
    for (const sourceKey of sourceGroups.keys()) {
      sourceIterators.set(sourceKey, 0);
    }

    // Round-robin selection with limits
    let totalAdded = 0;
    const maxResults = results.length;
    
    while (totalAdded < maxResults && sourceIterators.size > 0) {
      const sourcesToRemove: string[] = [];
      
      for (const [sourceKey, index] of sourceIterators.entries()) {
        const sourceResults = sourceGroups.get(sourceKey)!;
        
        if (index < sourceResults.length && index < maxPerSource) {
          diversified.push(sourceResults[index]);
          sourceIterators.set(sourceKey, index + 1);
          totalAdded++;
          
          if (totalAdded >= maxResults) break;
        }
        
        if (index >= sourceResults.length || index >= maxPerSource) {
          sourcesToRemove.push(sourceKey);
        }
      }
      
      // Remove exhausted sources
      for (const sourceKey of sourcesToRemove) {
        sourceIterators.delete(sourceKey);
      }
    }

    return diversified;
  }
}

// Keyword search utilities
class KeywordSearcher {
  static searchKeywords(results: VectorSearchResult[], keywords: string[]): VectorSearchResult[] {
    if (keywords.length === 0) return results;

    return results.map(result => {
      const keywordScore = this.calculateKeywordScore(result.payload?.docstring_summary || result.metadata?.docstring_summary || '', keywords);
      
      return {
        ...result,
        score: result.score * 0.7 + keywordScore * 0.3, // Blend semantic and keyword scores
      };
    }).sort((a, b) => b.score - a.score);
  }

  private static calculateKeywordScore(content: string, keywords: string[]): number {
    const contentLower = content.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      
      // Exact phrase match
      if (contentLower.includes(keywordLower)) {
        score += 1.0;
      }
      
      // Individual word matches
      const words = keywordLower.split(/\s+/);
      for (const word of words) {
        if (contentLower.includes(word)) {
          score += 0.5;
        }
      }
    }

    return Math.min(score / keywords.length, 1.0);
  }
}

// Vector search service implementation
export class VectorSearchService implements IVectorSearchService {
  private readonly defaultOptions: VectorSearchOptions = {
    topK: 10,
    includeMetadata: true,
    includeValues: false,
    threshold: 0.0,
    rerank: true,
  };

  async searchByText(text: string, options?: VectorSearchOptions): Promise<VectorSearchResponse> {
    const searchOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      logger.debug({
        query: text.substring(0, 100),
        options: searchOptions,
      }, 'Starting text-based vector search');

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new ValidationError('Search text cannot be empty');
      }

      // Generate embedding for the search text
      const embedding = await embeddingService.generateEmbedding(text);

      const vectorResponse = await (vectorDbManager as any).query(embedding, {
        limit: searchOptions.topK || 10,
        filter: searchOptions.filter,
        includeMetadata: searchOptions.includeMetadata ?? true,
        includeValues: searchOptions.includeValues ?? false,
        namespace: searchOptions.namespace,
      });

      // Apply threshold filtering
      let results = vectorResponse.results;
      if (searchOptions.threshold && searchOptions.threshold > 0) {
        results = results.filter((result: any) => result.score >= searchOptions.threshold!); // Use ! for non-null assertion
      }

      // Apply reranking if enabled
      if (searchOptions.rerank) {
        results = SearchResultRanker.rerank(results, text);
      }

      // Diversify results
      results = SearchResultRanker.diversifyResults(results);

      const executionTime = Date.now() - startTime;

      logger.debug({
        query: text.substring(0, 100),
        resultCount: results.length,
        executionTime,
      }, 'Text-based vector search completed');

      return {
        results,
        totalCount: results.length,
        query: {
          text,
          topK: searchOptions.topK || 10,
          filter: searchOptions.filter,
          includeMetadata: searchOptions.includeMetadata,
          includeValues: searchOptions.includeValues,
          namespace: searchOptions.namespace,
        },
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        query: text.substring(0, 100),
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Text-based vector search failed');

      throw error;
    }
  }

  async searchByVector(vector: number[], options?: VectorSearchOptions): Promise<VectorSearchResponse> {
    const searchOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      logger.debug({
        vectorDimensions: vector.length,
        options: searchOptions,
      }, 'Starting vector-based search');

      // Validate input
      if (!vector || vector.length === 0) {
        throw new ValidationError('Search vector cannot be empty');
      }

      const vectorResponse = await (vectorDbManager as any).query(vector, {
        limit: searchOptions.topK || 10,
        filter: searchOptions.filter,
        includeMetadata: searchOptions.includeMetadata ?? true,
        includeValues: searchOptions.includeValues ?? false,
        namespace: searchOptions.namespace,
      });

      // Apply threshold filtering
      let results = vectorResponse.results;
      if (searchOptions.threshold && searchOptions.threshold > 0) {
        results = results.filter((result: any) => result.score >= searchOptions.threshold!); // Use ! for non-null assertion
      }

      // Diversify results
      results = SearchResultRanker.diversifyResults(results);

      const executionTime = Date.now() - startTime;

      logger.debug({
        vectorDimensions: vector.length,
        resultCount: results.length,
        executionTime,
      }, 'Vector-based search completed');

      return {
        results,
        totalCount: results.length,
        query: {
          vector,
          topK: searchOptions.topK || 10,
          filter: searchOptions.filter,
          includeMetadata: searchOptions.includeMetadata,
          includeValues: searchOptions.includeValues,
          namespace: searchOptions.namespace,
        },
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        vectorDimensions: vector.length,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Vector-based search failed');

      throw error;
    }
  }

  async hybridSearch(query: HybridSearchQuery): Promise<VectorSearchResponse> {
    const startTime = Date.now();

    try {
      logger.debug({
        hasText: !!query.text,
        hasVector: !!query.vector,
        hasKeywords: !!query.keywords?.length,
        weights: query.weights,
      }, 'Starting hybrid search');

      let semanticResults: VectorSearchResult[] = [];
      let keywordResults: VectorSearchResult[] = [];

      // Perform semantic search
      if (query.text || query.vector) {
        const semanticResponse = query.text
          ? await this.searchByText(query.text, query.options)
          : await this.searchByVector(query.vector!, query.options);
        
        semanticResults = semanticResponse.results;
      }

      // Perform keyword search if keywords are provided
      if (query.keywords && query.keywords.length > 0) {
        // For keyword search, we'll search within the semantic results
        // In a more advanced implementation, you might use a separate keyword index
        keywordResults = KeywordSearcher.searchKeywords(semanticResults, query.keywords);
      } else {
        keywordResults = semanticResults;
      }

      // Combine and weight results
      const weights = query.weights || { semantic: 0.7, keyword: 0.3 };
      const combinedResults = this.combineSearchResults(
        semanticResults,
        keywordResults,
        weights
      );

      // Apply filters
      let filteredResults = combinedResults;
      if (query.filters) {
        filteredResults = this.applyFilters(combinedResults, query.filters);
      }

      // Limit results
      const topK = query.options?.topK || 10;
      filteredResults = filteredResults.slice(0, topK);

      const executionTime = Date.now() - startTime;

      logger.debug({
        semanticCount: semanticResults.length,
        keywordCount: keywordResults.length,
        combinedCount: filteredResults.length,
        executionTime,
      }, 'Hybrid search completed');

      return {
        results: filteredResults,
        totalCount: filteredResults.length,
        query: {
          text: query.text,
          topK,
          filter: query.filters,
        },
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Hybrid search failed');

      throw error;
    }
  }

  async findSimilar(documentId: string, options?: VectorSearchOptions): Promise<VectorSearchResponse> {
    const searchOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      logger.debug({
        documentId,
        options: searchOptions,
      }, 'Starting similarity search');

      // First, fetch the document's vector
      const fetchResult = await (vectorDbManager as any).fetch([documentId]);
      const vectors = Object.values(fetchResult.vectors || {});
      
      if (vectors.length === 0) {
        throw new ValidationError(`Document not found: ${documentId}`);
      }

      const sourceVector = (vectors[0] as any).values as number[];

      const vectorResponse = await (vectorDbManager as any).query(sourceVector, {
        limit: (searchOptions.topK || 10) + 1, // +1 to account for excluding source
        filter: {
          ...searchOptions.filter,
          // Exclude the source document
          documentId: { $ne: documentId },
        },
        includeMetadata: searchOptions.includeMetadata,
        includeValues: searchOptions.includeValues,
        namespace: searchOptions.namespace,
      });

      // Filter out the source document (just in case)
      let results = vectorResponse.results.filter((result: any) => result.id !== documentId);

      // Apply threshold filtering
      if (searchOptions.threshold && searchOptions.threshold > 0) {
        results = results.filter((result: any) => result.score >= searchOptions.threshold!); // Use ! for non-null assertion
      }

      // Limit to requested count
      results = results.slice(0, searchOptions.topK || 10);

      const executionTime = Date.now() - startTime;

      logger.debug({
        documentId,
        resultCount: results.length,
        executionTime,
      }, 'Similarity search completed');

      return {
        results,
        totalCount: results.length,
        query: {
          text: `Document similarity for: ${documentId}`,
          topK: searchOptions.topK || 10,
          filter: searchOptions.filter,
          includeMetadata: searchOptions.includeMetadata,
          includeValues: searchOptions.includeValues,
          namespace: searchOptions.namespace,
        },
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        documentId,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Similarity search failed');

      throw error;
    }
  }

  async multiSearch(queries: VectorSearchQuery[]): Promise<VectorSearchResponse[]> {
    const startTime = Date.now();

    try {
      logger.debug({
        queryCount: queries.length,
      }, 'Starting multi-search');

      // Execute all queries in parallel
      const searchPromises = queries.map(async (query, index) => {
        try {
          if (query.text) {
            return await this.searchByText(query.text, {
              topK: query.topK,
              filter: query.filter,
              namespace: query.namespace,
              includeMetadata: query.includeMetadata,
              includeValues: query.includeValues,
            });
          } else if (query.vector) {
            return await this.searchByVector(query.vector, {
              topK: query.topK,
              filter: query.filter,
              namespace: query.namespace,
              includeMetadata: query.includeMetadata,
              includeValues: query.includeValues,
            });
          } else {
            throw new ValidationError(`Query ${index} must have either text or vector`);
          }
        } catch (error) {
          logger.error({
            queryIndex: index,
            error: error instanceof Error ? error.message : 'Unknown error',
          }, 'Multi-search query failed');

          // Return empty result for failed queries
          return {
            results: [],
            totalCount: 0,
            query,
            executionTime: 0,
          };
        }
      });

      const results = await Promise.all(searchPromises);

      const executionTime = Date.now() - startTime;

      logger.debug({
        queryCount: queries.length,
        totalResults: results.reduce((acc, curr) => acc + (curr.totalCount || 0), 0),
        executionTime,
      }, 'Multi-search completed');

      return results;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Multi-search failed');

      throw error;
    }
  }

  // Helper to combine search results based on weights
  private combineSearchResults(
    semanticResults: VectorSearchResult[],
    keywordResults: VectorSearchResult[],
    weights: { semantic: number; keyword: number }
  ): VectorSearchResult[] {
    const combinedMap = new Map<string, VectorSearchResult>();

    // Add semantic results
    semanticResults.forEach(result => {
      combinedMap.set(result.id, { ...result, score: result.score * weights.semantic });
    });

    // Add or update with keyword results
    keywordResults.forEach(result => {
      const existing = combinedMap.get(result.id);
      if (existing) {
        // If already exists, combine scores
        existing.score = existing.score + result.score * weights.keyword;
      } else {
        // Otherwise, add new result with keyword score
        combinedMap.set(result.id, { ...result, score: result.score * weights.keyword });
      }
    });

    // Sort by combined score
    return Array.from(combinedMap.values()).sort((a, b) => b.score - a.score);
  }

  // Helper to apply filters to results (for hybrid search post-processing)
  private applyFilters(results: VectorSearchResult[], filters: VectorFilter): VectorSearchResult[] {
    return results.filter(result => {
      for (const key in filters) {
        if (Object.prototype.hasOwnProperty.call(filters, key)) {
          const filterValue = (filters as any)[key];
          const resultValue = (result.metadata as any)[key];

          // Handle array filters (e.g., documentType: ['code', 'doc'])
          if (Array.isArray(filterValue)) {
            if (!filterValue.includes(resultValue)) {
              return false;
            }
          } else if (typeof filterValue === 'object' && filterValue !== null) {
            // Handle operators like $gte, $lte, $eq, $ne, $regex
            if (filterValue.$gte !== undefined) {
              if (resultValue < filterValue.$gte) return false;
            }
            if (filterValue.$lte !== undefined) {
              if (resultValue > filterValue.$lte) return false;
            }
            if (filterValue.$eq !== undefined) {
              if (resultValue !== filterValue.$eq) return false;
            }
            if (filterValue.$ne !== undefined) {
              if (resultValue === filterValue.$ne) return false;
            }
            if (filterValue.$regex !== undefined) {
              const regex = new RegExp(filterValue.$regex);
              if (!regex.test(resultValue)) return false;
            }
          } else {
            // Handle exact match
            if (resultValue !== filterValue) {
              return false;
            }
          }
        }
      }
      return true;
    });
  }
}

// Export singleton instance
export const vectorSearchService = new VectorSearchService();


