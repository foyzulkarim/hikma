import { vi } from 'vitest';

// Mock OpenAI responses
export const mockOpenAIResponses = {
  chatCompletion: {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-3.5-turbo',
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content: 'This is a test response from the AI assistant.',
      },
      finish_reason: 'stop' as const,
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  },
  
  embedding: {
    object: 'list',
    data: [{
      object: 'embedding',
      index: 0,
      embedding: Array(1536).fill(0).map(() => Math.random() - 0.5), // Random 1536-dim vector
    }],
    model: 'text-embedding-ada-002',
    usage: {
      prompt_tokens: 5,
      total_tokens: 5,
    },
  },
  
  intentClassification: {
    id: 'chatcmpl-intent',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-3.5-turbo',
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content: JSON.stringify({
          intent: 'CODE_EXPLANATION',
          confidence: 0.9,
          reasoning: 'User wants to understand how code works',
        }),
      },
      finish_reason: 'stop' as const,
    }],
    usage: {
      prompt_tokens: 15,
      completion_tokens: 10,
      total_tokens: 25,
    },
  },
};

// Mock OpenAI client
export const mockOpenAIClient = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue(mockOpenAIResponses.chatCompletion),
    },
  },
  embeddings: {
    create: vi.fn().mockResolvedValue(mockOpenAIResponses.embedding),
  },
};

// Mock the OpenAI module
export const mockOpenAI = vi.fn().mockImplementation(() => mockOpenAIClient);

// Helper functions for test scenarios
export const openAIMockHelpers = {
  // Mock successful chat completion
  mockChatSuccess: (content: string = 'Test response') => {
    mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
      ...mockOpenAIResponses.chatCompletion,
      choices: [{
        ...mockOpenAIResponses.chatCompletion.choices[0],
        message: {
          role: 'assistant' as const,
          content,
        },
      }],
    });
  },
  
  // Mock chat completion error
  mockChatError: (error: Error = new Error('OpenAI API error')) => {
    mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(error);
  },
  
  // Mock successful embedding
  mockEmbeddingSuccess: (embedding?: number[]) => {
    const mockEmbedding = embedding || Array(1536).fill(0).map(() => Math.random() - 0.5);
    mockOpenAIClient.embeddings.create.mockResolvedValueOnce({
      ...mockOpenAIResponses.embedding,
      data: [{
        ...mockOpenAIResponses.embedding.data[0],
        embedding: mockEmbedding,
      }],
    });
  },
  
  // Mock embedding error
  mockEmbeddingError: (error: Error = new Error('Embedding API error')) => {
    mockOpenAIClient.embeddings.create.mockRejectedValueOnce(error);
  },
  
  // Mock intent classification response
  mockIntentClassification: (intent: string, confidence: number = 0.9) => {
    mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
      ...mockOpenAIResponses.intentClassification,
      choices: [{
        ...mockOpenAIResponses.intentClassification.choices[0],
        message: {
          role: 'assistant' as const,
          content: JSON.stringify({
            intent,
            confidence,
            reasoning: `Classified as ${intent}`,
          }),
        },
      }],
    });
  },
  
  // Mock rate limit error
  mockRateLimitError: () => {
    const error = new Error('Rate limit exceeded');
    (error as any).status = 429;
    mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(error);
  },
  
  // Mock token limit error
  mockTokenLimitError: () => {
    const error = new Error('Token limit exceeded');
    (error as any).status = 400;
    mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(error);
  },
  
  // Reset all mocks
  reset: () => {
    vi.clearAllMocks();
    mockOpenAIClient.chat.completions.create.mockResolvedValue(mockOpenAIResponses.chatCompletion);
    mockOpenAIClient.embeddings.create.mockResolvedValue(mockOpenAIResponses.embedding);
  },
  
  // Get call history
  getChatCalls: () => mockOpenAIClient.chat.completions.create.mock.calls,
  getEmbeddingCalls: () => mockOpenAIClient.embeddings.create.mock.calls,
  
  // Verify calls
  expectChatCalled: (times: number = 1) => {
    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(times);
  },
  expectEmbeddingCalled: (times: number = 1) => {
    expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(times);
  },
};

// Export for use in tests
export { mockOpenAIClient as openaiMock };

