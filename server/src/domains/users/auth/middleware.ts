import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './service';
import { UserContext, AuthMethod } from './types';
import { AuthenticationError, AuthorizationError } from '@/core/errors/app-error';
import { logger } from '@/core/utils/logger';
import { CorrelationIdManager } from '@/core/utils/logger';

// Extend Fastify request with user context
declare module 'fastify' {
  interface FastifyRequest {
    user?: UserContext;
    authMethod?: AuthMethod;
    correlationId?: string;
  }
}

export function createAuthMiddleware(
  authService: AuthService,
  options: {
    required?: boolean;
    roles?: string[];
    allowApiKey?: boolean;
  } = {}
) {
  const { required = true, roles = [], allowApiKey = true } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const correlationId = request.correlationId || CorrelationIdManager.generate();
    request.correlationId = correlationId;

    try {
      let user: UserContext | null = null;
      let authMethod: AuthMethod = 'none';

      // Try JWT authentication first (from Authorization header or cookies)
      const authHeader = request.headers.authorization;
      const jwtToken = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7)
        : request.cookies?.token;

      if (jwtToken) {
        try {
          user = await authService.authenticateWithJWT(jwtToken, correlationId);
          authMethod = 'jwt';
        } catch (error) {
          // If JWT fails and API key is not allowed, throw the error
          if (!allowApiKey) {
            throw error;
          }
          // Otherwise, continue to try API key authentication
        }
      }

      // Try API key authentication if JWT failed or not provided
      if (!user && allowApiKey) {
        const apiKey = request.headers['x-api-key'] as string;
        
        if (apiKey) {
          try {
            // Note: API key authentication would need to be implemented
            // user = await authService.authenticateWithApiKey(apiKey, correlationId);
            authMethod = 'api-key';
          } catch (error) {
            // If both JWT and API key fail, throw the error
            if (jwtToken) {
              // JWT was provided but failed, throw JWT error
              throw error;
            }
            throw error;
          }
        }
      }

      // Check if authentication is required
      if (required && !user) {
        throw new AuthenticationError('Authentication required', undefined, correlationId);
      }

      // Check role-based authorization
      if (user && roles.length > 0 && !roles.includes(user.role)) {
        throw new AuthorizationError(
          `Insufficient permissions. Required roles: ${roles.join(', ')}`,
          { userRole: user.role, requiredRoles: roles },
          correlationId
        );
      }

      // Attach user context to request
      if (user) {
        request.user = user;
        request.authMethod = authMethod;
        
        logger.debug({
          userId: user.id,
          authMethod,
          correlationId,
        }, 'Request authenticated successfully');
      }

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        url: request.url,
        method: request.method,
      }, 'Authentication failed');

      throw error;
    }
  };
}

// Convenience middleware functions
export const createRequireAuth = (authService: AuthService) => 
  createAuthMiddleware(authService, { required: true });

export const createOptionalAuth = (authService: AuthService) => 
  createAuthMiddleware(authService, { required: false });

export const createRequireRole = (authService: AuthService, ...roles: string[]) => 
  createAuthMiddleware(authService, { required: true, roles });