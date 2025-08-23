import { eventBus } from '@/shared/events/event-bus';
import { 
  QueryProcessedEvent, 
  ErrorOccurredEvent,
  UserSessionStartedEvent,
  UserSessionEndedEvent 
} from '@/shared/events/event-types';
import { logger } from '@/core/utils/logger';
import { agentOrchestrator } from '@/agents/services/agent-orchestrator';
import type { AgentQuery, AgentResponse } from '@/agents/services/agent-orchestrator';

export interface InterfaceRequest {
  id: string;
  type: 'http' | 'websocket' | 'webhook' | 'chatops';
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  session?: {
    id: string;
    startTime: string;
  };
}

export interface InterfaceResponse {
  id: string;
  status: number;
  headers?: Record<string, string>;
  body: any;
  metadata: {
    processingTime: number;
    cached?: boolean;
    rateLimit?: {
      remaining: number;
      resetTime: string;
    };
  };
}

export interface WebSocketMessage {
  id: string;
  type: 'query' | 'status' | 'error' | 'heartbeat' | 'response';
  payload: any;
  timestamp: string;
}

export class InterfaceOrchestrator {
  private initialized = false;
  private activeConnections = new Map<string, any>();
  private requestCache = new Map<string, InterfaceResponse>();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for query processing events to update clients
    eventBus.on<QueryProcessedEvent>('query-processed', this.handleQueryProcessed.bind(this));
    eventBus.on<ErrorOccurredEvent>('error-occurred', this.handleErrorOccurred.bind(this));
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Interface Orchestrator...');

      // Initialize agent orchestrator
      await agentOrchestrator.initialize();

      this.initialized = true;
      logger.info('Interface Orchestrator initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Interface Orchestrator');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Interface Orchestrator...');

      // Close all active connections
      for (const [connectionId, connection] of this.activeConnections) {
        try {
          if (connection.close) {
            connection.close();
          }
        } catch (error) {
          logger.warn({ error, connectionId }, 'Failed to close connection');
        }
      }

      this.activeConnections.clear();
      this.requestCache.clear();

      // Cleanup agent orchestrator
      await agentOrchestrator.cleanup();

