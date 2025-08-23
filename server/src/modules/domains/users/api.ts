import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from './service';
import { AuthService } from './auth/service';
import { UserRepository } from './repository';
import { createAuthMiddleware } from './auth/middleware';
import { userConfig } from './config';
import { logger } from '@/core/utils/logger';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError } from '@/core/errors/app-error';
import * as schemas from './schemas';

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize dependencies
  const repository = new UserRepository(fastify.prisma);
  const authService = new AuthService(repository, fastify.eventBus);
  const userService = new UserService(repository, authService, fastify.eventBus, userConfig);
  
  // Auth middleware
  const requireAuth = createAuthMiddleware(authService, { required: true });

  // Helper to sanitize user data for response
  function sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // Register
  fastify.post<{
    Body: z.infer<typeof schemas.RegisterRequestSchema>;
  }>('/register', {
    schema: {
      body: schemas.RegisterRequestSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password, name, organization } = request.body;

      logger.info({
        correlationId: request.id,
        email,
        name,
        organization,
      }, 'User registration attempt');

      const result = await userService.registerUser({
        email,
        password,
        name,
        organization,
      }, request.id);

      reply.status(201).send({
        success: true,
        data: result,
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'User registration failed');

      if (error instanceof ConflictError) {
        reply.status(409).send({
          success: false,
          error: 'Conflict Error',
          message: error.message,
          correlationId: request.id,
        });
      } else if (error instanceof ValidationError) {
        reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: error.message,
          correlationId: request.id,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Registration Error',
          message: 'Failed to register user',
          correlationId: request.id,
        });
      }
    }
  });

  // Login
  fastify.post<{
    Body: z.infer<typeof schemas.LoginRequestSchema>;
  }>('/login', {
    schema: {
      body: schemas.LoginRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = request.body;

      logger.info({
        correlationId: request.id,
        email,
      }, 'User login attempt');

      const result = await userService.loginUser(email, password, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }, request.id);

      reply.status(200).send({
        success: true,
        data: result,
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'User login failed');

      if (error instanceof AuthenticationError) {
        reply.status(401).send({
          success: false,
          error: 'Authentication Error',
          message: error.message,
          correlationId: request.id,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Login Error',
          message: 'Failed to login user',
          correlationId: request.id,
        });
      }
    }
  });

  // Refresh token
  fastify.post<{
    Body: z.infer<typeof schemas.RefreshTokenRequestSchema>;
  }>('/refresh', {
    schema: {
      body: schemas.RefreshTokenRequestSchema
    }
  }, async (request, reply) => {
    try {
      const { refreshToken } = request.body;

      logger.debug({
        correlationId: request.id,
      }, 'Token refresh attempt');

      const result = await userService.refreshAuthToken(refreshToken, request.id);

      reply.status(200).send({
        success: true,
        data: result,
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Token refresh failed');

      reply.status(401).send({
        success: false,
        error: 'Authentication Error',
        message: 'Invalid or expired refresh token',
        correlationId: request.id,
      });
    }
  });

  // Logout
  fastify.post('/logout', {
    preHandler: [requireAuth],
    schema: {}
  }, async (request, reply) => {
    try {
      const userId = request.user?.id;

      logger.info({
        correlationId: request.id,
        userId,
      }, 'User logout');

      if (userId) {
        await authService.logout(userId, request.id);
      }

      reply.status(200).send({
        success: true,
        message: 'Logged out successfully',
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Logout failed');

      reply.status(500).send({
        success: false,
        error: 'Logout Error',
        message: 'Failed to logout',
        correlationId: request.id,
      });
    }
  });

  // Get profile
  fastify.get('/profile', {
    preHandler: [requireAuth],
    schema: {}
  }, async (request, reply) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const user = await userService.getUserById(userId, request.id);

      reply.status(200).send({
        success: true,
        data: {
          user: sanitizeUser(user),
        },
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Get profile failed');

      if (error instanceof NotFoundError) {
        reply.status(404).send({
          success: false,
          error: 'Not Found Error',
          message: error.message,
          correlationId: request.id,
        });
      } else if (error instanceof AuthenticationError) {
        reply.status(401).send({
          success: false,
          error: 'Authentication Error',
          message: error.message,
          correlationId: request.id,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Profile Error',
          message: 'Failed to get user profile',
          correlationId: request.id,
        });
      }
    }
  });

  // Change password
  fastify.post<{
    Body: z.infer<typeof schemas.ChangePasswordRequestSchema>;
  }>('/change-password', {
    preHandler: [requireAuth],
    schema: {
      body: schemas.ChangePasswordRequestSchema
    }
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body;
      const userId = request.user?.id;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      await userService.changePassword(userId, {
        currentPassword,
        newPassword,
      }, request.id);

      reply.status(200).send({
        success: true,
        message: 'Password changed successfully',
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Change password failed');

      if (error instanceof AuthenticationError) {
        reply.status(401).send({
          success: false,
          error: 'Authentication Error',
          message: error.message,
          correlationId: request.id,
        });
      } else if (error instanceof ValidationError) {
        reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: error.message,
          correlationId: request.id,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Password Change Error',
          message: 'Failed to change password',
          correlationId: request.id,
        });
      }
    }
  });

  // Forgot password
  fastify.post<{
    Body: z.infer<typeof schemas.ForgotPasswordRequestSchema>;
  }>('/forgot-password', {
    schema: {
      body: schemas.ForgotPasswordRequestSchema
    }
  }, async (request, reply) => {
    try {
      const { email } = request.body;

      logger.info({
        correlationId: request.id,
        email,
      }, 'Password reset requested');

      const resetToken = await userService.forgotPassword(email, request.id);

      reply.status(200).send({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
        resetToken, // Only for testing/development, not in production
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Forgot password failed');

      reply.status(500).send({
        success: false,
        error: 'Password Reset Error',
        message: 'Failed to process password reset request',
        correlationId: request.id,
      });
    }
  });

  // Reset password
  fastify.post<{
    Body: z.infer<typeof schemas.ResetPasswordRequestSchema>;
  }>('/reset-password', {
    schema: {
      body: schemas.ResetPasswordRequestSchema
    }
  }, async (request, reply) => {
    try {
      const { token, newPassword } = request.body;

      logger.info({
        correlationId: request.id,
      }, 'Password reset attempt');

      await userService.resetPassword({ token, newPassword }, request.id);

      reply.status(200).send({
        success: true,
        message: 'Password reset successfully',
        correlationId: request.id,
      });

    } catch (error) {
      logger.error({
        correlationId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Password reset failed');

      if (error instanceof ValidationError) {
        reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: error.message,
          correlationId: request.id,
        });
      } else {
        reply.status(401).send({
          success: false,
          error: 'Authentication Error',
          message: 'Invalid or expired reset token',
          correlationId: request.id,
        });
      }
    }
  });
};