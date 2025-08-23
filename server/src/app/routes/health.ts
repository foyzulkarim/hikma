import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { knowledgeService } from '@/knowledge/services/index';
import { agentService } from '@/agents/services/index';
import { logger } from '@/core/utils/logger';
import { config } from '@/config/app';

// Health check response interface
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    knowledge: {
      status: 'healthy' | 'unhealthy';
      embedding: boolean;
      vectorStore: boolean;
      details?: any;
    };
    agent: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      llm: boolean;
      details?: any;
    };
    database: {
      status: 'healthy' | 'unhealthy';
      postgresql: boolean;
      redis: boolean;
      neo4j: boolean;
    };
  };
  correlationId: string;
}

// Detailed health check
async function performDetailedHealthCheck(correlationId: string): Promise<HealthCheckResponse> {
  const startTime = Date.now();

  try {
    logger.debug({ correlationId }, 'Starting detailed health check');

    // Check knowledge service
    const knowledgeHealth = await knowledgeService.healthCheck();

    // Check agent service
    // TODO: Implement agent orchestrator
    const agentHealth = { status: 'healthy' as const, llm: true };
    // const agentHealth = await agentOrchestrator.healthCheck();

    // Check database connections (simplified for MVP)
    const databaseHealth = {
      status: 'healthy' as const,
      postgresql: true, // Would check actual connection
      redis: true, // Would check actual connection
      neo4j: true, // Would check actual connection
    };

    // Determine overall status
    const allServicesHealthy = 
      knowledgeHealth.overall && 
      agentHealth.status === 'healthy' && 
      databaseHealth.status === 'healthy';

    const someServicesHealthy = 
      knowledgeHealth.embedding || 
      knowledgeHealth.vectorStore || 
      agentHealth.status === 'healthy';

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (allServicesHealthy) {
      overallStatus = 'healthy';
    } else if (someServicesHealthy) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.server.environment,
      uptime: process.uptime(),
      services: {
        knowledge: {
          status: knowledgeHealth.overall ? 'healthy' : 'unhealthy',
          embedding: knowledgeHealth.embedding,
          vectorStore: knowledgeHealth.vectorStore,
          details: knowledgeHealth,
        },
        agent: {
          status: agentHealth.status,
          llm: agentHealth.llm,
          details: agentHealth,
        },
        database: databaseHealth,
      },
      correlationId,
    };

    const duration = Date.now() - startTime;

    logger.debug({
      correlationId,
      status: overallStatus,
      duration,
    }, 'Health check completed');

    return response;

  } catch (error) {
    logger.error({
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Health check failed');

    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.server.environment,
      uptime: process.uptime(),
      services: {
        knowledge: {
          status: 'unhealthy',
          embedding: false,
          vectorStore: false,
        },
        agent: {
          status: 'unhealthy',
          llm: false,
        },
        database: {
          status: 'unhealthy',
          postgresql: false,
          redis: false,
          neo4j: false,
        },
      },
      correlationId,
    };
  }
}

// Route handlers
async function handleHealthCheck(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const health = await performDetailedHealthCheck(request.id);

    // Set appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    reply.status(statusCode).send(health);

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Health check endpoint failed');

    reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      correlationId: request.id,
    });
  }
}

async function handleLivenessCheck(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Simple liveness check - just verify the service is running
  reply.status(200).send({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    correlationId: request.id,
  });
}

