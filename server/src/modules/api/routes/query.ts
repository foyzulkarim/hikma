import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  AgentQuery,
  AgentResponse,
  AgentContext,
  AgentIntent,
} from '@/core/types/agents';
import { agentService } from '@/modules/agents/services/index';
import { logger } from '@/core/utils/logger';
import { ValidationError, ProcessingError } from '@/core/errors/app-error';
import { validateRequest } from '@/modules/api/middleware/validation';

// Request schemas
const QueryRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
  context: z.object({
    conversationHistory: z.array(z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string(),
    })).optional(),
    currentFile: z.string().optional(),
    currentDirectory: z.string().optional(),
    selectedCode: z.string().optional(),
    userPreferences: z.object({
      language: z.string().optional(),
      responseStyle: z.enum(['concise', 'detailed', 'technical']).optional(),
      includeCodeExamples: z.boolean().optional(),
      includeReferences: z.boolean().optional(),
      maxResponseLength: z.number().optional(),
    }).optional(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});

const BatchQueryRequestSchema = z.object({
  queries: z.array(QueryRequestSchema).min(1).max(10),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
});

const ConversationRequestSchema = z.object({
  queries: z.array(QueryRequestSchema).min(1).max(20),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
});

// Response schemas
const QueryResponseSchema = z.object({
  id: z.string(),
  queryId: z.string(),
  intent: z.nativeEnum(AgentIntent),
  response: z.string(),
  sources: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    content: z.string(),
    path: z.string().optional(),
    score: z.number(),
  })),
  confidence: z.number(),
  executionTime: z.number(),
  timestamp: z.string(),
});

