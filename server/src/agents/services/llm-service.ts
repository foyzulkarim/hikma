import OpenAI from 'openai';
import {
  ILLMService,
  LLMOptions,
  LLMMessage,
  LLMFunction,
  LLMFunctionCall,
} from '@/core/types/agents';
import { logger } from '@/core/utils/logger';
import { ExternalServiceError, RateLimitError } from '@/core/errors/app-error';

// Token estimation utility
class LLMTokenEstimator {
  // Rough estimation: 1 token ≈ 4 characters for English text
  private static readonly CHARS_PER_TOKEN = 4;

  static estimate(text: string): number {
    // More accurate estimation for chat models
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    // Use a combination of word count and character count
    const wordBasedEstimate = words * 1.3; // Average 1.3 tokens per word
    const charBasedEstimate = chars / this.CHARS_PER_TOKEN;
    
    // Take the higher estimate to be safe
    return Math.ceil(Math.max(wordBasedEstimate, charBasedEstimate));
  }

  static estimateMessages(messages: LLMMessage[]): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      // Add tokens for role and content
      totalTokens += this.estimate(message.role);
      totalTokens += this.estimate(message.content);
      
      // Add overhead for message formatting
      totalTokens += 4; // Rough overhead per message
    }
    
    // Add overhead for the conversation structure
    totalTokens += 3; // Rough overhead for the conversation
    
    return totalTokens;
  }
}