async function handleReadinessCheck(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Check if critical services are ready
    const knowledgeHealth = await knowledgeService.healthCheck();
    // TODO: Implement agent orchestrator
    const agentHealth = { status: 'healthy' as const, llm: true };
    // const agentHealth = await agentOrchestrator.healthCheck();

    const isReady = knowledgeHealth.overall && agentHealth.status === 'healthy';

    const statusCode = isReady ? 200 : 503;

    reply.status(statusCode).send({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      services: {
        knowledge: knowledgeHealth.overall,
        agent: agentHealth.status === 'healthy',
      },
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Readiness check failed');

    reply.status(503).send({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      correlationId: request.id,
    });
  }
}

async function handleMetricsCheck(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Collect system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Get service metrics
    // TODO: Implement agent orchestrator
    const agentMetrics = {};
    // const agentMetrics = agentOrchestrator.getAgentService().getMetrics();

    const metrics = {
      system: {
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      agent: agentMetrics,
      timestamp: new Date().toISOString(),
      correlationId: request.id,
    };

    reply.status(200).send(metrics);

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Metrics check failed');

    reply.status(500).send({
      error: 'Metrics collection failed',
      timestamp: new Date().toISOString(),
      correlationId: request.id,
    });
  }
}

async function handleVersionInfo(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const versionInfo = {
    name: 'Hikma API',
    version: '1.0.0',
    description: 'Agentic Code Intelligence Platform',
    environment: config.server.environment,
    buildTime: new Date().toISOString(), // Would be set during build
    gitCommit: 'unknown', // Would be set during build
    nodeVersion: process.version,
    dependencies: {
      fastify: '^4.0.0',
      typescript: '^5.0.0',
      openai: '^4.0.0',
      pinecone: '^1.0.0',
    },
    correlationId: request.id,
  };

  reply.status(200).send(versionInfo);
}

// Route registration
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Comprehensive health check
  fastify.get('/', {
    schema: {
      description: 'Comprehensive health check for all services',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            environment: { type: 'string' },
            uptime: { type: 'number' },
            services: { type: 'object' },
            correlationId: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            error: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleHealthCheck);

  // Kubernetes liveness probe
  fastify.get('/live', {
    schema: {
      description: 'Liveness probe for Kubernetes',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleLivenessCheck);

  // Kubernetes readiness probe
  fastify.get('/ready', {
    schema: {
      description: 'Readiness probe for Kubernetes',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            services: { type: 'object' },
            correlationId: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            error: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleReadinessCheck);

  // Metrics endpoint
  fastify.get('/metrics', {
    schema: {
      description: 'System and application metrics',
      tags: ['Health', 'Metrics'],
      response: {
        200: {
          type: 'object',
          properties: {
            system: { type: 'object' },
            agent: { type: 'object' },
            timestamp: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleMetricsCheck);

  // Version information
  fastify.get('/version', {
    schema: {
      description: 'Application version and build information',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            environment: { type: 'string' },
            buildTime: { type: 'string' },
            gitCommit: { type: 'string' },
            nodeVersion: { type: 'string' },
            dependencies: { type: 'object' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleVersionInfo);

  // Service-specific health checks
  fastify.get('/services/knowledge', {
    schema: {
      description: 'Knowledge service health check',
      tags: ['Health', 'Services'],
      response: {
        200: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            status: { type: 'string' },
            details: { type: 'object' },
            timestamp: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            status: { type: 'string' },
            error: { type: 'string' },
            timestamp: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const health = await knowledgeService.healthCheck();
      const statusCode = health.overall ? 200 : 503;

      reply.status(statusCode).send({
        service: 'knowledge',
        status: health.overall ? 'healthy' : 'unhealthy',
        details: health,
        timestamp: new Date().toISOString(),
        correlationId: request.id,
      });

    } catch (error) {
      reply.status(503).send({
        service: 'knowledge',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        correlationId: request.id,
      });
    }
  });

  fastify.get('/services/agent', {
    schema: {
      description: 'Agent service health check',
      tags: ['Health', 'Services'],
      response: {
        200: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            status: { type: 'string' },
            details: { type: 'object' },
            timestamp: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            status: { type: 'string' },
            error: { type: 'string' },
            timestamp: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // TODO: Implement agent orchestrator
      const health = { overall: true };
      // const health = await agentOrchestrator.healthCheck();
      const statusCode = health.overall ? 200 : 503;

      reply.status(statusCode).send({
        service: 'agent',
        status: health.overall ? 'healthy' : 'unhealthy',
        details: health,
        timestamp: new Date().toISOString(),
        correlationId: request.id,
      });

    } catch (error) {
      reply.status(503).send({
        service: 'agent',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        correlationId: request.id,
      });
    }
  });
}

