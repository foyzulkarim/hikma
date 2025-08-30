import {
  AgentIntent,
  IntentClassification,
  AgentContext,
  LLMMessage,
} from '@/core/types/agents';
import { llmService } from './llm-service';
import { logger } from '@/core/utils/logger';
import { ValidationError } from '@/core/errors/app-error';

// Intent classification patterns
interface IntentPattern {
  intent: AgentIntent;
  keywords: string[];
  patterns: RegExp[];
  examples: string[];
  confidence: number;
}

// Intent classification service
export class IntentClassificationService {
  private readonly intentPatterns: IntentPattern[] = [
    {
      intent: AgentIntent.CODE_EXPLANATION,
      keywords: ['explain', 'what does', 'how does', 'understand', 'clarify', 'describe', 'function', 'class', 'method'],
      patterns: [
        /what\s+(does|is)\s+.+\s+(do|doing|function|class|method)/i,
        /explain\s+.+\s+(code|function|class|method)/i,
        /how\s+(does|do)\s+.+\s+work/i,
        /can\s+you\s+explain/i,
      ],
      examples: [
        'What does this function do?',
        'Explain how this class works',
        'Can you describe this method?',
        'How does this code function?',
      ],
      confidence: 0.8,
    },
    {
      intent: AgentIntent.CODE_SEARCH,
      keywords: ['find', 'search', 'locate', 'where', 'show me', 'look for', 'implementation'],
      patterns: [
        /find\s+.+\s+(function|class|method|code)/i,
        /where\s+(is|are)\s+.+\s+(defined|implemented|located)/i,
        /search\s+for\s+.+/i,
        /show\s+me\s+.+\s+(code|implementation)/i,
        /look\s+for\s+.+/i,
      ],
      examples: [
        'Find the login function',
        'Where is the User class defined?',
        'Search for authentication code',
        'Show me the API implementation',
      ],
      confidence: 0.85,
    },
    {
      intent: AgentIntent.DOCUMENTATION_SEARCH,
      keywords: ['documentation', 'docs', 'readme', 'guide', 'tutorial', 'manual', 'instructions'],
      patterns: [
        /documentation\s+(for|about)/i,
        /(readme|docs)\s+.+/i,
        /how\s+to\s+.+/i,
        /guide\s+(for|to)\s+.+/i,
        /instructions\s+(for|on)\s+.+/i,
      ],
      examples: [
        'Show me the documentation for this API',
        'Find the README for setup',
        'How to configure this service?',
        'Guide for deployment',
      ],
      confidence: 0.9,
    },
    {
      intent: AgentIntent.COMMIT_ANALYSIS,
      keywords: ['commit', 'change', 'diff', 'history', 'modified', 'updated', 'recent', 'git'],
      patterns: [
        /recent\s+(changes|commits)/i,
        /what\s+(changed|was\s+modified)/i,
        /commit\s+(history|analysis)/i,
        /diff\s+.+/i,
        /git\s+(log|history)/i,
      ],
      examples: [
        'What changed in the recent commits?',
        'Show me the commit history',
        'Analyze recent changes',
        'What was modified in this file?',
      ],
      confidence: 0.85,
    },
    {
      intent: AgentIntent.GENERAL_QUERY,
      keywords: ['help', 'question', 'about', 'overview', 'summary', 'general'],
      patterns: [
        /tell\s+me\s+about/i,
        /overview\s+of/i,
        /summary\s+of/i,
        /general\s+question/i,
        /help\s+with/i,
      ],
      examples: [
        'Tell me about this project',
        'Give me an overview of the architecture',
        'Help me understand the codebase',
        'General question about the system',
      ],
      confidence: 0.6,
    },
  ];