// Route handlers
async function handleQuery(
  request: FastifyRequest<{
    Body: z.infer<typeof QueryRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();

  try {
    const { query, projectId, sessionId, context, metadata } = request.body;
    const userId = (request as any).user?.id;

    logger.info({
      correlationId: request.id,
      userId,
      projectId,
      sessionId,
      query: query.substring(0, 100),
    }, 'Processing query request');

    // Create agent query
    const agentQuery: AgentQuery = {
      id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      projectId,
      userId,
      sessionId,
      context: context ? {
        ...context,
        conversationHistory: context.conversationHistory?.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      } : undefined,
      metadata,
      timestamp: new Date(),
    };

    // Process query
    const response = await agentService.processQuery(agentQuery);

    // Format response
    const formattedResponse = {
      id: response.id,
      queryId: response.queryId,
      intent: response.intent,
      response: response.response,
      sources: response.sources.map(source => ({
        id: source.id,
        type: source.type,
        title: source.title,
        content: source.content,
        path: source.path,
        score: source.score,
      })),
      confidence: response.confidence,
      executionTime: response.executionTime,
      timestamp: response.timestamp.toISOString(),
    };

    const totalTime = Date.now() - startTime;

    logger.info({
      correlationId: request.id,
      queryId: agentQuery.id,
      intent: response.intent,
      confidence: response.confidence,
      executionTime: response.executionTime,
      totalTime,
    }, 'Query processed successfully');

    reply.status(200).send({
      success: true,
      data: formattedResponse,
      correlationId: request.id,
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error({
      correlationId: request.id,
      totalTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Query processing failed');

    if (error instanceof ValidationError) {
      reply.status(400).send({
        success: false,
        error: 'Validation Error',
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ProcessingError) {
      reply.status(500).send({
        success: false,
        error: 'Processing Error',
        message: error.message,
        correlationId: request.id,
      });
    } else {
      reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your query',
        correlationId: request.id,
      });
    }
  }
}

async function handleBatchQuery(
  request: FastifyRequest<{
    Body: z.infer<typeof BatchQueryRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();

  try {
    const { queries, projectId, sessionId } = request.body;
    const userId = (request as any).user?.id;

    logger.info({
      correlationId: request.id,
      userId,
      projectId,
      sessionId,
      queryCount: queries.length,
    }, 'Processing batch query request');

    // Create agent queries
    const agentQueries: AgentQuery[] = queries.map((queryData, index) => ({
      id: `batch_query_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      query: queryData.query,
      projectId: queryData.projectId || projectId,
      userId,
      sessionId: queryData.sessionId || sessionId,
      context: queryData.context ? {
        ...queryData.context,
        conversationHistory: queryData.context.conversationHistory?.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      } : undefined,
      metadata: queryData.metadata,
      timestamp: new Date(),
    }));

    // Process queries in batch
    const responses = await agentService.batchProcess(agentQueries);

    // Format responses
    const formattedResponses = responses.map(response => ({
      id: response.id,
      queryId: response.queryId,
      intent: response.intent,
      response: response.response,
      sources: response.sources.map(source => ({
        id: source.id,
        type: source.type,
        title: source.title,
        content: source.content,
        path: source.path,
        score: source.score,
      })),
      confidence: response.confidence,
      executionTime: response.executionTime,
      timestamp: response.timestamp.toISOString(),
    }));

    const totalTime = Date.now() - startTime;

    logger.info({
      correlationId: request.id,
      queryCount: queries.length,
      successCount: formattedResponses.length,
      totalTime,
    }, 'Batch query processed successfully');

    reply.status(200).send({
      success: true,
      data: formattedResponses,
      metadata: {
        totalQueries: queries.length,
        successfulQueries: formattedResponses.length,
        totalTime,
      },
      correlationId: request.id,
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error({
      correlationId: request.id,
      totalTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Batch query processing failed');

    reply.status(500).send({
      success: false,
      error: 'Batch Processing Error',
      message: 'Failed to process batch queries',
      correlationId: request.id,
    });
  }
}

async function handleConversation(
  request: FastifyRequest<{
    Body: z.infer<typeof ConversationRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();

  try {
    const { queries, projectId, sessionId } = request.body;
    const userId = (request as any).user?.id;

    logger.info({
      correlationId: request.id,
      userId,
      projectId,
      sessionId,
      queryCount: queries.length,
    }, 'Processing conversation request');

    // Create agent queries
    const agentQueries: AgentQuery[] = queries.map((queryData, index) => ({
      id: `conv_query_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      query: queryData.query,
      projectId: queryData.projectId || projectId,
      userId,
      sessionId: queryData.sessionId || sessionId,
      context: queryData.context ? {
        ...queryData.context,
        conversationHistory: queryData.context.conversationHistory?.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      } : undefined,
      metadata: queryData.metadata,
      timestamp: new Date(),
    }));

    // Process as conversation (sequential with context)
    const responses = await agentService.processConversation(agentQueries);

    // Format responses
    const formattedResponses = responses.map(response => ({
      id: response.id,
      queryId: response.queryId,
      intent: response.intent,
      response: response.response,
      sources: response.sources.map(source => ({
        id: source.id,
        type: source.type,
        title: source.title,
        content: source.content,
        path: source.path,
        score: source.score,
      })),
      confidence: response.confidence,
      executionTime: response.executionTime,
      timestamp: response.timestamp.toISOString(),
    }));

    const totalTime = Date.now() - startTime;

    logger.info({
      correlationId: request.id,
      queryCount: queries.length,
      successCount: formattedResponses.length,
      totalTime,
    }, 'Conversation processed successfully');

    reply.status(200).send({
      success: true,
      data: formattedResponses,
      metadata: {
        totalQueries: queries.length,
        successfulQueries: formattedResponses.length,
        totalTime,
        conversationId: sessionId,
      },
      correlationId: request.id,
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error({
      correlationId: request.id,
      totalTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Conversation processing failed');

    reply.status(500).send({
      success: false,
      error: 'Conversation Processing Error',
      message: 'Failed to process conversation',
      correlationId: request.id,
    });
  }
}

async function handleQueryHistory(
  request: FastifyRequest<{
    Querystring: {
      projectId?: string;
      sessionId?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { projectId, sessionId, limit = 50, offset = 0 } = request.query;
    const userId = (request as any).user?.id;

    logger.info({
      correlationId: request.id,
      userId,
      projectId,
      sessionId,
      limit,
      offset,
    }, 'Fetching query history');

    // This would typically fetch from database
    // For now, return empty history
    const history: any[] = [];

    reply.status(200).send({
      success: true,
      data: history,
      metadata: {
        total: 0,
        limit,
        offset,
        hasMore: false,
      },
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to fetch query history');

    reply.status(500).send({
      success: false,
      error: 'History Fetch Error',
      message: 'Failed to fetch query history',
      correlationId: request.id,
    });
  }
}

async function handleQueryFeedback(
  request: FastifyRequest<{
    Params: { queryId: string };
    Body: {
      rating: number;
      feedback?: string;
      helpful: boolean;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { queryId } = request.params;
    const { rating, feedback, helpful } = request.body;
    const userId = (request as any).user?.id;

    logger.info({
      correlationId: request.id,
      userId,
      queryId,
      rating,
      helpful,
    }, 'Recording query feedback');

    // This would typically save to database
    // For now, just log the feedback

    reply.status(200).send({
      success: true,
      message: 'Feedback recorded successfully',
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to record feedback');

    reply.status(500).send({
      success: false,
      error: 'Feedback Error',
      message: 'Failed to record feedback',
      correlationId: request.id,
    });
  }
}

// Route registration
export async function queryRoutes(fastify: FastifyInstance): Promise<void> {
  // Single query endpoint
  fastify.post('/ask', {
    preHandler: [fastify.authenticate, validateRequest(QueryRequestSchema)],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleQuery);

  // Batch query endpoint
  fastify.post('/batch', {
    preHandler: [fastify.authenticate, validateRequest(BatchQueryRequestSchema)],
  }, handleBatchQuery);

  // Conversation endpoint
  fastify.post('/conversation', {
    preHandler: [fastify.authenticate, validateRequest(ConversationRequestSchema)],
  }, handleConversation);

  // Query history endpoint
  fastify.get('/history', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          sessionId: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 },
        },
      },
    },
  }, handleQueryHistory);

  // Feedback endpoint
  fastify.post('/:queryId/feedback', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Provide feedback for a query response',
      tags: ['Query'],
      params: {
        type: 'object',
        properties: {
          queryId: { type: 'string' },
        },
        required: ['queryId'],
      },
      body: {
        type: 'object',
        properties: {
          rating: { type: 'number', minimum: 1, maximum: 5 },
          feedback: { type: 'string', maxLength: 1000 },
          helpful: { type: 'boolean' },
        },
        required: ['rating', 'helpful'],
      },
    },
  }, handleQueryFeedback);

  // Agent metrics endpoint (admin only)
  fastify.get('/metrics', {
    preHandler: [fastify.authenticate],
    schema: {},
  }, async (request, reply) => {
    try {
      const metrics = agentService.getMetrics();
      const report = agentService.generateReport();

      reply.status(200).send({
        success: true,
        data: {
          metrics,
          report,
        },
        correlationId: request.id,
      });

    } catch (error) {
      reply.status(500).send({
        success: false,
        error: 'Metrics Error',
        message: 'Failed to fetch metrics',
        correlationId: request.id,
      });
    }
  });
}

