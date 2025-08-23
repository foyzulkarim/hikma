import { eventBus } from '@/shared/events/event-bus';
import { 
  QueryProcessedEvent, 
  AgentToolExecutedEvent, 
  ErrorOccurredEvent 
} from '@/shared/events/event-types';
import { logger } from '@/core/utils/logger';
import { Metrics, Retry, RetryConditions } from '@/shared/decorators';
import { agentService } from './agent-service';
import { intentClassifier } from './intent-classifier';
import { pipelineManager } from './pipeline-manager';
import { llmService } from './llm-service';

export interface AgentQuery {
  id: string;
  query: string;
  projectId?: string;
  sessionId?: string;
  context?: AgentContext;
}

export interface AgentContext {
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  userPreferences?: Record<string, any>;
  projectContext?: Record<string, any>;
}

export interface AgentResponse {
  id: string;
  response: string;
  confidence: number;
  intent: string;
  sources?: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
  }>;
  metadata: {
    processingTime: number;
    tokensUsed: number;
    toolsUsed: string[];
    pipeline: string;
  };
}

export class AgentOrchestrator {
  private initialized = false;
  private activeQueries = new Map<string, AgentQuery>();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for external events that might trigger agent actions
    eventBus.on('document-ingested', this.handleDocumentIngested.bind(this));
    eventBus.on('sync-job-completed', this.handleSyncJobCompleted.bind(this));
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Agent Orchestrator...');

      // Initialize services if they have initialize methods
      if (typeof (agentService as any).initialize === 'function') {
        await (agentService as any).initialize();
      }
      if (typeof (intentClassifier as any).initialize === 'function') {
        await (intentClassifier as any).initialize();
      }
      if (typeof (pipelineManager as any).initialize === 'function') {
        await (pipelineManager as any).initialize();
      }
      if (typeof (llmService as any).initialize === 'function') {
        await (llmService as any).initialize();
      }

      this.initialized = true;
      logger.info('Agent Orchestrator initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Agent Orchestrator');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Agent Orchestrator...');

      // Cleanup services in reverse order if they have cleanup methods
      if (typeof (llmService as any).cleanup === 'function') {
        await (llmService as any).cleanup();
      }
      if (typeof (pipelineManager as any).cleanup === 'function') {
        await (pipelineManager as any).cleanup();
      }
      if (typeof (intentClassifier as any).cleanup === 'function') {
        await (intentClassifier as any).cleanup();
      }
      if (typeof (agentService as any).cleanup === 'function') {
        await (agentService as any).cleanup();
      }