  async classifyIntent(query: string, context?: AgentContext): Promise<IntentClassification> {
    try {
      logger.debug({
        query: query.substring(0, 100),
        hasContext: !!context,
      }, 'Starting intent classification');

      // Validate input
      if (!query || query.trim().length === 0) {
        throw new ValidationError('Query cannot be empty');
      }

      // First, try rule-based classification
      const ruleBasedResult = this.classifyWithRules(query);
      
      // If rule-based classification is confident enough, use it
      if (ruleBasedResult.confidence >= 0.8) {
        logger.debug({
          query: query.substring(0, 100),
          intent: ruleBasedResult.intent,
          confidence: ruleBasedResult.confidence,
          method: 'rule-based',
        }, 'Intent classified using rules');

        return ruleBasedResult;
      }

      // Otherwise, use LLM-based classification
      const llmBasedResult = await this.classifyWithLLM(query, context);

      // Combine results if both have reasonable confidence
      const finalResult = this.combineClassifications(ruleBasedResult, llmBasedResult);

      logger.debug({
        query: query.substring(0, 100),
        intent: finalResult.intent,
        confidence: finalResult.confidence,
        method: 'combined',
      }, 'Intent classification completed');

      return finalResult;

    } catch (error) {
      logger.error({
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Intent classification failed');

      // Return unknown intent as fallback
      return {
        intent: AgentIntent.UNKNOWN,
        confidence: 0.0,
        reasoning: 'Classification failed due to error',
      };
    }
  }

  private classifyWithRules(query: string): IntentClassification {
    const queryLower = query.toLowerCase();
    let bestMatch: IntentPattern | null = null;
    let bestScore = 0;

    for (const pattern of this.intentPatterns) {
      let score = 0;

      // Check keyword matches
      const keywordMatches = pattern.keywords.filter(keyword => 
        queryLower.includes(keyword.toLowerCase())
      ).length;
      score += (keywordMatches / pattern.keywords.length) * 0.6;

      // Check pattern matches
      const patternMatches = pattern.patterns.filter(regex => 
        regex.test(query)
      ).length;
      score += (patternMatches / pattern.patterns.length) * 0.4;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    if (bestMatch && bestScore > 0.3) {
      return {
        intent: bestMatch.intent,
        confidence: Math.min(bestScore * bestMatch.confidence, 1.0),
        reasoning: `Matched keywords and patterns for ${bestMatch.intent}`,
        extractedEntities: this.extractEntities(query, bestMatch.intent),
      };
    }

    return {
      intent: AgentIntent.UNKNOWN,
      confidence: 0.0,
      reasoning: 'No rule-based patterns matched',
    };
  }

  private async classifyWithLLM(query: string, context?: AgentContext): Promise<IntentClassification> {
    try {
      const systemPrompt = this.createClassificationPrompt();
      const userPrompt = this.createUserPrompt(query, context);

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await llmService.chatCompletion(messages, {
        temperature: 0.1, // Low temperature for consistent classification
        maxTokens: 200,
      });

      return this.parseClassificationResponse(response);

    } catch (error) {
      logger.error({
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'LLM-based intent classification failed');

      return {
        intent: AgentIntent.UNKNOWN,
        confidence: 0.0,
        reasoning: 'LLM classification failed',
      };
    }
  }

  private createClassificationPrompt(): string {
    return `You are an intent classifier for a code intelligence assistant. Your job is to classify user queries into one of these intents:

1. CODE_EXPLANATION: User wants to understand how specific code works
2. CODE_SEARCH: User wants to find specific code, functions, or implementations
3. DOCUMENTATION_SEARCH: User wants to find documentation, guides, or instructions
4. COMMIT_ANALYSIS: User wants to understand code changes, commits, or history
5. GENERAL_QUERY: User has general questions about the project or codebase

Respond with a JSON object containing:
- intent: one of the above intents
- confidence: a number between 0 and 1
- reasoning: brief explanation of your classification

Examples:
Query: "What does the authenticate function do?"
Response: {"intent": "CODE_EXPLANATION", "confidence": 0.9, "reasoning": "User wants to understand how a specific function works"}

Query: "Find the user login implementation"
Response: {"intent": "CODE_SEARCH", "confidence": 0.85, "reasoning": "User wants to locate specific code implementation"}

Query: "How do I set up the development environment?"
Response: {"intent": "DOCUMENTATION_SEARCH", "confidence": 0.9, "reasoning": "User needs setup instructions from documentation"}`;
  }

  private createUserPrompt(query: string, context?: AgentContext): string {
    let prompt = `Classify this query: "${query}"`;

    if (context) {
      if (context.currentFile) {
        prompt += `\nContext: User is currently viewing file: ${context.currentFile}`;
      }
      
      if (context.selectedCode) {
        prompt += `\nContext: User has selected code: ${context.selectedCode.substring(0, 200)}`;
      }
      
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];
        prompt += `\nContext: Previous conversation about: ${lastMessage.content.substring(0, 100)}`;
      }
    }

    return prompt;
  }

  private parseClassificationResponse(response: string): IntentClassification {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(response);
      
      // Validate the response
      if (!parsed.intent || !Object.values(AgentIntent).includes(parsed.intent)) {
        throw new Error('Invalid intent in response');
      }

      return {
        intent: parsed.intent as AgentIntent,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        reasoning: parsed.reasoning || 'LLM classification',
        extractedEntities: parsed.entities || {},
      };

    } catch (error) {
      // If JSON parsing fails, try to extract intent from text
      const intentMatch = response.match(/(?:intent|classification):\s*([A-Z_]+)/i);
      const confidenceMatch = response.match(/confidence:\s*([\d.]+)/i);

      if (intentMatch) {
        const intent = intentMatch[1].toUpperCase() as AgentIntent;
        if (Object.values(AgentIntent).includes(intent)) {
          return {
            intent,
            confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
            reasoning: 'Extracted from LLM text response',
          };
        }
      }

      return {
        intent: AgentIntent.UNKNOWN,
        confidence: 0.0,
        reasoning: 'Failed to parse LLM response',
      };
    }
  }

  private combineClassifications(
    ruleBasedResult: IntentClassification,
    llmBasedResult: IntentClassification
  ): IntentClassification {
    // If both agree, increase confidence
    if (ruleBasedResult.intent === llmBasedResult.intent) {
      return {
        intent: ruleBasedResult.intent,
        confidence: Math.min(1.0, (ruleBasedResult.confidence + llmBasedResult.confidence) / 2 + 0.1),
        reasoning: `Both rule-based and LLM agreed on ${ruleBasedResult.intent}`,
        extractedEntities: {
          ...ruleBasedResult.extractedEntities,
          ...llmBasedResult.extractedEntities,
        },
      };
    }

    // If they disagree, use the one with higher confidence
    if (ruleBasedResult.confidence > llmBasedResult.confidence) {
      return ruleBasedResult;
    } else {
      return llmBasedResult;
    }
  }

  private extractEntities(query: string, intent: AgentIntent): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract common entities based on intent
    switch (intent) {
      case AgentIntent.CODE_EXPLANATION:
      case AgentIntent.CODE_SEARCH:
        // Extract function/class names
        const functionMatch = query.match(/(?:function|method|class)\s+(\w+)/i);
        if (functionMatch) {
          entities.targetFunction = functionMatch[1];
        }

        // Extract file extensions
        const extensionMatch = query.match(/\.(\w+)\s+file/i);
        if (extensionMatch) {
          entities.fileExtension = extensionMatch[1];
        }
        break;

      case AgentIntent.DOCUMENTATION_SEARCH:
        // Extract documentation types
        if (query.toLowerCase().includes('readme')) {
          entities.docType = 'readme';
        } else if (query.toLowerCase().includes('api')) {
          entities.docType = 'api';
        } else if (query.toLowerCase().includes('guide')) {
          entities.docType = 'guide';
        }
        break;

      case AgentIntent.COMMIT_ANALYSIS:
        // Extract time references
        if (query.toLowerCase().includes('recent')) {
          entities.timeframe = 'recent';
        } else if (query.toLowerCase().includes('last week')) {
          entities.timeframe = 'week';
        } else if (query.toLowerCase().includes('yesterday')) {
          entities.timeframe = 'day';
        }
        break;
    }

    return entities;
  }

