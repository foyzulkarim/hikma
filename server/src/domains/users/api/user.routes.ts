import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from '../services/user.service';
import { AuthenticateUserUseCase } from '../use-cases/authenticate-user.use-case';
import { CreateUserUseCase } from '../use-cases/create-user.use-case';

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize dependencies
  const prisma = fastify.prisma as PrismaClient;
  const repository = new UserRepository(prisma);
  const service = new UserService(repository);
  
  // Initialize use cases
  const authenticateUserUseCase = new AuthenticateUserUseCase(service);
  const createUserUseCase = new CreateUserUseCase(service);

  // Login endpoint
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        properties: {
          emailOrUsername: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 }
        },
        required: ['emailOrUsername', 'password']
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      
      const result = await authenticateUserUseCase.execute({
        emailOrUsername: body.emailOrUsername,
        password: body.password
      });

      if (!result.success) {
        return reply.status(401).send({ error: result.message });
      }

      // TODO: Generate JWT token here
      return reply.send({
        user: result.user,
        token: 'mock-jwt-token' // Replace with actual JWT generation
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
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      
      // TODO: Hash password before creating user
      const result = await createUserUseCase.execute({
        email: body.email,
        username: body.username,
        password: body.password, // Should be hashed
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
  fastify.get('/profile', async (request, reply) => {
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
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string', maxLength: 50 },
          lastName: { type: 'string', maxLength: 50 },
          email: { type: 'string', format: 'email' }
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
