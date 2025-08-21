import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VectorSearchTool } from '@/modules/agents/tools/vector-search-tool.js';
import { vectorSearchService } from '@/modules/knowledge/services/vector-search.js';
import { ValidationError } from '@/core/errors/app-error.js';

// Mock the vectorSearchService
vi.mock('@/modules/knowledge/services/vector-search.js', () => ({
  vectorSearchService: {
    searchByText: vi.fn(),
  },
}));

describe('VectorSearchTool', () => {
  let vectorSearchTool: VectorSearchTool;

  beforeEach(() => {
    vectorSearchTool = new VectorSearchTool();
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute a basic vector search and return formatted results', async () => {
      const mockSearchResponse = {
        results: [
          {
            id: 'doc1',
            score: 0.9,
            metadata: {
              title: 'Test Doc 1',
              content: 'This is the content of test document 1.',
              documentType: 'code',
              path: '/src/test.ts',
              sourceType: 'git',
              sourceId: 'repo1',
              language: 'typescript',
              author: 'testuser',
              createdAt: '2023-01-01T00:00:00Z',
              updatedAt: '2023-01-01T00:00:00Z',
              tags: ['tag1', 'tag2'],
              chunkIndex: 0,
              totalChunks: 1,
            },
            values: [],
          },
        ],
        query: { text: 'test query', topK: 10 },
        executionTime: 50,
      };

      (vectorSearchService.searchByText as vi.Mock).mockResolvedValue(mockSearchResponse);

      const input = { query: 'test query', projectId: 'proj1', topK: 1 };
      const result = await vectorSearchTool.execute(input);

      expect(vectorSearchService.searchByText).toHaveBeenCalledWith('test query', {
        topK: 1,
        threshold: 0,
        namespace: undefined,
        includeMetadata: true,
        includeValues: false,
        rerank: true,
        filter: { projectId: 'proj1' },
      });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('doc1');
      expect(result.results[0].title).toBe('Test Doc 1');
      expect(result.results[0].content).toBe('This is the content of test document 1.');
      expect(result.totalCount).toBe(1);
      expect(result.query).toBe('test query');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should throw ValidationError for invalid input', async () => {
      const input = { query: '', projectId: 'proj1' }; // Empty query
      await expect(vectorSearchTool.execute(input as any)).rejects.toThrow(ValidationError);
    });

    it('should handle errors from vectorSearchService', async () => {
      (vectorSearchService.searchByText as vi.Mock).mockRejectedValue(new Error('Search failed'));
      const input = { query: 'test query' };
      await expect(vectorSearchTool.execute(input)).rejects.toThrow('Search failed');
    });

    it('should apply filters correctly', async () => {
      const mockSearchResponse = {
        results: [],
        query: { text: 'test query', topK: 10 },
        executionTime: 50,
      };
      (vectorSearchService.searchByText as vi.Mock).mockResolvedValue(mockSearchResponse);

      const input = {
        query: 'filtered query',
        filters: { documentType: ['code'], language: ['typescript'] },
        namespace: 'my-namespace',
      };
      await vectorSearchTool.execute(input);

      expect(vectorSearchService.searchByText).toHaveBeenCalledWith('filtered query', {
        topK: 10,
        threshold: 0,
        namespace: 'my-namespace',
        includeMetadata: true,
        includeValues: false,
        rerank: true,
        filter: {
          documentType: ['code'],
          language: ['typescript'],
          namespace: 'my-namespace',
        },
      });
    });
  });

  describe('validate', () => {
    it('should return true for valid input', () => {
      expect(vectorSearchTool.validate({ query: 'valid query' })).toBe(true);
      expect(vectorSearchTool.validate({ query: 'valid query', topK: 5, threshold: 0.5 })).toBe(true);
    });

    it('should return false for invalid query', () => {
      expect(vectorSearchTool.validate({ query: '' })).toBe(false);
      expect(vectorSearchTool.validate({ query: 123 as any })).toBe(false);
      expect(vectorSearchTool.validate(null)).toBe(false);
      expect(vectorSearchTool.validate(undefined)).toBe(false);
    });

    it('should return false for invalid topK', () => {
      expect(vectorSearchTool.validate({ query: 'q', topK: 0 })).toBe(false);
      expect(vectorSearchTool.validate({ query: 'q', topK: 101 })).toBe(false);
      expect(vectorSearchTool.validate({ query: 'q', topK: 'abc' as any })).toBe(false);
    });

    it('should return false for invalid threshold', () => {
      expect(vectorSearchTool.validate({ query: 'q', threshold: -0.1 })).toBe(false);
      expect(vectorSearchTool.validate({ query: 'q', threshold: 1.1 })).toBe(false);
      expect(vectorSearchTool.validate({ query: 'q', threshold: 'abc' as any })).toBe(false);
    });
  });

  describe('buildFilter', () => {
    it('should build filter with projectId', () => {
      const input = { query: 'test', projectId: 'proj1' };
      const filter = (vectorSearchTool as any).buildFilter(input);
      expect(filter).toEqual({ projectId: 'proj1' });
    });

    it('should build filter with custom filters', () => {
      const input = { query: 'test', filters: { documentType: ['code'] } };
      const filter = (vectorSearchTool as any).buildFilter(input);
      expect(filter).toEqual({ documentType: ['code'] });
    });

    it('should build filter with namespace as metadata filter', () => {
      const input = { query: 'test', namespace: 'my-namespace' };
      const filter = (vectorSearchTool as any).buildFilter(input);
      expect(filter).toEqual({ namespace: 'my-namespace' });
    });

    it('should combine all filters', () => {
      const input = {
        query: 'test',
        projectId: 'proj1',
        filters: { documentType: ['code'] },
        namespace: 'my-namespace',
      };
      const filter = (vectorSearchTool as any).buildFilter(input);
      expect(filter).toEqual({
        projectId: 'proj1',
        documentType: ['code'],
        namespace: 'my-namespace',
      });
    });

    it('should return undefined if no filters', () => {
      const input = { query: 'test' };
      const filter = (vectorSearchTool as any).buildFilter(input);
      expect(filter).toBeUndefined();
    });
  });

  describe('utility search methods', () => {
    it('searchCode should call execute with correct filters', async () => {
      const mockSearchResponse = {
        results: [],
        query: { text: 'code query', topK: 10 },
        executionTime: 50,
      };
      (vectorSearchService.searchByText as vi.Mock).mockResolvedValue(mockSearchResponse);

      await vectorSearchTool.searchCode('code query', 'proj1', 'typescript', 5);
      expect(vectorSearchService.searchByText).toHaveBeenCalledWith('code query', expect.objectContaining({
        topK: 5,
        filter: { documentType: ['code'], language: ['typescript'], projectId: 'proj1' },
      }));
    });

    it('searchDocumentation should call execute with correct filters', async () => {
      const mockSearchResponse = {
        results: [],
        query: { text: 'doc query', topK: 10 },
        executionTime: 50,
      };
      (vectorSearchService.searchByText as vi.Mock).mockResolvedValue(mockSearchResponse);

      await vectorSearchTool.searchDocumentation('doc query', 'proj1', 5);
      expect(vectorSearchService.searchByText).toHaveBeenCalledWith('doc query', expect.objectContaining({
        topK: 5,
        filter: { documentType: ['documentation', 'readme', 'markdown'], projectId: 'proj1' },
      }));
    });

    it('searchCommits should call execute with correct filters', async () => {
      const mockSearchResponse = {
        results: [],
        query: { text: 'commit query', topK: 10 },
        executionTime: 50,
      };
      (vectorSearchService.searchByText as vi.Mock).mockResolvedValue(mockSearchResponse);

      await vectorSearchTool.searchCommits('commit query', 'proj1', 5);
      expect(vectorSearchService.searchByText).toHaveBeenCalledWith('commit query', expect.objectContaining({
        topK: 5,
        filter: { documentType: ['commit'], projectId: 'proj1' },
      }));
    });

    it('searchRecent should call execute with correct filters', async () => {
      const mockSearchResponse = {
        results: [],
        query: { text: 'recent query', topK: 10 },
        executionTime: 50,
      };
      (vectorSearchService.searchByText as vi.Mock).mockResolvedValue(mockSearchResponse);

      const now = new Date('2025-01-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await vectorSearchTool.searchRecent('recent query', 'proj1', 7, 5);
      expect(vectorSearchService.searchByText).toHaveBeenCalledWith('recent query', expect.objectContaining({
        topK: 5,
        filter: { projectId: 'proj1', updatedAt: { $gte: '2025-01-08T12:00:00.000Z' } },
      }));
      vi.useRealTimers();
    });
  });

  describe('formatResultsForLLM', () => {
    it('should format results for LLM context', () => {
      const mockOutput = {
        results: [
          {
            id: 'doc1',
            score: 0.9,
            title: 'Doc Title 1',
            content: 'Content of document 1.',
            path: '/path/to/doc1.ts',
            type: 'code',
            metadata: {},
          },
          {
            id: 'doc2',
            score: 0.8,
            title: 'Doc Title 2',
            content: 'Content of document 2. This is a longer content that should be truncated.',
            path: '/path/to/doc2.md',
            type: 'documentation',
            metadata: {},
          },
        ],
        totalCount: 2,
        executionTime: 100,
        query: 'test query',
      };

      const formatted = vectorSearchTool.formatResultsForLLM(mockOutput);
      expect(formatted).toContain('Found 2 relevant results:');
      expect(formatted).toContain('[1] Doc Title 1');
      expect(formatted).toContain('File: /path/to/doc1.ts');
      expect(formatted).toContain('Type: code');
      expect(formatted).toContain('Score: 0.900');
      expect(formatted).toContain('Content: Content of document 1.');
      expect(formatted).toContain('[2] Doc Title 2');
      expect(formatted).toContain('Content: Content of document 2. This is a longer content that should be truncated.');
      expect(formatted.length).toBeLessThan(500 * 2); // Ensure truncation for longer content
    });

    it('should return no results message if empty', () => {
      const mockOutput = {
        results: [],
        totalCount: 0,
        executionTime: 0,
        query: 'empty query',
      };
      const formatted = vectorSearchTool.formatResultsForLLM(mockOutput);
      expect(formatted).toBe('No relevant results found.');
    });
  });

  describe('extractTopResults', () => {
    it('should extract top N results', () => {
      const mockOutput = {
        results: [
          { id: '1', score: 0.9, title: 'a', content: 'a', type: 'a', metadata: {} },
          { id: '2', score: 0.8, title: 'b', content: 'b', type: 'b', metadata: {} },
          { id: '3', score: 0.7, title: 'c', content: 'c', type: 'c', metadata: {} },
        ],
        totalCount: 3,
        executionTime: 100,
        query: 'test',
      };
      const extracted = vectorSearchTool.extractTopResults(mockOutput, 2);
      expect(extracted.results).toHaveLength(2);
      expect(extracted.results[0].id).toBe('1');
      expect(extracted.results[1].id).toBe('2');
      expect(extracted.totalCount).toBe(2);
    });
  });

  describe('groupResultsByType', () => {
    it('should group results by document type', () => {
      const mockOutput = {
        results: [
          { id: '1', score: 0.9, title: 'a', content: 'a', type: 'code', metadata: {} },
          { id: '2', score: 0.8, title: 'b', content: 'b', type: 'documentation', metadata: {} },
          { id: '3', score: 0.7, title: 'c', content: 'c', type: 'code', metadata: {} },
        ],
        totalCount: 3,
        executionTime: 100,
        query: 'test',
      };
      const grouped = vectorSearchTool.groupResultsByType(mockOutput);
      expect(grouped.code).toHaveLength(2);
      expect(grouped.documentation).toHaveLength(1);
      expect(grouped.code[0].id).toBe('1');
      expect(grouped.code[1].id).toBe('3');
      expect(grouped.documentation[0].id).toBe('2');
    });

    it('should handle empty results', () => {
      const mockOutput = {
        results: [],
        totalCount: 0,
        executionTime: 0,
        query: 'test',
      };
      const grouped = vectorSearchTool.groupResultsByType(mockOutput);
      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });
});