  // Utility methods
  getIntentDescription(intent: AgentIntent): string {
    const descriptions: Record<AgentIntent, string> = {
      [AgentIntent.CODE_EXPLANATION]: 'Understanding how specific code works',
      [AgentIntent.CODE_SEARCH]: 'Finding specific code implementations',
      [AgentIntent.DOCUMENTATION_SEARCH]: 'Looking for documentation and guides',
      [AgentIntent.COMMIT_ANALYSIS]: 'Analyzing code changes and history',
      [AgentIntent.GENERAL_QUERY]: 'General questions about the project',
      [AgentIntent.UNKNOWN]: 'Intent could not be determined',
    };

    return descriptions[intent] || 'Unknown intent';
  }

  getIntentExamples(intent: AgentIntent): string[] {
    const pattern = this.intentPatterns.find(p => p.intent === intent);
    return pattern?.examples || [];
  }

  // Training and improvement methods
  async improveClassification(
    query: string,
    actualIntent: AgentIntent,
    predictedIntent: AgentIntent,
    confidence: number
  ): Promise<void> {
    // This would be used to improve the classification model
    // For now, just log the feedback
    logger.info({
      query: query.substring(0, 100),
      actualIntent,
      predictedIntent,
      confidence,
      correct: actualIntent === predictedIntent,
    }, 'Intent classification feedback received');

    // In a production system, this would:
    // 1. Store the feedback in a database
    // 2. Retrain the model periodically
    // 3. Update rule patterns based on common misclassifications
  }

  // Batch classification for analytics
  async batchClassify(queries: string[]): Promise<IntentClassification[]> {
    const results: IntentClassification[] = [];

    for (const query of queries) {
      try {
        const classification = await this.classifyIntent(query);
        results.push(classification);
      } catch (error) {
        results.push({
          intent: AgentIntent.UNKNOWN,
          confidence: 0.0,
          reasoning: 'Batch classification failed',
        });
      }
    }

    return results;
  }

  // Analytics methods
  getIntentStatistics(classifications: IntentClassification[]): Record<AgentIntent, number> {
    const stats: Record<AgentIntent, number> = {} as any;

    // Initialize all intents to 0
    Object.values(AgentIntent).forEach(intent => {
      stats[intent] = 0;
    });

    // Count classifications
    classifications.forEach(classification => {
      stats[classification.intent]++;
    });

    return stats;
  }

  getAverageConfidence(classifications: IntentClassification[]): number {
    if (classifications.length === 0) return 0;

    const totalConfidence = classifications.reduce(
      (sum, classification) => sum + classification.confidence,
      0
    );

    return totalConfidence / classifications.length;
  }
}

// Export singleton instance
export const intentClassifier = new IntentClassificationService();

