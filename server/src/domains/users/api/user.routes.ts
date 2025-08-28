import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from '../services/user.service';
import { AuthenticateUserUseCase } from '../use-cases/authenticate-user.use-case';
import { CreateUserUseCase } from '../use-cases/create-user.use-case';
import { AuthService } from '../auth/service';
import { PasswordUtils } from '@/core/utils/crypto';
import { eventBus } from '@/shared/events';

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize dependencies
  const prisma = fastify.prisma as PrismaClient;
  const repository = new UserRepository(prisma);
  const service = new UserService(repository);
  const authService = new AuthService(repository, eventBus);
  
  // Initialize use cases
  const authenticateUserUseCase = new AuthenticateUserUseCase(authService);
  const createUserUseCase = new CreateUserUseCase(service);

  // Login endpoint
  fastify.post('/login', {
    schema: {
      description: 'Authenticate user with email/username and password',
      tags: ['Authentication'],
      body: {
        type: 'object',
        properties: {
          emailOrUsername: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 }
        },
        required: ['emailOrUsername', 'password']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' }
              }
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      
      const result = await authenticateUserUseCase.execute({
        emailOrUsername: body.emailOrUsername,
        password: body.password
      });

      if (!result.success || !result.user) {
        return reply.status(401).send({ error: result.message });
      }

      const tokens = await authService.generateTokens(result.user);

      return reply.send({
        user: result.user,
        tokens,
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      });
    }
  });

  // Register endpoint
  fastify.post('/register', {
    schema: {
      description: 'Register a new user account',
      tags: ['Authentication'],
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string', minLength: 3, maxLength: 30 },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', maxLength: 50 },
          lastName: { type: 'string', maxLength: 50 }
        },
        required: ['email', 'username', 'password']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      
      const hashedPassword = await PasswordUtils.hash(body.password);

      const result = await createUserUseCase.execute({
        email: body.email,
        username: body.username,
        password: hashedPassword,
        firstName: body.firstName,
        lastName: body.lastName
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.message });
      }

      return reply.status(201).send({
        user: result.user,
        message: 'User created successfully'
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Registration failed' 
      });
    }
  });

  // Get current user profile
  fastify.get('/profile', {
    schema: {
      description: 'Get current user profile information',
      tags: ['Authentication'],
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const user = await service.getUser(userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ user: user.toResponse() });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to fetch profile' 
      });
    }
  });

  // Update user profile
  fastify.put('/profile', {
    schema: {
      description: 'Update current user profile information',
      tags: ['Authentication'],
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
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
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
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const body = request.body as any;
      
      const user = await service.updateUser(userId, body);

      return reply.send({ 
        user: user.toResponse(),
        message: 'Profile updated successfully'
      });
    } catch (error) {
      return reply.status(400).send({ 
        error: error instanceof Error ? error.message : 'Failed to update profile' 
      });
    }
  });
};
