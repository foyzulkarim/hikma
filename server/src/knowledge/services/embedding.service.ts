import { DocumentChunk } from '@prisma/client';
import { llmService } from '@/config/llm';
import { logger } from '@/core/utils/logger';
import { EmbeddingModel } from '@/core/types/embeddings';

export interface EmbeddingServiceConfig {
  model: EmbeddingModel;
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
}

const defaultConfig: EmbeddingServiceConfig = {
  model: EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL,
  batchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
};

export class EmbeddingService {
  private config: EmbeddingServiceConfig;

  constructor(config: Partial<EmbeddingServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Generate embedding for a single text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      // Clean and prepare text
      const cleanText = this.preprocessText(text);
      
      // Generate embedding using LLM service
      const embedding = await llmService.generateEmbedding(cleanText, {
        model: this.config.model,
      });

      logger.debug({
        textLength: text.length,
        embeddingDimensions: embedding.length,
        model: this.config.model,
      }, 'Generated embedding for text');

      return embedding;
    } catch (error) {
      logger.error({ error, textLength: text?.length }, 'Failed to generate embedding');
      throw error;
    }
  }

  /**
   * Generate embedding for a document chunk
   */
  async embedChunk(chunk: DocumentChunk): Promise<number[]> {
    try {
      if (!chunk.content) {
        throw new Error('Chunk content cannot be empty');
      }

      // Create embedding text from chunk content and metadata
      const embeddingText = this.createEmbeddingText(chunk);
      
      const embedding = await this.generateEmbedding(embeddingText);

      logger.debug({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        contentLength: chunk.content.length,
        embeddingDimensions: embedding.length,
      }, 'Generated embedding for chunk');

      return embedding;
    } catch (error) {
      logger.error({ 
        error, 
        chunkId: chunk.id, 
        documentId: chunk.documentId 
      }, 'Failed to generate embedding for chunk');
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple chunks in batches
   */
  async embedChunks(chunks: DocumentChunk[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();
    const errors: Array<{ chunkId: string; error: any }> = [];

    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      const batch = chunks.slice(i, i + this.config.batchSize);
      
      logger.info({
        batchStart: i + 1,
        batchEnd: Math.min(i + this.config.batchSize, chunks.length),
        totalChunks: chunks.length,
      }, 'Processing embedding batch');

      // Process batch with retry logic
      await Promise.allSettled(
        batch.map(async (chunk) => {
          try {
            const embedding = await this.embedChunk(chunk);
            results.set(chunk.id, embedding);
          } catch (error) {
            errors.push({ chunkId: chunk.id, error });
            logger.warn({ 
              chunkId: chunk.id, 
              error 
            }, 'Failed to embed chunk in batch');
          }
        })
      );

      // Add delay between batches to respect rate limits
      if (i + this.config.batchSize < chunks.length) {
        await this.delay(100); // 100ms delay between batches
      }
    }

    logger.info({
      totalChunks: chunks.length,
      successfulEmbeddings: results.size,
      errors: errors.length,
    }, 'Completed batch embedding generation');

    if (errors.length > 0) {
      logger.warn({ errors }, 'Some chunks failed to generate embeddings');
    }

    return results;
  }

  /**
   * Create embedding text from chunk content and metadata
   */
  private createEmbeddingText(chunk: DocumentChunk): string {
    let embeddingText = chunk.content;

    // Add metadata context if available
    if (chunk.metadata && typeof chunk.metadata === 'object') {
      const metadata = chunk.metadata as any;
      
      // Add AST metadata for code chunks
      if (metadata.astNodeType) {
        const astInfo = [];
        if (metadata.functionName) astInfo.push(`function: ${metadata.functionName}`);
        if (metadata.className) astInfo.push(`class: ${metadata.className}`);
        if (metadata.methodName) astInfo.push(`method: ${metadata.methodName}`);
        if (metadata.astNodeType) astInfo.push(`type: ${metadata.astNodeType}`);
        
        if (astInfo.length > 0) {
          embeddingText = `${astInfo.join(', ')}\n\n${embeddingText}`;
        }
      }

      // Add file path context
      if (metadata.path) {
        embeddingText = `File: ${metadata.path}\n\n${embeddingText}`;
      }
    }

    return embeddingText;
  }

  /**
   * Preprocess text for embedding generation
   */
  private preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 8000); // Limit text length for embedding model
  }

  /**
   * Utility method for delays
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get embedding dimensions for the current model
   */
  getEmbeddingDimensions(): number {
    switch (this.config.model) {
      case EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL:
        return 1536;
      case EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_LARGE:
        return 3072;
      case EmbeddingModel.OPENAI_TEXT_EMBEDDING_ADA_002:
        return 1536;
      default:
        return 1536;
    }
  }

  /**
   * Validate if text is suitable for embedding
   */
  validateText(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const trimmed = text.trim();
    return trimmed.length > 0 && trimmed.length <= 8000;
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingServiceConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();