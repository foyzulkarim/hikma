import OpenAI from 'openai';
import {
  IEmbeddingService,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingModel,
  EmbeddingConfig,
} from '@/core/types/embeddings';
import { config } from '@/config/app';
import { logger } from '@/core/utils/logger';
import { ExternalServiceError, RateLimitError } from '@/core/errors/app-error';

// Token estimation utility
class TokenEstimator {
  // Rough estimation: 1 token ≈ 4 characters for English text
  private static readonly CHARS_PER_TOKEN = 4;

  static estimate(text: string): number {
    // More accurate estimation based on OpenAI's tokenizer patterns
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    // Use a combination of word count and character count
    const wordBasedEstimate = words * 1.3; // Average 1.3 tokens per word
    const charBasedEstimate = chars / this.CHARS_PER_TOKEN;
    
    // Take the higher estimate to be safe
    return Math.ceil(Math.max(wordBasedEstimate, charBasedEstimate));
  }

  static splitByTokenLimit(text: string, maxTokens: number): string[] {
    const estimatedTokens = this.estimate(text);
    
    if (estimatedTokens <= maxTokens) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimate(sentence);
      
      if (currentTokens + sentenceTokens > maxTokens) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

// Rate limiter for API calls
class RateLimiter {
  private requestQueue: Array<{ timestamp: number; tokens: number }> = [];
  private readonly windowMs = 60000; // 1 minute

  constructor(
    private readonly maxRequestsPerMinute: number,
    private readonly maxTokensPerMinute: number
  ) {}

  async checkRateLimit(tokens: number): Promise<void> {
    const now = Date.now();
    
    // Clean old entries
    this.requestQueue = this.requestQueue.filter(
      entry => now - entry.timestamp < this.windowMs
    );

    // Check request limit
    if (this.requestQueue.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requestQueue[0];
      const waitTime = this.windowMs - (now - oldestRequest.timestamp);
      throw new RateLimitError(
        `Rate limit exceeded: too many requests. Wait ${Math.ceil(waitTime / 1000)} seconds.`
      );
    }

    // Check token limit
    const totalTokens = this.requestQueue.reduce((sum, entry) => sum + entry.tokens, 0);
    if (totalTokens + tokens > this.maxTokensPerMinute) {
      throw new RateLimitError(
        `Rate limit exceeded: too many tokens. Current: ${totalTokens}, requested: ${tokens}, limit: ${this.maxTokensPerMinute}`
      );
    }

    // Add current request
    this.requestQueue.push({ timestamp: now, tokens });
  }
}

// OpenAI embedding service implementation
export class OpenAIEmbeddingService implements IEmbeddingService {
  private client: OpenAI;
  private rateLimiter: RateLimiter;
  private readonly modelConfigs: Map<EmbeddingModel, EmbeddingConfig>;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.llm.apiKey,
    });

    // Initialize model configurations
    this.modelConfigs = new Map([
      [EmbeddingModel.OPENAI_TEXT_EMBEDDING_ADA_002, {
        model: EmbeddingModel.OPENAI_TEXT_EMBEDDING_ADA_002,
        dimensions: 1536,
        maxTokens: 8191,
        batchSize: 100,
        rateLimitRpm: 3000,
        rateLimitTpm: 1000000,
      }],
      [EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL, {
        model: EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL,
        dimensions: 1536,
        maxTokens: 8191,
        batchSize: 100,
        rateLimitRpm: 3000,
        rateLimitTpm: 1000000,
      }],
      [EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_LARGE, {
        model: EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_LARGE,
        dimensions: 3072,
        maxTokens: 8191,
        batchSize: 100,
        rateLimitRpm: 3000,
        rateLimitTpm: 1000000,
      }],
    ]);

    // Initialize rate limiter with default model limits
    const defaultConfig = this.modelConfigs.get(EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL)!;
    this.rateLimiter = new RateLimiter(
      defaultConfig.rateLimitRpm,
      defaultConfig.rateLimitTpm
    );
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Check if we should mock external APIs for development
    if (process.env.DEV_MOCK_EXTERNAL_APIS === 'true') {
      const model = request.model || EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL;
      const modelConfig = this.getModelInfo(model);
      
      // Return mock embeddings
      const mockEmbeddings = request.texts.map(() => 
        Array.from({ length: modelConfig.dimensions }, () => Math.random() - 0.5)
      );
      
      logger.info({ model, textCount: request.texts.length }, 'Generated mock embeddings for development');
      
      return {
        embeddings: mockEmbeddings,
        model,
        usage: {
          promptTokens: request.texts.reduce((sum, text) => sum + this.estimateTokens(text), 0),
          totalTokens: request.texts.reduce((sum, text) => sum + this.estimateTokens(text), 0),
        },
      };
    }

    const model = request.model || EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL;
    const modelConfig = this.getModelInfo(model);

