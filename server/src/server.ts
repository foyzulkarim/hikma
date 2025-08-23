import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from '@/config/app';
import { logger } from '@/core/utils/logger';
import { globalErrorHandler } from '@/modules/api/middleware/error-handler';
import { 
  correlationIdMiddleware,
  requestLoggingMiddleware 
} from '@/modules/api/middleware/logging';

// Extend Fastify instance with custom decorators
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    eventBus: any;
    prisma: any;
  }
}

// Import route handlers
import { queryRoutes } from '@/modules/api/routes/query';
import { projectRoutes } from '@/modules/domains/projects';
import { healthRoutes } from '@/modules/api/routes/health';
import { userRoutes } from '@/modules/domains/users';

// Import services for initialization
import { knowledgeService } from '@/modules/knowledge/services/index';

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
    environment: config.server.environment,
    ...serverConfig,
  };

  // Create Fastify instance with logging
  const server = Fastify({
    logger: {
      level: config.server.logLevel,
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
            'content-type': res.getHeader?.('content-type') || 'unknown',
            'content-length': res.getHeader?.('content-length') || '0',
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
  // Swagger documentation
  await server.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Hikma API',
        description: 'Agentic Code Intelligence Platform API',
        version: '1.0.0',
        contact: {
          name: 'Hikma Team',
          email: 'support@hikma.ai',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.hikma.ai',
          description: 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });

  // Swagger UI
  await server.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });
  // CORS
  await server.register(cors, {
    origin: (origin, callback) => {
      // Allow all origins in development, specific origins in production
      if (config.server.environment === 'development') {
        callback(null, true);
      } else {
        const allowedOrigins = config.security.corsOrigins || [];
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
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // Cookie support
  await server.register(cookie, {
    secret: config.security.jwtSecret,
    parseOptions: {
      httpOnly: true,
      secure: config.server.environment === 'production',
      sameSite: 'strict',
    },
  });

  // Multipart support for file uploads
  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
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
  // Import dependencies
  const { createRequireAuth, UserRepository, AuthService } = await import('@/modules/domains/users');
  const { prisma } = await import('@/config/prisma-client');
  
  // Add decorators
  server.decorate('prisma', prisma);
  server.decorate('eventBus', {
    emit: (event: string, payload: any) => {
      logger.debug({ event, payload }, 'Event emitted');
    }
  });
  
  // Initialize auth dependencies
  const repository = new UserRepository(server.prisma);
  const authService = new AuthService(repository, server.eventBus);
  const requireAuth = createRequireAuth(authService);
  
  // Register authenticate decorator
  server.decorate('authenticate', requireAuth);
  
  // Correlation ID middleware
  server.addHook('onRequest', correlationIdMiddleware);

  // Request logging middleware
  server.addHook('onRequest', requestLoggingMiddleware.preHandler);

  // Rate limiting is already registered above with @fastify/rate-limit
}

// Register routes
async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Health check routes (no auth required)
  await server.register(healthRoutes, { prefix: '/api/v1/health' });

  // Authentication routes
  await server.register(userRoutes, { prefix: '/api/v1/auth' });

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
      documentation: {
        swagger: '/documentation',
        openapi: '/documentation/json',
      },
    };
  });

  // Redirect /docs to /documentation for convenience
  server.get('/docs', async (request, reply) => {
    reply.redirect('/documentation');
  });

  // Root route
  server.get('/', async (request, reply) => {
    return {
      name: 'Hikma API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      environment: config.server.environment,
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
    // TODO: Implement agent orchestrator
    // await agentOrchestrator.initialize();

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
    // TODO: Implement agent orchestrator
    // await agentOrchestrator.cleanup();

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
      environment: config.server.environment,
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

