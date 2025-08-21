import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/app.js';
import { logger } from './core/utils/logger.js';
import { globalErrorHandler } from './modules/interfaces/api/middleware/error-handler.js';
import { authMiddleware } from './modules/interfaces/api/middleware/auth.js';
import { loggingMiddleware } from './modules/interfaces/api/middleware/logging.js';
import { rateLimitMiddleware } from './modules/interfaces/api/middleware/rate-limit.js';

// Import route handlers
import { queryRoutes } from './modules/interfaces/api/routes/query.js';
import { projectRoutes } from './modules/interfaces/api/routes/project.js';
import { healthRoutes } from './modules/interfaces/api/routes/health.js';
import { authRoutes } from './modules/interfaces/api/routes/auth.js';

// Import services for initialization
import { knowledgeService } from './modules/knowledge/services/index.js';
import { agentOrchestrator } from './modules/agents/services/index.js';

// Server configuration
interface ServerConfig {
  host: string;
  port: number;
  environment: string;
}

// Create Fastify server
export async function createServer(serverConfig?: Partial<ServerConfig>): Promise<FastifyInstance> {
  const finalConfig: ServerConfig = {
    host: '0.0.0.0',
    port: config.server.port,
    environment: config.environment,
    ...serverConfig,
  };

  // Create Fastify instance with logging
  const server = Fastify({
    logger: {
      level: config.logging.level,
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
            'authorization': req.headers.authorization ? '[REDACTED]' : undefined,
          },
          remoteAddress: req.ip,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
          headers: {
            'content-type': res.getHeader('content-type'),
            'content-length': res.getHeader('content-length'),
          },
        }),
      },
    },
    trustProxy: true,
    disableRequestLogging: false,
    requestIdHeader: 'x-correlation-id',
    requestIdLogLabel: 'correlationId',
  });

  // Register plugins
  await registerPlugins(server);

  // Register middleware
  await registerMiddleware(server);

  // Register routes
  await registerRoutes(server);

  // Register error handlers
  registerErrorHandlers(server);

  return server;
}

// Register Fastify plugins
async function registerPlugins(server: FastifyInstance): Promise<void> {
  // CORS
  await server.register(cors, {
    origin: (origin, callback) => {
      // Allow all origins in development, specific origins in production
      if (config.environment === 'development') {
        callback(null, true);
      } else {
        const allowedOrigins = config.server.allowedOrigins || [];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'), false);
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  });

  // Security headers
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: config.server.rateLimit.max,
    timeWindow: config.server.rateLimit.timeWindow,
    skipOnError: true,
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise IP
      const userId = (request as any).user?.id;
      return userId || request.ip;
    },
    errorResponseBuilder: (request, context) => ({
      error: 'Rate limit exceeded',
      message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      statusCode: 429,
      correlationId: request.id,
    }),
  });
}

// Register middleware
async function registerMiddleware(server: FastifyInstance): Promise<void> {
  // Logging middleware
  server.addHook('onRequest', loggingMiddleware);

  // Rate limiting middleware (custom implementation for more control)
  server.addHook('preHandler', rateLimitMiddleware);

  // Authentication middleware (applied selectively to routes)
  server.decorate('authenticate', authMiddleware);
}

// Register routes
async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Health check routes (no auth required)
  await server.register(healthRoutes, { prefix: '/api/v1/health' });

  // Authentication routes
  await server.register(authRoutes, { prefix: '/api/v1/auth' });

  // Query routes (auth required)
  await server.register(queryRoutes, { prefix: '/api/v1/query' });

  // Project routes (auth required)
  await server.register(projectRoutes, { prefix: '/api/v1/projects' });

  // API documentation route
  server.get('/api/v1/docs', async (request, reply) => {
    return {
      name: 'Hikma API',
      version: '1.0.0',
      description: 'Agentic Code Intelligence Platform API',
      endpoints: {
        health: '/api/v1/health',
        auth: '/api/v1/auth',
        query: '/api/v1/query',
        projects: '/api/v1/projects',
      },
      documentation: 'https://docs.hikma.ai',
    };
  });

  // Root route
  server.get('/', async (request, reply) => {
    return {
      name: 'Hikma API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      environment: config.environment,
    };
  });
}

// Register error handlers
function registerErrorHandlers(server: FastifyInstance): void {
  // Global error handler
  server.setErrorHandler(globalErrorHandler);

  // Not found handler
  server.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      correlationId: request.id,
    });
  });
}

// Initialize services
async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing services...');

    // Initialize knowledge service
    await knowledgeService.initialize();

    // Initialize agent orchestrator
    await agentOrchestrator.initialize();

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize services');
    throw error;
  }
}

// Cleanup services
async function cleanupServices(): Promise<void> {
  try {
    logger.info('Cleaning up services...');

    // Cleanup knowledge service
    await knowledgeService.cleanup();

    // Cleanup agent orchestrator
    await agentOrchestrator.cleanup();

    logger.info('All services cleaned up successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup services');
  }
}

// Start server
export async function startServer(serverConfig?: Partial<ServerConfig>): Promise<FastifyInstance> {
  try {
    // Initialize services first
    await initializeServices();

    // Create and start server
    const server = await createServer(serverConfig);

    const finalConfig: ServerConfig = {
      host: '0.0.0.0',
      port: config.server.port,
      environment: config.environment,
      ...serverConfig,
    };

    await server.listen({
      host: finalConfig.host,
      port: finalConfig.port,
    });

    logger.info({
      host: finalConfig.host,
      port: finalConfig.port,
      environment: finalConfig.environment,
    }, 'Server started successfully');

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...');

      try {
        // Stop accepting new connections
        await server.close();

        // Cleanup services
        await cleanupServices();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled rejection');
      process.exit(1);
    });

    return server;

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    throw error;
  }
}

// Export for testing
export { initializeServices, cleanupServices };

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  });
}