    try {
      // Validate inputs
      for (const text of request.texts) {
        if (!this.validateText(text, model)) {
          throw new Error(`Text exceeds maximum token limit for model ${model}`);
        }
      }

      // Estimate total tokens
      const totalTokens = request.texts.reduce(
        (sum, text) => sum + this.estimateTokens(text),
        0
      );

      // Check rate limits
      await this.rateLimiter.checkRateLimit(totalTokens);

      // Process in batches if necessary
      const batches = this.createBatches(request.texts, modelConfig.batchSize);
      const allEmbeddings: number[][] = [];
      let totalPromptTokens = 0;

      for (const batch of batches) {
        const batchResponse = await this.processBatch(batch, model, request.user);
        allEmbeddings.push(...batchResponse.data.map(item => item.embedding));
        totalPromptTokens += batchResponse.usage.prompt_tokens;
      }

      const response: EmbeddingResponse = {
        embeddings: allEmbeddings,
        model: model,
        usage: {
          promptTokens: totalPromptTokens,
          totalTokens: totalPromptTokens,
        },
      };

      logger.info({
        model,
        textCount: request.texts.length,
        totalTokens: totalPromptTokens,
        batchCount: batches.length,
      }, 'Generated embeddings successfully');

      return response;

    } catch (error) {
      logger.error({
        model,
        textCount: request.texts.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to generate embeddings');

      if (error instanceof RateLimitError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Failed to generate embeddings',
        { model, textCount: request.texts.length, originalError: error }
      );
    }
  }

  async generateEmbedding(text: string, model?: EmbeddingModel): Promise<number[]> {
    const response = await this.generateEmbeddings({
      texts: [text],
      model,
    });

    return response.embeddings[0];
  }

  getModelInfo(model: EmbeddingModel): EmbeddingConfig {
    const config = this.modelConfigs.get(model);
    if (!config) {
      throw new Error(`Unsupported embedding model: ${model}`);
    }
    return config;
  }

  validateText(text: string, model: EmbeddingModel): boolean {
    const modelConfig = this.getModelInfo(model);
    const estimatedTokens = this.estimateTokens(text);
    
    return estimatedTokens <= modelConfig.maxTokens;
  }

  estimateTokens(text: string): number {
    return TokenEstimator.estimate(text);
  }

  splitTextForEmbedding(text: string, model: EmbeddingModel): string[] {
    const modelConfig = this.getModelInfo(model);
    return TokenEstimator.splitByTokenLimit(text, modelConfig.maxTokens);
  }

  // Private helper methods
  private createBatches(texts: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private async processBatch(
    texts: string[],
    model: EmbeddingModel,
    user?: string
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.embeddings.create({
        model: model,
        input: texts,
        user: user,
      });

      const duration = Date.now() - startTime;

      logger.debug({
        model,
        batchSize: texts.length,
        duration,
        tokensUsed: response.usage.prompt_tokens,
      }, 'Processed embedding batch');

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error({
        model,
        batchSize: texts.length,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to process embedding batch');

      // Handle specific OpenAI errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw new RateLimitError('OpenAI API rate limit exceeded');
        }
        
        if (error.message.includes('quota')) {
          throw new ExternalServiceError('OpenAI API quota exceeded');
        }
        
        if (error.message.includes('invalid')) {
          throw new ExternalServiceError('Invalid request to OpenAI API');
        }
      }

      throw new ExternalServiceError(
        'OpenAI API request failed',
        { model, batchSize: texts.length, originalError: error }
      );
    }
  }

  // Utility methods for service management
  async testConnection(): Promise<boolean> {
    try {
      // Return true immediately if mocking is enabled
      if (process.env.DEV_MOCK_EXTERNAL_APIS === 'true') {
        logger.info('Embedding service connection test passed (mocked)');
        return true;
      }
      
      await this.generateEmbedding('test', EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL);
      return true;
    } catch (error) {
      logger.error({ error }, 'Embedding service connection test failed');
      return false;
    }
  }

  getAvailableModels(): EmbeddingModel[] {
    return Array.from(this.modelConfigs.keys());
  }

  getDefaultModel(): EmbeddingModel {
    return EmbeddingModel.OPENAI_TEXT_EMBEDDING_3_SMALL;
  }

  // Performance optimization methods
  async warmup(): Promise<void> {
    try {
      logger.info('Warming up embedding service...');
      
      // Generate a small embedding to initialize the connection
      await this.generateEmbedding(
        'Warming up the embedding service',
        this.getDefaultModel()
      );
      
      logger.info('Embedding service warmed up successfully');
    } catch (error) {
      logger.warn({ error }, 'Failed to warm up embedding service');
    }
  }

  // Batch processing with progress tracking
  async generateEmbeddingsWithProgress(
    texts: string[],
    model?: EmbeddingModel,
    onProgress?: (completed: number, total: number) => void
  ): Promise<EmbeddingResponse> {
    const selectedModel = model || this.getDefaultModel();
    const modelConfig = this.getModelInfo(selectedModel);
    const batches = this.createBatches(texts, modelConfig.batchSize);
    
    const allEmbeddings: number[][] = [];
    let totalPromptTokens = 0;
    let completed = 0;

    for (const batch of batches) {
      const batchResponse = await this.processBatch(batch, selectedModel);
      allEmbeddings.push(...batchResponse.data.map(item => item.embedding));
      totalPromptTokens += batchResponse.usage.prompt_tokens;
      
      completed += batch.length;
      onProgress?.(completed, texts.length);
    }

    return {
      embeddings: allEmbeddings,
      model: selectedModel,
      usage: {
        promptTokens: totalPromptTokens,
        totalTokens: totalPromptTokens,
      },
    };
  }
}

// Export singleton instance
export const embeddingService = new OpenAIEmbeddingService();

export { TokenEstimator, RateLimiter };

