import OpenAI from 'openai';
import { logger } from '@/core/utils/logger';

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
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'mxbai-embed-large',
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10),
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '3', 10),
};

// LM Studio Configuration
const lmStudioConfig = {
  baseURL: process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234',
  apiKey: process.env.LM_STUDIO_API_KEY || 'lm-studio',
  embeddingModel: process.env.LM_STUDIO_EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5',
  timeout: parseInt(process.env.LM_STUDIO_TIMEOUT || '60000', 10),
  maxRetries: parseInt(process.env.LM_STUDIO_MAX_RETRIES || '3', 10),
};

// Create OpenAI client
export const openai = new OpenAI({
  apiKey: openaiConfig.apiKey,
  baseURL: openaiConfig.baseURL,
  timeout: openaiConfig.timeout,
  maxRetries: openaiConfig.maxRetries,
});

// Create LM Studio client (OpenAI-compatible)
export const lmStudio = new OpenAI({
  apiKey: lmStudioConfig.apiKey,
  baseURL: lmStudioConfig.baseURL + '/v1',
  timeout: lmStudioConfig.timeout,
  maxRetries: lmStudioConfig.maxRetries,
});

// LLM Provider types
export type LLMProvider = 'openai' | 'ollama' | 'lm-studio';

// Provider validation and configuration
function validateLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER as LLMProvider;
  
  if (!provider) {
    throw new Error(
      'LLM_PROVIDER environment variable is required. Set it to one of: openai, ollama, lm-studio'
    );
  }
  
  const validProviders: LLMProvider[] = ['openai', 'ollama', 'lm-studio'];
  if (!validProviders.includes(provider)) {
    throw new Error(
      `Invalid LLM_PROVIDER: ${provider}. Must be one of: ${validProviders.join(', ')}`
    );
  }
  
  // Validate required configuration for each provider
  switch (provider) {
    case 'openai':
      if (!openaiConfig.apiKey) {
        throw new Error(
          'OPENAI_API_KEY is required when LLM_PROVIDER=openai'
        );
      }
      break;
    case 'ollama':
      if (!ollamaConfig.baseURL) {
        throw new Error(
          'OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama'
        );
      }
      break;
    case 'lm-studio':
      if (!lmStudioConfig.baseURL) {
        throw new Error(
          'LM_STUDIO_BASE_URL is required when LLM_PROVIDER=lm-studio'
        );
      }
      break;
  }
  
  return provider;
}