// OpenAI LLM service implementation
export class OpenAILLMService implements ILLMService {
  private client: OpenAI;
  private readonly defaultModel: string;
  private readonly defaultOptions: LLMOptions;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    });

    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.defaultOptions = {
      model: this.defaultModel,
      temperature: 0.7,
      maxTokens: 2000,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stream: false,
    };
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      logger.debug({
        prompt: prompt.substring(0, 100),
        model: mergedOptions.model,
        maxTokens: mergedOptions.maxTokens,
      }, 'Generating text with LLM');

      // Validate input
      if (!this.validateInput(prompt)) {
        throw new Error('Invalid input: prompt is too long or empty');
      }

      const response = await this.client.completions.create({
        model: mergedOptions.model!,
        prompt,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        frequency_penalty: mergedOptions.frequencyPenalty,
        presence_penalty: mergedOptions.presencePenalty,
        stop: mergedOptions.stop,
        user: mergedOptions.user,
      });

      const generatedText = response.choices[0]?.text || '';

      logger.debug({
        prompt: prompt.substring(0, 100),
        responseLength: generatedText.length,
        tokensUsed: response.usage?.total_tokens,
      }, 'Text generation completed');

      return generatedText.trim();

    } catch (error) {
      logger.error({
        prompt: prompt.substring(0, 100),
        model: mergedOptions.model,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Text generation failed');

      this.handleLLMError(error);
      throw error;
    }
  }

  async chatCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      logger.debug({
        messageCount: messages.length,
        model: mergedOptions.model,
        maxTokens: mergedOptions.maxTokens,
      }, 'Starting chat completion');

      // Validate input
      const estimatedTokens = LLMTokenEstimator.estimateMessages(messages);
      if (estimatedTokens > 16000) { // Conservative limit for most models
        throw new Error('Input too long: estimated tokens exceed model limit');
      }

      // Convert messages to OpenAI format
      const openaiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
        name: msg.name,
      }));

      const response = await this.client.chat.completions.create({
        model: mergedOptions.model!,
        messages: openaiMessages,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        frequency_penalty: mergedOptions.frequencyPenalty,
        presence_penalty: mergedOptions.presencePenalty,
        stop: mergedOptions.stop,
        user: mergedOptions.user,
      });

      const responseContent = response.choices[0]?.message?.content || '';

      logger.debug({
        messageCount: messages.length,
        responseLength: responseContent.length,
        tokensUsed: response.usage?.total_tokens,
      }, 'Chat completion completed');

      return responseContent;

    } catch (error) {
      logger.error({
        messageCount: messages.length,
        model: mergedOptions.model,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Chat completion failed');

      this.handleLLMError(error);
      throw error;
    }
  }

  async *streamText(prompt: string, options?: LLMOptions): AsyncIterable<string> {
    const mergedOptions = { ...this.defaultOptions, ...options, stream: true };

    try {
      logger.debug({
        prompt: prompt.substring(0, 100),
        model: mergedOptions.model,
      }, 'Starting text streaming');

      const stream = await this.client.completions.create({
        model: mergedOptions.model!,
        prompt,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        frequency_penalty: mergedOptions.frequencyPenalty,
        presence_penalty: mergedOptions.presencePenalty,
        stop: mergedOptions.stop,
        stream: true,
        user: mergedOptions.user,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.text || '';
        if (content) {
          yield content;
        }
      }

    } catch (error) {
      logger.error({
        prompt: prompt.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Text streaming failed');

      this.handleLLMError(error);
      throw error;
    }
  }

  async *streamChat(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<string> {
    const mergedOptions = { ...this.defaultOptions, ...options, stream: true };

    try {
      logger.debug({
        messageCount: messages.length,
        model: mergedOptions.model,
      }, 'Starting chat streaming');

      // Convert messages to OpenAI format
      const openaiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
        name: msg.name,
      }));

      const stream = await this.client.chat.completions.create({
        model: mergedOptions.model!,
        messages: openaiMessages,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        frequency_penalty: mergedOptions.frequencyPenalty,
        presence_penalty: mergedOptions.presencePenalty,
        stop: mergedOptions.stop,
        stream: true,
        user: mergedOptions.user,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }

    } catch (error) {
      logger.error({
        messageCount: messages.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Chat streaming failed');

      this.handleLLMError(error);
      throw error;
    }
  }

  async functionCall(
    messages: LLMMessage[],
    functions: LLMFunction[],
    options?: LLMOptions
  ): Promise<LLMFunctionCall> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      logger.debug({
        messageCount: messages.length,
        functionCount: functions.length,
        model: mergedOptions.model,
      }, 'Starting function call');

      // Convert messages to OpenAI format
      const openaiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
        name: msg.name,
      }));

      // Convert functions to OpenAI format
      const openaiTools = functions.map(func => ({
        type: 'function' as const,
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters,
        },
      }));

      const response = await this.client.chat.completions.create({
        model: mergedOptions.model!,
        messages: openaiMessages,
        tools: openaiTools,
        tool_choice: 'auto',
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        user: mergedOptions.user,
      });

      const message = response.choices[0]?.message;
      const toolCall = message?.tool_calls?.[0];

      if (!toolCall || toolCall.type !== 'function') {
        throw new Error('No function call returned from LLM');
      }

      const functionCall: LLMFunctionCall = {
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      };

      logger.debug({
        functionName: functionCall.name,
        tokensUsed: response.usage?.total_tokens,
      }, 'Function call completed');

      return functionCall;

    } catch (error) {
      logger.error({
        messageCount: messages.length,
        functionCount: functions.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Function call failed');

      this.handleLLMError(error);
      throw error;
    }
  }

  estimateTokens(text: string): number {
    return LLMTokenEstimator.estimate(text);
  }

  validateInput(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    // Check token limit (conservative estimate)
    const estimatedTokens = this.estimateTokens(text);
    return estimatedTokens <= 15000; // Leave room for response
  }

  // Utility methods
  async testConnection(): Promise<boolean> {
    try {
      await this.generateText('Hello', { maxTokens: 5 });
      return true;
    } catch (error) {
      logger.error({ error }, 'LLM service connection test failed');
      return false;
    }
  }

  getAvailableModels(): string[] {
    return [
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'gpt-4',
      'gpt-4-turbo-preview',
      'gpt-4o',
      'gpt-4o-mini',
    ];
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  // Model-specific token limits
  getModelTokenLimit(model: string): number {
    const limits: Record<string, number> = {
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo-preview': 128000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
    };

    return limits[model] || 4096;
  }

  // Create optimized prompts for different use cases
  createSystemPrompt(role: string, context?: string): string {
    const basePrompts: Record<string, string> = {
      'code_assistant': `You are an expert code assistant helping developers understand and work with their codebase. 
You have access to the project's code, documentation, and commit history. 
Provide clear, accurate, and helpful responses about the code.`,

      'documentation_helper': `You are a documentation assistant helping users find and understand project documentation.
You have access to all project documentation, README files, and code comments.
Provide comprehensive and well-structured answers.`,

      'commit_analyzer': `You are a commit analysis expert helping users understand code changes and their impact.
You have access to commit history, diffs, and related code context.
Provide insightful analysis of code changes and their implications.`,

      'general_assistant': `You are a helpful AI assistant with access to a project's codebase and documentation.
You can help with code understanding, documentation lookup, and general questions about the project.
Always provide accurate and helpful responses based on the available context.`,
    };

    let prompt = basePrompts[role] || basePrompts['general_assistant'];

    if (context) {
      prompt += `\n\nAdditional context: ${context}`;
    }

    prompt += `\n\nAlways cite your sources when referencing specific files, functions, or documentation.`;

    return prompt;
  }

  // Create user prompts with context
  createUserPrompt(query: string, sources: any[]): string {
    let prompt = `User query: ${query}\n\n`;

    if (sources.length > 0) {
      prompt += `Relevant context from the codebase:\n\n`;
      
      sources.forEach((source, index) => {
        prompt += `[${index + 1}] ${source.title}\n`;
        if (source.path) {
          prompt += `File: ${source.path}\n`;
        }
        prompt += `Content: ${source.content.substring(0, 1000)}${source.content.length > 1000 ? '...' : ''}\n\n`;
      });
    }

    prompt += `Please provide a helpful response based on the context above.`;

    return prompt;
  }

  // Error handling
  private handleLLMError(error: any): void {
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

      if (error.message.includes('timeout')) {
        throw new ExternalServiceError('OpenAI API request timed out');
      }
    }

    throw new ExternalServiceError(
      'OpenAI API request failed',
      { originalError: error }
    );
  }

  // Performance optimization
  async warmup(): Promise<void> {
    try {
      logger.info('Warming up LLM service...');
      
      await this.generateText('Hello', { maxTokens: 5 });
      
      logger.info('LLM service warmed up successfully');
    } catch (error) {
      logger.warn({ error }, 'Failed to warm up LLM service');
    }
  }

  // Batch processing
  async batchChatCompletion(
    requests: Array<{ messages: LLMMessage[]; options?: LLMOptions }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = [];
    
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      
      try {
        const response = await this.chatCompletion(request.messages, request.options);
        results.push(response);
      } catch (error) {
        logger.error({
          requestIndex: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Batch chat completion request failed');
        
        results.push(''); // Empty response for failed requests
      }
      
      onProgress?.(i + 1, requests.length);
    }
    
    return results;
  }
}

// Export singleton instance
export const llmService = new OpenAILLMService();

// Export the token estimator class
export { LLMTokenEstimator };

