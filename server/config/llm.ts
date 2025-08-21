import OpenAI from 'openai';
import { logger } from '@/core/utils/logger.js';

// OpenAI Configuration
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
  defaultModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
  timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
  maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
};

// Alternative LLM Configuration (Ollama/LM Studio)
const ollamaConfig = {
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'llama2',
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10),
};

// Create OpenAI client
export const openai = new OpenAI({
  apiKey: openaiConfig.apiKey,
  baseURL: openaiConfig.baseURL,
  timeout: openaiConfig.timeout,
  maxRetries: openaiConfig.maxRetries,
});

// LLM Provider types
export type LLMProvider = 'openai' | 'ollama';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: any;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  functions?: any[];
  functionCall?: any;
  tools?: any[];
  toolChoice?: any;
}

export interface LLMEmbeddingOptions {
  model?: string;
  dimensions?: number;
}

// LLM Manager
export class LLMManager {
  private static instance: LLMManager;
  private openaiClient: OpenAI;
  private isConnected = false;
  private provider: LLMProvider = 'openai';

  private constructor() {
    this.openaiClient = openai;
  }

  public static getInstance(): LLMManager {
    if (!LLMManager.instance) {
      LLMManager.instance = new LLMManager();
    }
    return LLMManager.instance;
  }

  public async connect(): Promise<void> {
    try {
      // Test OpenAI connection
      if (openaiConfig.apiKey) {
        await this.testOpenAIConnection();
        this.provider = 'openai';
        this.isConnected = true;
        logger.info('OpenAI LLM connected successfully');
      } else {
        // Fallback to Ollama if no OpenAI key
        await this.testOllamaConnection();
        this.provider = 'ollama';
        this.isConnected = true;
        logger.info('Ollama LLM connected successfully');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to LLM provider');
      throw error;
    }
  }

  private async testOpenAIConnection(): Promise<void> {
    try {
      await this.openaiClient.models.list();
    } catch (error) {
      throw new Error(`OpenAI connection failed: ${error}`);
    }
  }

  private async testOllamaConnection(): Promise<void> {
    try {
      const response = await fetch(`${ollamaConfig.baseURL}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama connection failed: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Ollama connection failed: ${error}`);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.isConnected = false;
      logger.info('LLM disconnected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to disconnect from LLM');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (this.provider === 'openai') {
        await this.openaiClient.models.list();
      } else {
        const response = await fetch(`${ollamaConfig.baseURL}/api/tags`);
        return response.ok;
      }
      return true;
    } catch (error) {
      logger.error({ error }, 'LLM health check failed');
      return false;
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public getProvider(): LLMProvider {
    return this.provider;
  }

  public getClient(): OpenAI {
    return this.openaiClient;
  }
}

// LLM Service
export class LLMService {
  private openaiClient: OpenAI;
  private provider: LLMProvider;

  constructor() {
    this.openaiClient = openai;
    this.provider = llmManager.getProvider();
  }

  async generateCompletion(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {}
  ): Promise<string> {
    try {
      const {
        model = openaiConfig.defaultModel,
        temperature = openaiConfig.temperature,
        maxTokens = openaiConfig.maxTokens,
        ...otherOptions
      } = options;

      if (this.provider === 'openai') {
        const response = await this.openaiClient.chat.completions.create({
          model,
          messages: messages as any,
          temperature,
          max_tokens: maxTokens,
          ...otherOptions,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in LLM response');
        }

        logger.debug({
          model,
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        }, 'LLM completion generated successfully');

        return content;
      } else {
        // Ollama implementation
        return await this.generateOllamaCompletion(messages, options);
      }
    } catch (error) {
      logger.error({ error, messages, options }, 'Failed to generate LLM completion');
      throw error;
    }
  }

  private async generateOllamaCompletion(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {}
  ): Promise<string> {
    try {
      const prompt = this.convertMessagesToPrompt(messages);
      
      const response = await fetch(`${ollamaConfig.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || ollamaConfig.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.1,
            top_p: options.topP || 0.9,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      logger.error({ error }, 'Failed to generate Ollama completion');
      throw error;
    }
  }

  private convertMessagesToPrompt(messages: LLMMessage[]): string {
    return messages
      .map(msg => {
        switch (msg.role) {
          case 'system':
            return `System: ${msg.content}`;
          case 'user':
            return `Human: ${msg.content}`;
          case 'assistant':
            return `Assistant: ${msg.content}`;
          default:
            return msg.content;
        }
      })
      .join('\n\n') + '\n\nAssistant:';
  }

  async generateEmbedding(
    text: string,
    options: LLMEmbeddingOptions = {}
  ): Promise<number[]> {
    try {
      if (this.provider !== 'openai') {
        throw new Error('Embeddings are only supported with OpenAI provider');
      }

      const {
        model = openaiConfig.embeddingModel,
        dimensions,
      } = options;

      const response = await this.openaiClient.embeddings.create({
        model,
        input: text,
        dimensions,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding in response');
      }

      logger.debug({
        model,
        textLength: text.length,
        embeddingDimensions: embedding.length,
        totalTokens: response.usage?.total_tokens,
      }, 'Embedding generated successfully');

      return embedding;
    } catch (error) {
      logger.error({ error, text: text.substring(0, 100) }, 'Failed to generate embedding');
      throw error;
    }
  }

  async generateEmbeddings(
    texts: string[],
    options: LLMEmbeddingOptions = {}
  ): Promise<number[][]> {
    try {
      if (this.provider !== 'openai') {
        throw new Error('Embeddings are only supported with OpenAI provider');
      }

      const {
        model = openaiConfig.embeddingModel,
        dimensions,
      } = options;

      const response = await this.openaiClient.embeddings.create({
        model,
        input: texts,
        dimensions,
      });

      const embeddings = response.data.map(item => item.embedding);

      logger.debug({
        model,
        textCount: texts.length,
        embeddingDimensions: embeddings[0]?.length,
        totalTokens: response.usage?.total_tokens,
      }, 'Embeddings generated successfully');

      return embeddings;
    } catch (error) {
      logger.error({ error, textCount: texts.length }, 'Failed to generate embeddings');
      throw error;
    }
  }

  async streamCompletion(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {}
  ): Promise<AsyncIterable<string>> {
    try {
      if (this.provider !== 'openai') {
        throw new Error('Streaming is only supported with OpenAI provider');
      }

      const {
        model = openaiConfig.defaultModel,
        temperature = openaiConfig.temperature,
        maxTokens = openaiConfig.maxTokens,
        ...otherOptions
      } = options;

      const stream = await this.openaiClient.chat.completions.create({
        model,
        messages: messages as any,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        ...otherOptions,
      });

      return this.processStream(stream);
    } catch (error) {
      logger.error({ error, messages, options }, 'Failed to create LLM stream');
      throw error;
    }
  }

  private async* processStream(stream: any): AsyncIterable<string> {
    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error processing LLM stream');
      throw error;
    }
  }
}

// Export singleton instances
export const llmManager = LLMManager.getInstance();
export const llmService = new LLMService();

// Graceful shutdown handling
process.on('beforeExit', async () => {
  await llmManager.disconnect();
});

process.on('SIGINT', async () => {
  await llmManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await llmManager.disconnect();
  process.exit(0);
});

