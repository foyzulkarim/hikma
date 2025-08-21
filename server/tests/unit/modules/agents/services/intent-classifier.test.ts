import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentClassifier } from '@/modules/agents/services/intent-classifier.js';
import { openAIMockHelpers } from '@tests/mocks/openai.mock.js';

// Mock the LLM service
vi.mock('@/modules/agents/services/llm-service.js', () => ({
  LLMService: {
    getInstance: vi.fn().mockReturnValue({
      chatCompletion: vi.fn(),
    }),
  },
}));

describe('IntentClassifier', () => {
  let intentClassifier: IntentClassifier;

  beforeEach(() => {
    intentClassifier = new IntentClassifier();
    openAIMockHelpers.reset();
  });

  describe('classifyIntent', () => {
    it('should classify code explanation intent using rules', async () => {
      const query = 'What does this function do?';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('CODE_EXPLANATION');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.method).toBe('rule-based');
    });

    it('should classify code search intent using rules', async () => {
      const query = 'Find the login function';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('CODE_SEARCH');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.method).toBe('rule-based');
    });

    it('should classify documentation search intent using rules', async () => {
      const query = 'Show me the API documentation';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('DOCUMENTATION_SEARCH');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.method).toBe('rule-based');
    });

    it('should classify commit analysis intent using rules', async () => {
      const query = 'What changed in the last commit?';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('COMMIT_ANALYSIS');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.method).toBe('rule-based');
    });

    it('should fall back to LLM classification for ambiguous queries', async () => {
      const query = 'Help me understand this project';
      
      // Mock LLM response
      openAIMockHelpers.mockIntentClassification('GENERAL_QUERY', 0.85);

      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('GENERAL_QUERY');
      expect(result.confidence).toBe(0.85);
      expect(result.method).toBe('llm-based');
    });

    it('should handle LLM classification errors gracefully', async () => {
      const query = 'This is an ambiguous query';
      
      // Mock LLM error
      openAIMockHelpers.mockChatError(new Error('LLM service unavailable'));

      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('GENERAL_QUERY');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.method).toBe('fallback');
    });

    it('should provide reasoning for classification', async () => {
      const query = 'Explain how this algorithm works';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning).toContain('explanation');
    });

    it('should handle empty query', async () => {
      const query = '';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('GENERAL_QUERY');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle very long queries', async () => {
      const query = 'What does this function do? '.repeat(100);
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('CODE_EXPLANATION');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('classifyWithRules', () => {
    it('should identify code explanation patterns', () => {
      const queries = [
        'What does this function do?',
        'How does this code work?',
        'Explain this algorithm',
        'What is the purpose of this class?',
      ];

      queries.forEach(query => {
        const result = intentClassifier['classifyWithRules'](query);
        expect(result.intent).toBe('CODE_EXPLANATION');
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should identify code search patterns', () => {
      const queries = [
        'Find the login function',
        'Search for error handling',
        'Locate the database connection',
        'Where is the authentication logic?',
      ];

      queries.forEach(query => {
        const result = intentClassifier['classifyWithRules'](query);
        expect(result.intent).toBe('CODE_SEARCH');
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should identify documentation search patterns', () => {
      const queries = [
        'Show me the API documentation',
        'Find the README file',
        'Where are the installation instructions?',
        'Documentation for this library',
      ];

      queries.forEach(query => {
        const result = intentClassifier['classifyWithRules'](query);
        expect(result.intent).toBe('DOCUMENTATION_SEARCH');
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should identify commit analysis patterns', () => {
      const queries = [
        'What changed in the last commit?',
        'Show me recent changes',
        'What was modified yesterday?',
        'Commit history for this file',
      ];

      queries.forEach(query => {
        const result = intentClassifier['classifyWithRules'](query);
        expect(result.intent).toBe('COMMIT_ANALYSIS');
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should return low confidence for ambiguous queries', () => {
      const queries = [
        'Help me',
        'I need assistance',
        'This is confusing',
        'Random text here',
      ];

      queries.forEach(query => {
        const result = intentClassifier['classifyWithRules'](query);
        expect(result.confidence).toBeLessThan(0.5);
      });
    });
  });

  describe('classifyWithLLM', () => {
    it('should classify intent using LLM', async () => {
      const query = 'Help me understand this codebase';
      
      openAIMockHelpers.mockIntentClassification('GENERAL_QUERY', 0.9);

      const result = await intentClassifier['classifyWithLLM'](query);

      expect(result.intent).toBe('GENERAL_QUERY');
      expect(result.confidence).toBe(0.9);
      expect(result.reasoning).toBeDefined();
    });

    it('should handle invalid LLM response format', async () => {
      const query = 'Test query';
      
      // Mock invalid JSON response
      openAIMockHelpers.mockChatSuccess('Invalid JSON response');

      const result = await intentClassifier['classifyWithLLM'](query);

      expect(result.intent).toBe('GENERAL_QUERY');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle LLM service errors', async () => {
      const query = 'Test query';
      
      openAIMockHelpers.mockChatError(new Error('Service unavailable'));

      await expect(intentClassifier['classifyWithLLM'](query)).rejects.toThrow();
    });

    it('should validate LLM response structure', async () => {
      const query = 'Test query';
      
      // Mock response with missing fields
      openAIMockHelpers.mockChatSuccess(JSON.stringify({
        intent: 'CODE_EXPLANATION',
        // Missing confidence and reasoning
      }));

      const result = await intentClassifier['classifyWithLLM'](query);

      expect(result.intent).toBe('CODE_EXPLANATION');
      expect(result.confidence).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });
  });

  describe('combineResults', () => {
    it('should prefer rule-based result when confidence is high', () => {
      const ruleResult = {
        intent: 'CODE_EXPLANATION' as const,
        confidence: 0.9,
        reasoning: 'Rule-based classification',
        method: 'rule-based' as const,
      };

      const llmResult = {
        intent: 'GENERAL_QUERY' as const,
        confidence: 0.7,
        reasoning: 'LLM classification',
        method: 'llm-based' as const,
      };

      const result = intentClassifier['combineResults'](ruleResult, llmResult);

      expect(result.intent).toBe('CODE_EXPLANATION');
      expect(result.method).toBe('rule-based');
    });

    it('should prefer LLM result when rule confidence is low', () => {
      const ruleResult = {
        intent: 'GENERAL_QUERY' as const,
        confidence: 0.3,
        reasoning: 'Low confidence rule match',
        method: 'rule-based' as const,
      };

      const llmResult = {
        intent: 'CODE_SEARCH' as const,
        confidence: 0.8,
        reasoning: 'LLM classification',
        method: 'llm-based' as const,
      };

      const result = intentClassifier['combineResults'](ruleResult, llmResult);

      expect(result.intent).toBe('CODE_SEARCH');
      expect(result.method).toBe('llm-based');
    });

    it('should combine reasoning from both methods', () => {
      const ruleResult = {
        intent: 'CODE_EXPLANATION' as const,
        confidence: 0.6,
        reasoning: 'Rule-based reasoning',
        method: 'rule-based' as const,
      };

      const llmResult = {
        intent: 'CODE_EXPLANATION' as const,
        confidence: 0.8,
        reasoning: 'LLM reasoning',
        method: 'llm-based' as const,
      };

      const result = intentClassifier['combineResults'](ruleResult, llmResult);

      expect(result.reasoning).toContain('Rule-based reasoning');
      expect(result.reasoning).toContain('LLM reasoning');
      expect(result.method).toBe('hybrid');
    });
  });

  describe('edge cases', () => {
    it('should handle queries with special characters', async () => {
      const query = 'What does this function do? @#$%^&*()';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('CODE_EXPLANATION');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle queries in different cases', async () => {
      const queries = [
        'WHAT DOES THIS FUNCTION DO?',
        'what does this function do?',
        'What Does This Function Do?',
      ];

      for (const query of queries) {
        const result = await intentClassifier.classifyIntent(query);
        expect(result.intent).toBe('CODE_EXPLANATION');
      }
    });

    it('should handle queries with extra whitespace', async () => {
      const query = '   What does this function do?   ';
      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('CODE_EXPLANATION');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle non-English queries gracefully', async () => {
      const query = '这个函数是做什么的？'; // Chinese: "What does this function do?"
      
      openAIMockHelpers.mockIntentClassification('CODE_EXPLANATION', 0.8);

      const result = await intentClassifier.classifyIntent(query);

      expect(result.intent).toBe('CODE_EXPLANATION');
      expect(result.method).toBe('llm-based');
    });
  });
});