// Get the configured provider
export const configuredProvider = validateLLMProvider();

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
  private lmStudioClient: OpenAI;
  private isConnected = false;
  private provider: LLMProvider = 'openai';

  private constructor() {
    this.openaiClient = openai;
    this.lmStudioClient = lmStudio;
  }

  public static getInstance(): LLMManager {
    if (!LLMManager.instance) {
      LLMManager.instance = new LLMManager();
    }
    return LLMManager.instance;
  }

  public async connect(): Promise<void> {
    try {
      // Use explicitly configured provider - no fallbacks
      this.provider = configuredProvider;
      
      switch (this.provider) {
        case 'openai':
          await this.testOpenAIConnection();
          logger.info('OpenAI LLM connected successfully');
          break;
        case 'ollama':
          await this.testOllamaConnection();
          logger.info('Ollama LLM connected successfully');
          break;
        case 'lm-studio':
          await this.testLMStudioConnection();
          logger.info('LM Studio LLM connected successfully');
          break;
        default:
          throw new Error(`Unsupported LLM provider: ${this.provider}`);
      }
      
      this.isConnected = true;
    } catch (error) {
      logger.error(
        { error, provider: this.provider },
        `Failed to connect to ${this.provider} LLM provider. Check your configuration and ensure the service is running.`
      );
      throw new Error(
        `LLM connection failed for provider '${this.provider}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async testOpenAIConnection(): Promise<void> {
    try {
      await this.openaiClient.models.list();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `OpenAI connection failed: ${errorMessage}\n` +
        `Configuration: API Base URL: ${openaiConfig.baseURL}\n` +
        `Please verify:\n` +
        `- OPENAI_API_KEY is set correctly\n` +
        `- OPENAI_API_BASE is accessible (${openaiConfig.baseURL})\n` +
        `- Network connectivity to OpenAI services`
      );
    }
  }

  private async testOllamaConnection(): Promise<void> {
    try {
      const response = await fetch(`${ollamaConfig.baseURL}/api/tags`);
      if (!response.ok) {
        throw new Error(
          `Ollama server responded with status ${response.status}: ${response.statusText}\n` +
          `Configuration: Base URL: ${ollamaConfig.baseURL}\n` +
          `Please verify:\n` +
          `- Ollama is running on ${ollamaConfig.baseURL}\n` +
          `- OLLAMA_BASE_URL is set correctly\n` +
          `- Ollama service is accessible and healthy`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(
          `Cannot connect to Ollama server at ${ollamaConfig.baseURL}\n` +
          `Please verify:\n` +
          `- Ollama is installed and running\n` +
          `- OLLAMA_BASE_URL is correct (current: ${ollamaConfig.baseURL})\n` +
          `- No firewall blocking the connection\n` +
          `- Run 'ollama serve' to start the server`
        );
      }
      throw error;
    }
  }

  private async testLMStudioConnection(): Promise<void> {
    try {
      // Test LM Studio connection with embeddings endpoint
      const response = await this.lmStudioClient.embeddings.create({
        model: lmStudioConfig.embeddingModel,
        input: 'test',
      });
      
      if (!response.data || !response.data[0]?.embedding) {
        throw new Error(
          `LM Studio embedding test failed - invalid response format\n` +
          `Configuration: Base URL: ${lmStudioConfig.baseURL}, Model: ${lmStudioConfig.embeddingModel}\n` +
          `Please verify the embedding model is loaded in LM Studio`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `LM Studio connection failed: ${errorMessage}\n` +
        `Configuration: Base URL: ${lmStudioConfig.baseURL}\n` +
        `Please verify:\n` +
        `- LM Studio is running with server enabled\n` +
        `- LM_STUDIO_BASE_URL is correct (current: ${lmStudioConfig.baseURL})\n` +
        `- An embedding model is loaded in LM Studio\n` +
        `- LM Studio server is accessible on the configured port`
      );
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
    switch (this.provider) {
      case 'lm-studio':
        return this.lmStudioClient;
      case 'openai':
      default:
        return this.openaiClient;
    }
  }

  public getLMStudioClient(): OpenAI {
    return this.lmStudioClient;
  }
}

// LLM Service
export class LLMService {
  private openaiClient: OpenAI;
  private lmStudioClient: OpenAI;
  private provider: LLMProvider;

  constructor() {
    this.openaiClient = llmManager.getClient();
    this.lmStudioClient = llmManager.getLMStudioClient();
    this.provider = configuredProvider;
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
          stream: false, // Ensure we get a non-streaming response
          ...otherOptions,
        });

        // Type guard to ensure we have a ChatCompletion response
        if ('choices' in response && response.choices) {
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
          throw new Error('Unexpected response format from OpenAI API');
        }
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

      const data = await response.json() as { response: string };
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
      if (this.provider === 'lm-studio') {
        return this.generateLMStudioEmbedding(text, options);
      } else if (this.provider === 'openai') {
        return this.generateOpenAIEmbedding(text, options);
      } else if (this.provider === 'ollama') {
        return this.generateOllamaEmbedding(text, options);
      } else {
        throw new Error(`Embeddings are not supported with ${this.provider} provider`);
      }
    } catch (error) {
      logger.error({ error, text: text.substring(0, 100) }, 'Failed to generate embedding');
      throw error;
    }
  }

  private async generateOpenAIEmbedding(
    text: string,
    options: LLMEmbeddingOptions = {}
  ): Promise<number[]> {
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
      provider: 'openai',
      model,
      textLength: text.length,
      embeddingDimensions: embedding.length,
      totalTokens: response.usage?.total_tokens,
    }, 'OpenAI embedding generated successfully');

    return embedding;
  }

  private async generateLMStudioEmbedding(
    text: string,
    options: LLMEmbeddingOptions = {}
  ): Promise<number[]> {
    const {
      model = lmStudioConfig.embeddingModel,
      dimensions,
    } = options;

    const response = await this.lmStudioClient.embeddings.create({
      model,
      input: text,
      dimensions,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding in response');
    }

    logger.debug({
      provider: 'lm-studio',
      model,
      textLength: text.length,
      embeddingDimensions: embedding.length,
      totalTokens: response.usage?.total_tokens,
    }, 'LM Studio embedding generated successfully');

    return embedding;
  }

  private async generateOllamaEmbedding(
    text: string,
    options: LLMEmbeddingOptions = {}
  ): Promise<number[]> {
    const {
      model = ollamaConfig.embeddingModel,
    } = options;

    const response = await fetch(`${ollamaConfig.baseURL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json() as { embedding: number[] };
    const embedding = data.embedding;
    
    if (!embedding) {
      throw new Error('No embedding in response');
    }

    logger.debug({
      provider: 'ollama',
      model,
      textLength: text.length,
      embeddingDimensions: embedding.length,
    }, 'Ollama embedding generated successfully');

    return embedding;
  }

  async generateEmbeddings(
    texts: string[],
    options: LLMEmbeddingOptions = {}
  ): Promise<number[][]> {
    try {
      if (this.provider === 'lm-studio') {
        return this.generateLMStudioEmbeddings(texts, options);
      } else if (this.provider === 'openai') {
        return this.generateOpenAIEmbeddings(texts, options);
      } else if (this.provider === 'ollama') {
        return this.generateOllamaEmbeddings(texts, options);
      } else {
        throw new Error(`Embeddings are not supported with ${this.provider} provider`);
      }
    } catch (error) {
      logger.error({ error, textCount: texts.length }, 'Failed to generate embeddings');
      throw error;
    }
  }

  private async generateOpenAIEmbeddings(
    texts: string[],
    options: LLMEmbeddingOptions = {}
  ): Promise<number[][]> {
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
      provider: 'openai',
      model,
      textCount: texts.length,
      embeddingDimensions: embeddings[0]?.length,
      totalTokens: response.usage?.total_tokens,
    }, 'OpenAI embeddings generated successfully');

    return embeddings;
  }

  private async generateLMStudioEmbeddings(
    texts: string[],
    options: LLMEmbeddingOptions = {}
  ): Promise<number[][]> {
    const {
      model = lmStudioConfig.embeddingModel,
      dimensions,
    } = options;

    const response = await this.lmStudioClient.embeddings.create({
      model,
      input: texts,
      dimensions,
    });

    const embeddings = response.data.map(item => item.embedding);

    logger.debug({
      provider: 'lm-studio',
      model,
      textCount: texts.length,
      embeddingDimensions: embeddings[0]?.length,
      totalTokens: response.usage?.total_tokens,
    }, 'LM Studio embeddings generated successfully');

    return embeddings;
  }

  private async generateOllamaEmbeddings(
    texts: string[],
    options: LLMEmbeddingOptions = {}
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.generateOllamaEmbedding(text, options);
      embeddings.push(embedding);
    }

    logger.debug({
      provider: 'ollama',
      textCount: texts.length,
      embeddingDimensions: embeddings[0]?.length,
    }, 'Ollama embeddings generated successfully');

    return embeddings;
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

