import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTUtils, ApiKeyUtils } from '@/core/utils/crypto.js';
import { prisma } from '@/config/database.js';
import { cacheService } from '@/config/redis.js';
import { logger, CorrelationIdManager } from '@/core/utils/logger.js';
import {
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
} from '@/core/errors/app-error.js';

// User context interface
export interface UserContext {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
}

// Authentication method types
export type AuthMethod = 'jwt' | 'api-key' | 'none';

// Extend Fastify request with user context
declare module 'fastify' {
  interface FastifyRequest {
    user?: UserContext;
    authMethod?: AuthMethod;
    correlationId?: string;
  }
}

// Authentication service
export class AuthService {
  private static readonly JWT_CACHE_PREFIX = 'jwt_user:';
  private static readonly API_KEY_CACHE_PREFIX = 'api_key:';
  private static readonly CACHE_TTL = 300; // 5 minutes

  static async authenticateJWT(token: string, correlationId?: string): Promise<UserContext> {
    try {
      // Verify and decode JWT token
      const decoded = JWTUtils.verifyToken(token);
      
      // Check cache first
      const cacheKey = `${this.JWT_CACHE_PREFIX}${decoded.userId}`;
      const cachedUser = await cacheService.get<UserContext>(cacheKey);
      
      if (cachedUser) {
        logger.debug({ userId: decoded.userId, correlationId }, 'User authenticated from cache');
        return cachedUser;
      }

      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
        },
      });

      if (!user) {
        throw new AuthenticationError('User not found', { userId: decoded.userId }, correlationId);
      }

      if (!user.isActive) {
        throw new AuthenticationError('User account is disabled', { userId: decoded.userId }, correlationId);
      }

      const userContext: UserContext = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      };

      // Cache user context
      await cacheService.set(cacheKey, userContext, this.CACHE_TTL);

      logger.debug({ userId: user.id, correlationId }, 'User authenticated via JWT');
      return userContext;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      logger.error({ error, correlationId }, 'JWT authentication failed');
      
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          throw new TokenExpiredError('JWT token has expired', undefined, correlationId);
        } else if (error.message.includes('invalid')) {
          throw new InvalidTokenError('Invalid JWT token', undefined, correlationId);
        }
      }
      
      throw new AuthenticationError('JWT authentication failed', undefined, correlationId);
    }
  }

  static async authenticateApiKey(apiKey: string, correlationId?: string): Promise<UserContext> {
    try {
      // Validate API key format
      if (!ApiKeyUtils.validateApiKeyFormat(apiKey)) {
        throw new InvalidTokenError('Invalid API key format', undefined, correlationId);
      }

      // Hash the API key for lookup
      const keyHash = ApiKeyUtils.hashApiKey(apiKey);
      
      // Check cache first
      const cacheKey = `${this.API_KEY_CACHE_PREFIX}${keyHash}`;
      const cachedUser = await cacheService.get<UserContext>(cacheKey);
      
      if (cachedUser) {
        logger.debug({ correlationId }, 'User authenticated from API key cache');
        return cachedUser;
      }

      // Fetch API key and user from database
      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      if (!apiKeyRecord) {
        throw new AuthenticationError('Invalid API key', undefined, correlationId);
      }

      if (!apiKeyRecord.isActive) {
        throw new AuthenticationError('API key is disabled', { keyId: apiKeyRecord.id }, correlationId);
      }

      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        throw new TokenExpiredError('API key has expired', { keyId: apiKeyRecord.id }, correlationId);
      }

      if (!apiKeyRecord.user.isActive) {
        throw new AuthenticationError('User account is disabled', { userId: apiKeyRecord.user.id }, correlationId);
      }

      const userContext: UserContext = {
        id: apiKeyRecord.user.id,
        email: apiKeyRecord.user.email,
        username: apiKeyRecord.user.username,
        role: apiKeyRecord.user.role,
        isActive: apiKeyRecord.user.isActive,
      };

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      });

      // Cache user context
      await cacheService.set(cacheKey, userContext, this.CACHE_TTL);

      logger.debug({ userId: apiKeyRecord.user.id, keyId: apiKeyRecord.id, correlationId }, 'User authenticated via API key');
      return userContext;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof TokenExpiredError || error instanceof InvalidTokenError) {
        throw error;
      }
      
      logger.error({ error, correlationId }, 'API key authentication failed');
      throw new AuthenticationError('API key authentication failed', undefined, correlationId);
    }
  }

  static async invalidateUserCache(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.JWT_CACHE_PREFIX}${userId}`;
      await cacheService.del(cacheKey);
      logger.debug({ userId }, 'User cache invalidated');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to invalidate user cache');
    }
  }

  static async invalidateApiKeyCache(keyHash: string): Promise<void> {
    try {
      const cacheKey = `${this.API_KEY_CACHE_PREFIX}${keyHash}`;
      await cacheService.del(cacheKey);
      logger.debug({ keyHash }, 'API key cache invalidated');
    } catch (error) {
      logger.error({ error, keyHash }, 'Failed to invalidate API key cache');
    }
  }
}

// Authentication middleware factory
export function createAuthMiddleware(options: {
  required?: boolean;
  roles?: string[];
  allowApiKey?: boolean;
} = {}) {
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
          user = await AuthService.authenticateJWT(jwtToken, correlationId);
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
            user = await AuthService.authenticateApiKey(apiKey, correlationId);
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

      if (error instanceof AuthenticationError || 
          error instanceof AuthorizationError || 
          error instanceof TokenExpiredError || 
          error instanceof InvalidTokenError) {
        throw error;
      }

      throw new AuthenticationError('Authentication failed', undefined, correlationId);
    }
  };
}

// Convenience middleware functions
export const requireAuth = createAuthMiddleware({ required: true });
export const optionalAuth = createAuthMiddleware({ required: false });
export const requireAdmin = createAuthMiddleware({ required: true, roles: ['ADMIN'] });
export const requireApiKey = createAuthMiddleware({ required: true, allowApiKey: true });

// Role-based middleware factory
export function requireRole(...roles: string[]) {
  return createAuthMiddleware({ required: true, roles });
}

// Permission checking utilities
export class PermissionUtils {
  static hasRole(user: UserContext, role: string): boolean {
    return user.role === role;
  }

  static hasAnyRole(user: UserContext, roles: string[]): boolean {
    return roles.includes(user.role);
  }

  static isAdmin(user: UserContext): boolean {
    return user.role === 'ADMIN';
  }

  static isUser(user: UserContext): boolean {
    return user.role === 'USER';
  }

  static isViewer(user: UserContext): boolean {
    return user.role === 'VIEWER';
  }

  static canAccessProject(user: UserContext, projectId: string): Promise<boolean> {
    // This would typically check project membership
    // For now, return true for admins and implement project-specific logic later
    return Promise.resolve(user.role === 'ADMIN');
  }

  static canModifyProject(user: UserContext, projectId: string): Promise<boolean> {
    // This would typically check project ownership/admin role
    return Promise.resolve(user.role === 'ADMIN');
  }
}

export { AuthService, PermissionUtils };