      this.activeQueries.clear();
      this.initialized = false;
      logger.info('Agent Orchestrator cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Agent Orchestrator');
    }
  }

  async processQuery(query: AgentQuery): Promise<AgentResponse> {
    if (!this.initialized) {
      throw new Error('Agent Orchestrator not initialized');
    }

    const startTime = Date.now();
    this.activeQueries.set(query.id, query);

    try {
      logger.info({ 
        queryId: query.id,
        projectId: query.projectId,
        sessionId: query.sessionId,
        queryLength: query.query.length
      }, 'Starting agent query processing');

      // Step 1: Classify intent
      const intent = await this.classifyIntent(query);
      logger.debug({ queryId: query.id, intent }, 'Intent classified');

      // Step 2: Select and execute pipeline
      const pipelineResult = await this.executePipeline(query, intent);
      logger.debug({ queryId: query.id, pipeline: pipelineResult.pipeline }, 'Pipeline executed');

      // Step 3: Generate response
      const response = await this.generateResponse(query, intent, pipelineResult);

      const processingTime = Date.now() - startTime;
      const agentResponse: AgentResponse = {
        id: query.id,
        response: response.content,
        confidence: response.confidence,
        intent: intent.type,
        sources: pipelineResult.sources,
        metadata: {
          processingTime,
          tokensUsed: response.tokensUsed,
          toolsUsed: pipelineResult.toolsUsed,
          pipeline: pipelineResult.pipeline
        }
      };

      // Emit event for successful processing
      eventBus.emit<QueryProcessedEvent>('query-processed', {
        queryId: query.id,
        result: agentResponse,
        metadata: {
          processingTime,
          intent: intent.type,
          pipeline: pipelineResult.pipeline
        }
      });

      logger.info({ 
        queryId: query.id,
        processingTime,
        confidence: response.confidence,
        intent: intent.type
      }, 'Agent query processing completed');

      return agentResponse;

    } catch (error) {
      logger.error({ 
        error, 
        queryId: query.id,
        processingTime: Date.now() - startTime
      }, 'Agent query processing failed');

      // Emit error event
      eventBus.emit<ErrorOccurredEvent>('error-occurred', {
        error: error as Error,
        context: {
          queryId: query.id,
          projectId: query.projectId,
          component: 'agent-orchestrator'
        },
        severity: 'high',
        timestamp: new Date().toISOString()
      });

      throw error;
    } finally {
      this.activeQueries.delete(query.id);
    }
  }

  private async classifyIntent(query: AgentQuery): Promise<{
    type: string;
    confidence: number;
    parameters: Record<string, any>;
  }> {
    try {
      const classification = await intentClassifier.classifyIntent(query.query);

      return {
        type: classification.intent,
        confidence: classification.confidence,
        parameters: {} // IntentClassification doesn't have entities, use empty object
      };
    } catch (error) {
      logger.warn({ error, queryId: query.id }, 'Intent classification failed, using fallback');
      return {
        type: 'general_query',
        confidence: 0.5,
        parameters: {}
      };
    }
  }

  private async executePipeline(
    query: AgentQuery, 
    intent: { type: string; confidence: number; parameters: Record<string, any> }
  ): Promise<{
    pipeline: string;
    sources: Array<{ id: string; title: string; content: string; score: number }>;
    toolsUsed: string[];
    context: Record<string, any>;
  }> {
    try {
      // Convert intent type to PipelineType enum
      const pipelineType = intent.type as any; // Cast to avoid enum issues
      
      const pipelineResult = await pipelineManager.executePipeline(
        pipelineType,
        query as any, // Cast to match AgentQuery interface
        intent.type as any // Cast to match AgentIntent enum
      );

      return {
        pipeline: pipelineType,
        sources: pipelineResult.response?.sources || [],
        toolsUsed: pipelineResult.toolCalls?.map(call => call.tool.toString()) || [],
        context: pipelineResult.response?.metadata || {}
      };
    } catch (error) {
      logger.warn({ error, queryId: query.id }, 'Pipeline execution failed, using fallback');
      return {
        pipeline: 'fallback',
        sources: [],
        toolsUsed: [],
        context: {}
      };
    }
  }

  private async generateResponse(
    query: AgentQuery,
    intent: { type: string; confidence: number; parameters: Record<string, any> },
    pipelineResult: { pipeline: string; sources: any[]; toolsUsed: string[]; context: Record<string, any> }
  ): Promise<{
    content: string;
    confidence: number;
    tokensUsed: number;
  }> {
    try {
      // Build context for LLM
      const contextString = pipelineResult.sources
        .map(source => `Source: ${source.title}\n${source.content}`)
        .join('\n\n');

      const prompt = `Query: ${query.query}\n\nContext:\n${contextString}\n\nPlease provide a helpful response based on the context above.`;

      const llmResponse = await llmService.generateText(prompt, {
        maxTokens: 1000,
        temperature: 0.7
      });

      return {
        content: llmResponse,
        confidence: Math.min(intent.confidence, 0.8),
        tokensUsed: 0 // generateText doesn't return token usage
      };
    } catch (error) {
      logger.error({ error, queryId: query.id }, 'LLM response generation failed');
      return {
        content: "I apologize, but I'm having trouble processing your request right now. Please try again later.",
        confidence: 0.1,
        tokensUsed: 0
      };
    }
  }

  private async handleDocumentIngested(event: any): Promise<void> {
    logger.debug({ 
      documentId: event.documentId,
      projectId: event.projectId 
    }, 'Document ingested - updating agent context');

    // Could implement context updates here
    // e.g., invalidate caches, update project knowledge, etc.
  }

  private async handleSyncJobCompleted(event: any): Promise<void> {
    logger.debug({ 
      jobId: event.jobId,
      projectId: event.projectId,
      status: event.status 
    }, 'Sync job completed - refreshing agent knowledge');

    // Could implement knowledge refresh here
    // e.g., warm up caches, update embeddings, etc.
  }

  // Health check method
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      agentService: boolean;
      intentClassifier: boolean;
      pipelineManager: boolean;
      llmService: boolean;
    };
    activeQueries: number;
  }> {
    try {
      const services = {
        agentService: await this.checkServiceHealth(agentService),
        intentClassifier: await this.checkServiceHealth(intentClassifier),
        pipelineManager: await this.checkServiceHealth(pipelineManager),
        llmService: await this.checkServiceHealth(llmService)
      };

      const allHealthy = Object.values(services).every(healthy => healthy);

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        services,
        activeQueries: this.activeQueries.size
      };
    } catch (error) {
      logger.error({ error }, 'Agent orchestrator health check failed');
      return {
        status: 'unhealthy',
        services: {
          agentService: false,
          intentClassifier: false,
          pipelineManager: false,
          llmService: false
        },
        activeQueries: this.activeQueries.size
      };
    }
  }

  private async checkServiceHealth(service: any): Promise<boolean> {
    try {
      if (typeof service.healthCheck === 'function') {
        return await service.healthCheck();
      }
      return true; // Assume healthy if no health check method
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator();
