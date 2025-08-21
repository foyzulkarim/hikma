import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentProcessor } from '@/modules/knowledge/services/document-processor.js';
import { embeddingService } from '@/modules/knowledge/services/embedding-service.js';
import { vectorDbManager } from '@/config/vector-db.js';
import { ChunkingStrategy, EmbeddingModel } from '@/core/types/embeddings.js';
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
      batchUpsert: vi.fn(() => Promise.resolve({ success: true, processedCount: 2, errors: [] })),
    },
  },
}));

describe('DocumentProcessor', () => {
  let documentProcessor: DocumentProcessor;

  beforeEach(() => {
    documentProcessor = new DocumentProcessor();
    vi.clearAllMocks();
  });

  describe('chunkDocument', () => {
    it('should throw ValidationError if content is empty', async () => {
      await expect(documentProcessor.chunkDocument('')).rejects.toThrow(ValidationError);
    });

    it('should return content as single chunk if too small', async () => {
      const content = 'short content';
      const result = await documentProcessor.chunkDocument(content, { minChunkSize: 100 });
      expect(result.totalChunks).toBe(1);
      expect(result.metadata.originalLength).toBe(content.length);
      expect((result as any)._textChunks).toBeUndefined(); // Should not have textChunks if not actually chunked
    });

    it('should chunk document by fixed size strategy', async () => {
      const content = 'This is a test sentence. This is another test sentence. And one more for good measure.';
      const result = await documentProcessor.chunkDocument(content, {
        strategy: ChunkingStrategy.FIXED_SIZE,
        chunkSize: 30,
        chunkOverlap: 0,
      });
      expect(result.totalChunks).toBeGreaterThan(1);
      expect((result as any)._textChunks.length).toBeGreaterThan(1);
      expect((result as any)._textChunks[0].length).toBeLessThanOrEqual(30);
    });

    it('should chunk document by recursive strategy', async () => {
      const content = 'Line 1.\nLine 2.\n\nParagraph 2.\nLine 4.';
      const result = await documentProcessor.chunkDocument(content, {
        strategy: ChunkingStrategy.RECURSIVE,
        chunkSize: 20,
        chunkOverlap: 0,
      });
      expect(result.totalChunks).toBeGreaterThan(1);
      expect((result as any)._textChunks.length).toBeGreaterThan(1);
    });

    it('should chunk document by markdown strategy', async () => {
      const content = '# Heading\n\nSome text.\n\n```javascript\nconsole.log(