      this.initialized = false;
      logger.info('Interface Orchestrator cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Interface Orchestrator');
    }
  }

  async processRequest(request: InterfaceRequest): Promise<InterfaceResponse> {
    if (!this.initialized) {
      throw new Error('Interface Orchestrator not initialized');
    }

    const startTime = Date.now();

    try {
      logger.info({ 
        requestId: request.id,
        type: request.type,
        endpoint: request.endpoint,
        userId: request.user?.id
      }, 'Processing interface request');

      // Check cache for GET requests
      if (request.method === 'GET') {
        const cacheKey = this.getCacheKey(request);
        const cached = this.requestCache.get(cacheKey);
        if (cached && this.isCacheValid(cached)) {
          logger.debug({ requestId: request.id }, 'Returning cached response');
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              cached: true
            }
          };
        }
      }

      // Route request based on type and endpoint
      let response: InterfaceResponse;

      switch (request.type) {
        case 'http':
          response = await this.processHttpRequest(request);
          break;
        case 'websocket':
          response = await this.processWebSocketMessage(request);
          break;
        case 'webhook':
          response = await this.processWebhookRequest(request);
          break;
        case 'chatops':
          response = await this.processChatOpsRequest(request);
          break;
        default:
          throw new Error(`Unsupported request type: ${request.type}`);
      }

      // Cache successful GET responses
      if (request.method === 'GET' && response.status < 400) {
        const cacheKey = this.getCacheKey(request);
        this.requestCache.set(cacheKey, response);
      }

      const processingTime = Date.now() - startTime;
      logger.info({ 
        requestId: request.id,
        status: response.status,
        processingTime
      }, 'Interface request processed successfully');

      return {
        ...response,
        metadata: {
          ...response.metadata,
          processingTime
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error({ 
        error, 
        requestId: request.id,
        processingTime
      }, 'Interface request processing failed');

      // Emit error event
      eventBus.emit<ErrorOccurredEvent>('error-occurred', {
        error: error as Error,
        context: {
          requestId: request.id,
          type: request.type,
          endpoint: request.endpoint,
          component: 'interface-orchestrator'
        },
        severity: 'medium',
        timestamp: new Date().toISOString()
      });

      return {
        id: request.id,
        status: 500,
        body: {
          error: 'Internal server error',
          message: 'An error occurred while processing your request'
        },
        metadata: {
          processingTime
        }
      };
    }
  }

  private async processHttpRequest(request: InterfaceRequest): Promise<InterfaceResponse> {
    // Route to appropriate handler based on endpoint
    if (request.endpoint.startsWith('/api/v1/query')) {
      return this.handleQueryRequest(request);
    } else if (request.endpoint.startsWith('/api/v1/health')) {
      return this.handleHealthRequest(request);
    } else if (request.endpoint.startsWith('/api/v1/projects')) {
      return this.handleProjectsRequest(request);
    } else {
      return {
        id: request.id,
        status: 404,
        body: { error: 'Not found' },
        metadata: { processingTime: 0 }
      };
    }
  }

  private async handleQueryRequest(request: InterfaceRequest): Promise<InterfaceResponse> {
    try {
      const { query, projectId, sessionId } = request.body || {};

      if (!query) {
        return {
          id: request.id,
          status: 400,
          body: { error: 'Query is required' },
          metadata: { processingTime: 0 }
        };
      }

      // Create agent query
      const agentQuery: AgentQuery = {
        id: request.id,
        query,
        projectId,
        sessionId: sessionId || request.session?.id,
        context: {
          conversationHistory: request.body.context?.history || [],
          userPreferences: request.user ? { userId: request.user.id } : {},
          projectContext: { projectId }
        }
      };

      // Process with agent orchestrator
      const agentResponse = await agentOrchestrator.processQuery(agentQuery);

      return {
        id: request.id,
        status: 200,
        body: {
          response: agentResponse.response,
          confidence: agentResponse.confidence,
          intent: agentResponse.intent,
          sources: agentResponse.sources,
          metadata: agentResponse.metadata
        },
        metadata: {
          processingTime: agentResponse.metadata.processingTime
        }
      };

    } catch (error) {
      logger.error({ error, requestId: request.id }, 'Query request failed');
      return {
        id: request.id,
        status: 500,
        body: { error: 'Query processing failed' },
        metadata: { processingTime: 0 }
      };
    }
  }

  private async handleHealthRequest(request: InterfaceRequest): Promise<InterfaceResponse> {
    try {
      const health = await agentOrchestrator.getHealthStatus();
      
      return {
        id: request.id,
        status: health.status === 'healthy' ? 200 : 503,
        body: {
          status: health.status,
          services: health.services,
          activeQueries: health.activeQueries,
          timestamp: new Date().toISOString()
        },
        metadata: { processingTime: 0 }
      };

    } catch (error) {
      logger.error({ error, requestId: request.id }, 'Health request failed');
      return {
        id: request.id,
        status: 503,
        body: { 
          status: 'unhealthy',
          error: 'Health check failed'
        },
        metadata: { processingTime: 0 }
      };
    }
  }

  private async handleProjectsRequest(request: InterfaceRequest): Promise<InterfaceResponse> {
    // Placeholder for projects API
    return {
      id: request.id,
      status: 200,
      body: { projects: [] },
      metadata: { processingTime: 0 }
    };
  }

  private async processWebSocketMessage(request: InterfaceRequest): Promise<InterfaceResponse> {
    // Handle WebSocket messages
    const message = request.body as WebSocketMessage;
    
    switch (message.type) {
      case 'query':
        return this.handleQueryRequest(request);
      case 'heartbeat':
        return {
          id: request.id,
          status: 200,
          body: { type: 'pong', timestamp: new Date().toISOString() },
          metadata: { processingTime: 0 }
        };
      default:
        return {
          id: request.id,
          status: 400,
          body: { error: 'Unknown message type' },
          metadata: { processingTime: 0 }
        };
    }
  }

  private async processWebhookRequest(request: InterfaceRequest): Promise<InterfaceResponse> {
    // Handle webhook requests (GitHub, Jira, etc.)
    logger.info({ 
      requestId: request.id,
      endpoint: request.endpoint 
    }, 'Processing webhook request');

    return {
      id: request.id,
      status: 200,
      body: { received: true },
      metadata: { processingTime: 0 }
    };
  }

  private async processChatOpsRequest(request: InterfaceRequest): Promise<InterfaceResponse> {
    // Handle ChatOps requests (Slack, Teams, etc.)
    logger.info({ 
      requestId: request.id,
      endpoint: request.endpoint 
    }, 'Processing ChatOps request');

    return {
      id: request.id,
      status: 200,
      body: { received: true },
      metadata: { processingTime: 0 }
    };
  }

  private getCacheKey(request: InterfaceRequest): string {
    return `${request.endpoint}:${JSON.stringify(request.query)}:${request.user?.id || 'anonymous'}`;
  }

  private isCacheValid(response: InterfaceResponse): boolean {
    // Simple cache validity - 5 minutes
    const cacheAge = Date.now() - (response.metadata.processingTime || 0);
    return cacheAge < 5 * 60 * 1000; // 5 minutes
  }

  private async handleQueryProcessed(event: QueryProcessedEvent): Promise<void> {
    logger.debug({ 
      queryId: event.queryId,
      intent: event.metadata.intent 
    }, 'Query processed - notifying connected clients');

    // Could implement real-time notifications here
    // e.g., WebSocket broadcasts, webhook notifications, etc.
  }

  private async handleErrorOccurred(event: ErrorOccurredEvent): Promise<void> {
    logger.warn({ 
      error: event.error.message,
      context: event.context,
      severity: event.severity 
    }, 'Error occurred - handling interface response');

    // Could implement error notifications here
    // e.g., alert connected clients, send to monitoring systems, etc.
  }

  // Connection management for WebSocket
  addConnection(connectionId: string, connection: any): void {
    this.activeConnections.set(connectionId, connection);
    
    // Emit session started event
    eventBus.emit<UserSessionStartedEvent>('user-session-started', {
      sessionId: connectionId,
      userId: connection.userId,
      timestamp: new Date().toISOString()
    });
  }

  removeConnection(connectionId: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      this.activeConnections.delete(connectionId);
      
      // Emit session ended event
      eventBus.emit<UserSessionEndedEvent>('user-session-ended', {
        sessionId: connectionId,
        userId: connection.userId,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Health check method
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    activeConnections: number;
    cacheSize: number;
    agentOrchestrator: any;
  }> {
    try {
      const agentHealth = await agentOrchestrator.getHealthStatus();

      return {
        status: agentHealth.status,
        activeConnections: this.activeConnections.size,
        cacheSize: this.requestCache.size,
        agentOrchestrator: agentHealth
      };
    } catch (error) {
      logger.error({ error }, 'Interface orchestrator health check failed');
      return {
        status: 'unhealthy',
        activeConnections: this.activeConnections.size,
        cacheSize: this.requestCache.size,
        agentOrchestrator: { status: 'unhealthy' }
      };
    }
  }
}

// Export singleton instance
export const interfaceOrchestrator = new InterfaceOrchestrator();
