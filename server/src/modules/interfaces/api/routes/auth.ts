import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logger } from '@/core/utils/logger.js';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError } from '@/core/errors/app-error.js';
import { validateRequest } from '../middleware/validation.js';
import { userService } from '@/modules/users/services/user-service.js';

// Request schemas
const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  organization: z.string().optional(),
});

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
});

// Response schemas
const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
    organization: z.string().optional(),
    createdAt: z.string(),
  }),
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
  }),
});

// Helper to sanitize user data for response
function sanitizeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organization: user.organization,
    createdAt: user.createdAt.toISOString(),
  };
}

// Route handlers
async function handleRegister(
  request: FastifyRequest<{
    Body: z.infer<typeof RegisterRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { email, password, name, organization } = request.body;

    logger.info({
      correlationId: request.id,
      email,
      name,
      organization,
    }, 'User registration attempt');

    const { user, accessToken, refreshToken, expiresIn } = await userService.registerUser({
      email, password, name, organization
    });

    reply.status(201).send({
      success: true,
      data: {
        user: sanitizeUser(user),
        tokens: { accessToken, refreshToken, expiresIn },
      },
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
}

async function handleLogin(
  request: FastifyRequest<{
    Body: z.infer<typeof LoginRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { email, password } = request.body;

    logger.info({
      correlationId: request.id,
      email,
    }, 'User login attempt');

    const { user, accessToken, refreshToken, expiresIn } = await userService.loginUser(email, password);

    reply.status(200).send({
      success: true,
      data: {
        user: sanitizeUser(user),
        tokens: { accessToken, refreshToken, expiresIn },
      },
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
}

async function handleRefreshToken(
  request: FastifyRequest<{
    Body: z.infer<typeof RefreshTokenRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { refreshToken } = request.body;

    logger.debug({
      correlationId: request.id,
    }, 'Token refresh attempt');

    const { user, accessToken, refreshToken: newRefreshToken, expiresIn } = await userService.refreshAuthToken(refreshToken);

    reply.status(200).send({
      success: true,
      data: {
        user: sanitizeUser(user),
        tokens: { accessToken, refreshToken: newRefreshToken, expiresIn },
      },
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
}

async function handleLogout(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const userId = (request as any).user?.id;

    logger.info({
      correlationId: request.id,
      userId,
    }, 'User logout');

    // In production, you would invalidate the tokens in a blacklist or database
    // For now, we just acknowledge the logout

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
}

async function handleGetProfile(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    const user = await userService.getUserById(userId);

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
}

async function handleChangePassword(
  request: FastifyRequest<{
    Body: z.infer<typeof ChangePasswordRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { currentPassword, newPassword } = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    await userService.changePassword(userId, currentPassword, newPassword);

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
    } else if (error instanceof NotFoundError) {
      reply.status(404).send({
        success: false,
        error: 'Not Found Error',
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
}

async function handleForgotPassword(
  request: FastifyRequest<{
    Body: z.infer<typeof ForgotPasswordRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { email } = request.body;

    logger.info({
      correlationId: request.id,
      email,
    }, 'Password reset requested');

    const resetToken = await userService.forgotPassword(email);

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
}

async function handleResetPassword(
  request: FastifyRequest<{
    Body: z.infer<typeof ResetPasswordRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { token, newPassword } = request.body;

    logger.info({
      correlationId: request.id,
    }, 'Password reset attempt');

    await userService.resetPassword(token, newPassword);

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

    reply.status(401).send({
      success: false,
      error: 'Authentication Error',
      message: 'Invalid or expired reset token',
      correlationId: request.id,
    });
  }
}

// Route registration
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Register
  fastify.post('/register', {
    preHandler: [validateRequest(RegisterRequestSchema)],
    schema: {
      description: 'Register a new user account',
      tags: ['Authentication'],
      body: RegisterRequestSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: AuthResponseSchema,
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleRegister);

  // Login
  fastify.post('/login', {
    preHandler: [validateRequest(LoginRequestSchema)],
    schema: {
      description: 'Login with email and password',
      tags: ['Authentication'],
      body: LoginRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: AuthResponseSchema,
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, handleLogin);

  // Refresh token
  fastify.post('/refresh', {
    preHandler: [validateRequest(RefreshTokenRequestSchema)],
    schema: {
      description: 'Refresh access token using refresh token',
      tags: ['Authentication'],
      body: RefreshTokenRequestSchema,
    },
  }, handleRefreshToken);

  // Logout
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Logout and invalidate tokens',
      tags: ['Authentication'],
    },
  }, handleLogout);

  // Get profile
  fastify.get('/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get current user profile',
      tags: ['Authentication'],
    },
  }, handleGetProfile);

  // Change password
  fastify.post('/change-password', {
    preHandler: [fastify.authenticate, validateRequest(ChangePasswordRequestSchema)],
    schema: {
      description: 'Change user password',
      tags: ['Authentication'],
      body: ChangePasswordRequestSchema,
    },
  }, handleChangePassword);

  // Forgot password
  fastify.post('/forgot-password', {
    preHandler: [validateRequest(ForgotPasswordRequestSchema)],
    schema: {
      description: 'Request password reset',
      tags: ['Authentication'],
      body: ForgotPasswordRequestSchema,
    },
  }, handleForgotPassword);

  // Reset password
  fastify.post('/reset-password', {
    preHandler: [validateRequest(ResetPasswordRequestSchema)],
    schema: {
      description: 'Reset password with token',
      tags: ['Authentication'],
      body: ResetPasswordRequestSchema,
    },
  }, handleResetPassword);
}


