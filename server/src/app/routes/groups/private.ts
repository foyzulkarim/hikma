import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RouteGroup } from '../types';

/**
 * Private routes group - authentication required
 * These routes require valid authentication
 */
export const createPrivateRoutes = (): RouteGroup => ({
  name: 'private',
  prefix: '/api/v1',
  requiresAuth: true,
  routes: []
});

/**
 * Private routes plugin with authentication middleware
 * All routes in this plugin will require authentication
 */
export const privateRoutesPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Add authentication hook for all routes in this plugin
  fastify.addHook('preHandler', fastify.authenticate);

  // User profile endpoints (already authenticated, so user info is available)
  fastify.get('/api/v1/user/profile', {
    schema: {
      description: 'Get current user profile',
      tags: ['User'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            user: { type: 'object' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { UserService, UserRepository } = await import('@/domains/users');
    const repository = new UserRepository(fastify.prisma);
    const service = new UserService(repository);

    const user = await service.getUser(userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user: user.toResponse() };
  });

  // Update user profile
  fastify.put('/api/v1/user/profile', {
    schema: {
      description: 'Update current user profile',
      tags: ['User'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string', maxLength: 50 },
          lastName: { type: 'string', maxLength: 50 },
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: { type: 'object' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const body = request.body as any;
    
    const { UserService, UserRepository } = await import('@/domains/users');
    const repository = new UserRepository(fastify.prisma);
    const service = new UserService(repository);

    const user = await service.updateUser(userId, body);

    return { 
      user: user.toResponse(),
      message: 'Profile updated successfully'
    };
  });

  // Get user session info
  fastify.get('/api/v1/user/session', {
    schema: {
      description: 'Get current user session information',
      tags: ['User', 'Session'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            sessionId: { type: 'string' },
            permissions: { type: 'array' },
            expiresAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const user = (request as any).user;
    
    return {
      userId: user?.id,
      sessionId: request.id,
      permissions: user?.permissions || [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    };
  });
};
