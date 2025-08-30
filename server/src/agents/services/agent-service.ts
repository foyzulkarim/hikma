import {
  IAgentService,
  AgentQuery,
  AgentResponse,
  AgentContext,
  IntentClassification,
  PipelineType,
  PipelineContext,
  ITool,
  ToolType,
  AgentEvent,
  AgentEventData,
  AgentMetrics,
  AgentConfig,
  AgentIntent,
} from '@/core/types/agents';
import { intentClassifier } from './intent-classifier';
import { pipelineManager } from './pipeline-manager';
import { llmService } from './llm-service';
import { logger } from '@/core/utils/logger';
import { ValidationError, ProcessingError } from '@/core/errors/app-error';
import { EventEmitter } from 'events';

// Agent service implementation
export class AgentService extends EventEmitter implements IAgentService {
  private metrics: AgentMetrics;
  private config: AgentConfig;

  constructor(config?: Partial<AgentConfig>) {
    super();

    this.config = {
      llm: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000,
      },
      search: {
        maxResults: 10,
        threshold: 0.0,
        rerank: true,
      },
      response: {
        maxLength: 4000,
        includeReferences: true,
        includeSources: true,
      },
      performance: {
        timeout: 30000, // 30 seconds
        retryCount: 2,
        cacheResults: true,
      },
      ...config,
    };

    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      intentDistribution: {} as Record<AgentIntent, number>,
      pipelineDistribution: {} as Record<PipelineType, number>,
      toolUsage: {} as Record<ToolType, number>,
    };

    this.initializeMetrics();
  }

  async processQuery(query: AgentQuery): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      logger.info({
        queryId: query.id,
        query: query.query.substring(0, 100),
        userId: query.userId,
        projectId: query.projectId,
      }, 'Processing agent query');

      // Emit query received event
      this.emitEvent({
        queryId: query.id,
        event: AgentEvent.QUERY_RECEIVED,
        timestamp: new Date(),
        data: { query: query.query.substring(0, 100) },
      });

      // Validate query
      if (!this.validateQuery(query)) {
        throw new ValidationError('Invalid query format');
      }

      // Classify intent
      const classification = await this.classifyIntent(query.query, query.context);

      // Emit intent classified event
      this.emitEvent({
        queryId: query.id,
        event: AgentEvent.INTENT_CLASSIFIED,
        timestamp: new Date(),
        data: { intent: classification.intent, confidence: classification.confidence },
      });

      // Determine pipeline
      const pipelineType = this.selectPipeline(classification);

      // Execute pipeline
      const pipelineResult = await this.executePipeline(pipelineType, query, classification.intent);

      if (!pipelineResult.success || !pipelineResult.response) {
        throw new ProcessingError(pipelineResult.error || 'Pipeline execution failed');
      }

      // Update response with execution time
      const executionTime = Date.now() - startTime;
      pipelineResult.response.executionTime = executionTime;

      // Update metrics
      this.updateMetrics(classification.intent, pipelineType, executionTime, true);

      // Emit response generated event
      this.emitEvent({
        queryId: query.id,
        event: AgentEvent.RESPONSE_GENERATED,
        timestamp: new Date(),
        data: {
          intent: classification.intent,
          pipeline: pipelineType,
          executionTime,
          confidence: pipelineResult.response.confidence,
        },
      });

      logger.info({
        queryId: query.id,
        intent: classification.intent,
        pipeline: pipelineType,
        executionTime,
        confidence: pipelineResult.response.confidence,
      }, 'Query processed successfully');

      return pipelineResult.response;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        queryId: query.id,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Query processing failed');

      // Update metrics
      this.updateMetrics(AgentIntent.UNKNOWN, PipelineType.SEARCH_AND_ANSWER, executionTime, false);

      // Emit error event
      this.emitEvent({
        queryId: query.id,
        event: AgentEvent.ERROR_OCCURRED,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return error response
      return this.createErrorResponse(query, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async classifyIntent(query: string, context?: AgentContext): Promise<IntentClassification> {
    try {
      return await intentClassifier.classifyIntent(query, context);
    } catch (error) {
      logger.error({
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Intent classification failed');

      return {
        intent: AgentIntent.UNKNOWN,
        confidence: 0.0,
        reasoning: 'Classification failed',
      };
    }
  }

  async executePipeline(
    pipeline: PipelineType,
    context: PipelineContext
  ): Promise<AgentResponse>;
  async executePipeline(
    pipelineType: PipelineType,
    query: AgentQuery,
    intent: AgentIntent
  ): Promise<{ success: boolean; response?: AgentResponse; error?: string }>;
  async executePipeline(
    pipelineTypeOrPipeline: PipelineType,
    queryOrContext: AgentQuery | PipelineContext,
    intent?: AgentIntent
  ): Promise<any> {
    try {
      // Handle both overloads
      if (intent !== undefined) {
        // Second overload: (pipelineType, query, intent)
        const pipelineType = pipelineTypeOrPipeline;
        const query = queryOrContext as AgentQuery;
        
        return await pipelineManager.executePipeline(pipelineType, query, intent);
      } else {
        // First overload: (pipeline, context)
        const context = queryOrContext as PipelineContext;
        const pipelineType = pipelineTypeOrPipeline;
        
        const result = await pipelineManager.executePipeline(
          pipelineType,
          context.query,
          context.intent
        );
        
        if (!result.success || !result.response) {
          throw new ProcessingError(result.error || 'Pipeline execution failed');
        }
        
        return result.response;
      }
    } catch (error) {
      logger.error({
        pipelineType: pipelineTypeOrPipeline,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Pipeline execution failed');

      throw error;
    }
  }

  // Tool management
  registerTool(tool: ITool): void {
    pipelineManager.registerTool(tool);
  }

  getTool(type: ToolType): ITool | null {
    return pipelineManager.getTool(type);
  }

  listTools(): ITool[] {
    return pipelineManager.listTools();
  }

  // Pipeline management
  registerPipeline(pipeline: any): void {
    pipelineManager.registerPipeline(pipeline);
  }

  getPipeline(type: PipelineType): any {
    return pipelineManager.getPipeline(type);
  }

  listPipelines(): any[] {
    return pipelineManager.listPipelines();
  }

  // Private helper methods
  private validateQuery(query: AgentQuery): boolean {
    try {
      if (!query.id || !query.query || query.query.trim().length === 0) {
        return false;
      }

      if (query.query.length > 10000) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private selectPipeline(classification: IntentClassification): PipelineType {
    const intentToPipeline: Record<AgentIntent, PipelineType> = {
      [AgentIntent.CODE_EXPLANATION]: PipelineType.CODE_ANALYSIS,
      [AgentIntent.CODE_SEARCH]: PipelineType.SEARCH_AND_ANSWER,
      [AgentIntent.DOCUMENTATION_SEARCH]: PipelineType.DOCUMENTATION_LOOKUP,
      [AgentIntent.COMMIT_ANALYSIS]: PipelineType.COMMIT_SUMMARY,
      [AgentIntent.GENERAL_QUERY]: PipelineType.GENERAL_RAG,
      [AgentIntent.UNKNOWN]: PipelineType.SEARCH_AND_ANSWER,
    };

    return intentToPipeline[classification.intent] || PipelineType.SEARCH_AND_ANSWER;
  }

  private createErrorResponse(query: AgentQuery, error: string): AgentResponse {
    return {
      id: `error_response_${Date.now()}`,
      queryId: query.id,
      intent: AgentIntent.UNKNOWN,
      pipeline: PipelineType.SEARCH_AND_ANSWER,
      response: `I apologize, but I encountered an error while processing your request: ${error}. Please try rephrasing your question or contact support if the issue persists.`,
      sources: [],
      confidence: 0.0,
      executionTime: 0,
      toolCalls: [],
      timestamp: new Date(),
      metadata: { error: true, errorMessage: error },
    };
  }

  private emitEvent(eventData: AgentEventData): void {
    this.emit('agentEvent', eventData);
    
    logger.debug({
      queryId: eventData.queryId,
      event: eventData.event,
      data: eventData.data,
    }, 'Agent event emitted');
  }

  private initializeMetrics(): void {
    // Initialize intent distribution
    Object.values(AgentIntent).forEach(intent => {
      this.metrics.intentDistribution[intent] = 0;
    });

    // Initialize pipeline distribution
    Object.values(PipelineType).forEach(pipeline => {
      this.metrics.pipelineDistribution[pipeline] = 0;
    });

    // Initialize tool usage
    Object.values(ToolType).forEach(tool => {
      this.metrics.toolUsage[tool] = 0;
    });
  }

  private updateMetrics(
    intent: AgentIntent,
    pipeline: PipelineType,
    executionTime: number,
    success: boolean
  ): void {
    this.metrics.totalQueries++;
    
    if (success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
    }

    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + executionTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalQueries;

    // Update distributions
    this.metrics.intentDistribution[intent]++;
    this.metrics.pipelineDistribution[pipeline]++;
  }

  // Public utility methods
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info({ config: this.config }, 'Agent configuration updated');
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      llm: boolean;
      intentClassifier: boolean;
      pipelineManager: boolean;
    };
    metrics: AgentMetrics;
  }> {
    try {
      // Test LLM service
      const llmHealthy = await llmService.testConnection();

      // Test other services (simplified)
      const intentClassifierHealthy = true; // No external dependencies
      const pipelineManagerHealthy = true; // No external dependencies

      const services = {
        llm: llmHealthy,
        intentClassifier: intentClassifierHealthy,
        pipelineManager: pipelineManagerHealthy,
      };

      const allHealthy = Object.values(services).every(Boolean);
      const status = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        services,
        metrics: this.getMetrics(),
      };

    } catch (error) {
      logger.error({ error }, 'Agent health check failed');

      return {
        status: 'unhealthy',
        services: {
          llm: false,
          intentClassifier: false,
          pipelineManager: false,
        },
        metrics: this.getMetrics(),
      };
    }
  }

  // Conversation management
  async processConversation(
    queries: AgentQuery[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    for (let i = 0; i < queries.length; i++) {
      try {
        // Add conversation history to context
        const query = { ...queries[i] };
        if (query.context) {
          query.context.conversationHistory = responses.map(r => ({
            id: r.id,
            role: 'assistant' as const,
            content: r.response,
            timestamp: r.timestamp,
          }));
        }

        const response = await this.processQuery(query);
        responses.push(response);

        onProgress?.(i + 1, queries.length);

      } catch (error) {
        logger.error({
          queryIndex: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Conversation query failed');

        // Add error response
        responses.push(this.createErrorResponse(
          queries[i],
          error instanceof Error ? error.message : 'Unknown error'
        ));
      }
    }

    return responses;
  }

  // Batch processing
  async batchProcess(
    queries: AgentQuery[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    // Process queries in parallel (with concurrency limit)
    const concurrencyLimit = 3;
    const chunks = [];
    
    for (let i = 0; i < queries.length; i += concurrencyLimit) {
      chunks.push(queries.slice(i, i + concurrencyLimit));
    }

    let completed = 0;

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (query) => {
        try {
          return await this.processQuery(query);
        } catch (error) {
          return this.createErrorResponse(
            query,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      responses.push(...chunkResults);

      completed += chunk.length;
      onProgress?.(completed, queries.length);
    }

    return responses;
  }

  // Analytics and reporting
  generateReport(): {
    summary: {
      totalQueries: number;
      successRate: number;
      averageResponseTime: number;
    };
    intentBreakdown: Record<AgentIntent, number>;
    pipelineUsage: Record<PipelineType, number>;
    topIntents: Array<{ intent: AgentIntent; count: number; percentage: number }>;
  } {
    const successRate = this.metrics.totalQueries > 0 
      ? this.metrics.successfulQueries / this.metrics.totalQueries 
      : 0;

    const topIntents = Object.entries(this.metrics.intentDistribution)
      .map(([intent, count]) => ({
        intent: intent as AgentIntent,
        count,
        percentage: this.metrics.totalQueries > 0 ? (count / this.metrics.totalQueries) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      summary: {
        totalQueries: this.metrics.totalQueries,
        successRate: successRate * 100,
        averageResponseTime: this.metrics.averageResponseTime,
      },
      intentBreakdown: this.metrics.intentDistribution,
      pipelineUsage: this.metrics.pipelineDistribution,
      topIntents,
    };
  }
}

// Export singleton instance
export const agentService = new AgentService();

