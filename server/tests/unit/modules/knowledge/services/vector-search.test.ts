import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VectorSearchService } from '@/modules/knowledge/services/vector-search.js';
import { embeddingService } from '@/modules/knowledge/services/embedding-service.js';
import { vectorDbManager } from '@/config/vector-db.js';
import { EmbeddingModel, VectorSearchQuery } from '@/core/types/embeddings.js';
import { ValidationError } from '@/core/errors/app-error.js';

// Mock external dependencies
vi.mock('@/modules/knowledge/services/embedding-service.js', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
    generateEmbeddings: vi.fn(() => Promise.resolve({
      embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
      usage: { prompt_tokens: 10, total_tokens: 10 },
    })),
    estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  },
}));

vi.mock('@/config/vector-db.js', () => ({
  vectorDbManager: {
    vectorService: {
      query: vi.fn(),
      fetch: vi.fn(),
    },
  },
}));

describe('VectorSearchService', () => {
  let vectorSearchService: VectorSearchService;

  beforeEach(() => {
    vectorSearchService = new VectorSearchService();
    vi.clearAllMocks();
  });

  describe('searchByText', () => {
    it('should throw ValidationError if text is empty', async () => {
      await expect(vectorSearchService.searchByText('')).rejects.toThrow(ValidationError);
    });

    it('should generate embedding and query vector store', async () => {
      const mockVectorResponse = {
        results: [
          { id: '1', score: 0.9, values: [0.1, 0.2, 0.3], metadata: { content: 'test content', title: 'test title', path: 'test path' } },
        ],
        totalCount: 1,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };
      (vectorDbManager.vectorService.query as vi.Mock).mockResolvedValue(mockVectorResponse);

      const result = await vectorSearchService.searchByText('test query');

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('test query', EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL);
      expect(vectorDbManager.vectorService.query).toHaveBeenCalled();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBeGreaterThan(0);
    });

    it('should apply threshold filtering', async () => {
      const mockVectorResponse = {
        results: [
          { id: '1', score: 0.9, values: [], metadata: { content: 'test' } },
          { id: '2', score: 0.2, values: [], metadata: { content: 'test' } },
        ],
        totalCount: 2,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };
      (vectorDbManager.vectorService.query as vi.Mock).mockResolvedValue(mockVectorResponse);

      const result = await vectorSearchService.searchByText('test query', { threshold: 0.5 });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('1');
    });

    it('should rerank results if rerank option is true', async () => {
      const mockVectorResponse = {
        results: [
          { id: '1', score: 0.5, values: [], metadata: { content: 'exact match test query' } },
          { id: '2', score: 0.9, values: [], metadata: { content: 'no match' } },
        ],
        totalCount: 2,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };
      (vectorDbManager.vectorService.query as vi.Mock).mockResolvedValue(mockVectorResponse);

      const result = await vectorSearchService.searchByText('test query', { rerank: true });
      expect(result.results[0].id).toBe('1'); // Should be reranked higher due to content match
    });
  });

  describe('searchByVector', () => {
    it('should throw ValidationError if vector is empty', async () => {
      await expect(vectorSearchService.searchByVector([])).rejects.toThrow(ValidationError);
    });

    it('should query vector store directly', async () => {
      const mockVectorResponse = {
        results: [
          { id: '1', score: 0.9, values: [0.1, 0.2, 0.3], metadata: { content: 'test content' } },
        ],
        totalCount: 1,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };
      (vectorDbManager.vectorService.query as vi.Mock).mockResolvedValue(mockVectorResponse);

      const result = await vectorSearchService.searchByVector([0.1, 0.2, 0.3]);

      expect(vectorDbManager.vectorService.query).toHaveBeenCalled();
      expect(result.results).toHaveLength(1);
    });
  });

  describe('hybridSearch', () => {
    it('should combine semantic and keyword results', async () => {
      const mockSemanticResponse = {
        results: [
          { id: 'sem1', score: 0.8, values: [], metadata: { content: 'semantic content' } },
          { id: 'sem2', score: 0.7, values: [], metadata: { content: 'another semantic' } },
        ],
        totalCount: 2,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };
      const mockKeywordResponse = {
        results: [
          { id: 'key1', score: 0.9, values: [], metadata: { content: 'keyword content' } },
          { id: 'sem1', score: 0.6, values: [], metadata: { content: 'semantic content' } }, // Overlap
        ],
        totalCount: 2,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };

      (vectorDbManager.vectorService.query as vi.Mock).mockResolvedValue(mockSemanticResponse);
      // Mocking searchByText for semantic part
      vi.spyOn(vectorSearchService, 'searchByText').mockResolvedValue(mockSemanticResponse);

      const query = {
        text: 'hybrid query',
        keywords: ['keyword'],
        options: { topK: 10 },
      };
      const result = await vectorSearchService.hybridSearch(query);

      expect(result.results).toHaveLength(3); // sem1, sem2, key1
      expect(result.results[0].id).toBe('sem1'); // sem1 should be highest due to combined score
      expect(result.results[1].id).toBe('key1');
      expect(result.results[2].id).toBe('sem2');
    });
  });

  describe('findSimilar', () => {
    it('should fetch document vector and find similar ones', async () => {
      const mockFetchResponse = [
        { id: 'sourceDoc', values: [0.1, 0.2, 0.3], metadata: { content: 'source' } },
      ];
      const mockVectorResponse = {
        results: [
          { id: 'similar1', score: 0.9, values: [], metadata: { content: 'similar content' } },
        ],
        totalCount: 1,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };

      (vectorDbManager.vectorService.fetch as vi.Mock).mockResolvedValue(mockFetchResponse);
      (vectorDbManager.vectorService.query as vi.Mock).mockResolvedValue(mockVectorResponse);

      const result = await vectorSearchService.findSimilar('sourceDoc');

      expect(vectorDbManager.vectorService.fetch).toHaveBeenCalledWith(['sourceDoc'], undefined);
      expect(vectorDbManager.vectorService.query).toHaveBeenCalledWith(expect.objectContaining({
        vector: [0.1, 0.2, 0.3],
        filter: { documentId: { $ne: 'sourceDoc' } },
      }));
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('similar1');
    });

    it('should throw ValidationError if source document not found', async () => {
      (vectorDbManager.vectorService.fetch as vi.Mock).mockResolvedValue([]);
      await expect(vectorSearchService.findSimilar('nonExistentDoc')).rejects.toThrow(ValidationError);
    });
  });

  describe('multiSearch', () => {
    it('should execute multiple queries in parallel', async () => {
      const mockVectorResponse1 = {
        results: [{ id: '1', score: 0.9, values: [], metadata: { content: 'test' } }],
        totalCount: 1,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };
      const mockVectorResponse2 = {
        results: [{ id: '2', score: 0.8, values: [], metadata: { content: 'test' } }],
        totalCount: 1,
        query: {} as VectorSearchQuery,
        executionTime: 10,
      };

      vi.spyOn(vectorSearchService, 'searchByText')
        .mockResolvedValueOnce(mockVectorResponse1)
        .mockResolvedValueOnce(mockVectorResponse2);

      const queries = [
        { text: 'query 1', topK: 1 },
        { text: 'query 2', topK: 1 },
      ];
      const results = await vectorSearchService.multiSearch(queries);

      expect(results).toHaveLength(2);
      expect(results[0].results[0].id).toBe('1');
      expect(results[1].results[0].id).toBe('2');
      expect(vectorSearchService.searchByText).toHaveBeenCalledTimes(2);
    });

    it('should return empty results for failed queries in multiSearch', async () => {
      vi.spyOn(vectorSearchService, 'searchByText')
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockResolvedValueOnce({
          results: [{ id: '2', score: 0.8, values: [], metadata: { content: 'test' } }],
          totalCount: 1,
          query: {} as VectorSearchQuery,
          executionTime: 10,
        });

      const queries = [
        { text: 'query 1', topK: 1 },
        { text: 'query 2', topK: 1 },
      ];
      const results = await vectorSearchService.multiSearch(queries);

      expect(results).toHaveLength(2);
      expect(results[0].results).toHaveLength(0);
      expect(results[1].results[0].id).toBe('2');
    });
  });
});


