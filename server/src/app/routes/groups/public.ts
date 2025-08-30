import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RouteGroup } from '../types';

/**
 * Public routes group - no authentication required
 * These routes are accessible to everyone
 */
export const createPublicRoutes = (): RouteGroup => ({
  name: 'public',
  prefix: '/api/v1',
  requiresAuth: false,
  routes: []
});

/**
 * Root-level public routes plugin
 * Handles routes that don't require authentication
 */
export const publicRoutesPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // API documentation endpoint
  fastify.get('/api/v1/docs', {
    schema: {
      description: 'API documentation and endpoints',
      tags: ['Documentation'],
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            endpoints: { type: 'object' },
            documentation: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
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
  fastify.get('/docs', {
    schema: {
      description: 'Redirect to Swagger documentation UI',
      tags: ['Documentation'],
      response: {
        302: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    reply.redirect('/documentation');
  });

  // Serve OpenAPI JSON schema at /docs/json for backward compatibility
  fastify.get('/docs/json', {
    schema: {
      description: 'OpenAPI JSON specification',
      tags: ['Documentation'],
      response: {
        200: {
          type: 'object',
          description: 'OpenAPI 3.0 specification in JSON format'
        }
      }
    }
  }, async (request, reply) => {
    return fastify.swagger();
  });

  // Root route with API info
  fastify.get('/', {
    schema: {
      description: 'API root endpoint with service information',
      tags: ['Root'],
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            status: { type: 'string' },
            timestamp: { type: 'string' },
            environment: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { config } = await import('@/config/app');
    
    return {
      name: 'Hikma API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      environment: config.server.environment,
    };
  });
};
