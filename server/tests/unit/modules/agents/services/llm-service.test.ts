import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMService } from '@/modules/agents/services/llm-service.js';
import { openAIMockHelpers } from '@tests/mocks/openai.mock.js';
import { config } from '@/config/app.js';

// Mock the OpenAI API client
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('LLMService', () => {
  let llmService: LLMService;

  beforeEach(() => {
    llmService = LLMService.getInstance();
    openAIMockHelpers.reset();
  });

  describe('chatCompletion', () => {
    it('should return a chat completion response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello, world!',
              role: 'assistant',
            },
            finish_reason: 'stop',
          },
        ],
        id: 'chatcmpl-123',
        model: 'gpt-3.5-turbo',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      openAIMockHelpers.mockChatSuccess(mockResponse);

      const messages = [{ role: 'user', content: 'Hi' }];
      const response = await llmService.chatCompletion(messages);

      expect(response.choices[0].message.content).toBe('Hello, world!');
      expect(openAIMockHelpers.getChatCreateCalls()[0][0].messages).toEqual(messages);
    });

    it('should handle streaming responses', async () => {
      const mockStreamChunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ', world!' } }] },
        { choices: [{ delta: { content: '' }, finish_reason: 'stop' }] },
      ];
      openAIMockHelpers.mockChatStream(mockStreamChunks);

      const messages = [{ role: 'user', content: 'Stream me' }];
      const stream = await llmService.chatCompletion(messages, { stream: true });

      let content = '';
      for await (const chunk of stream) {
        content += chunk.choices[0]?.delta?.content || '';
      }

      expect(content).toBe('Hello, world!');
      expect(openAIMockHelpers.getChatCreateCalls()[0][0].stream).toBe(true);
    });

    it('should include tools in the request if provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'test_tool', arguments: '{\

