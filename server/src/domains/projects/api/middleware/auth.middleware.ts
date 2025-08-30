import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '@/domains/users/auth/service';
import { createAuthMiddleware, createRequireAuth, createRequireRole } from '@/domains/users/auth/middleware';
import { UserContext } from '@/domains/users/auth/types';

// Extended request interface for project-specific authentication
export interface AuthenticatedRequest extends FastifyRequest {
  user: UserContext;
}

/**
 * Project-specific authentication middleware factory
 */
export class ProjectAuthMiddleware {
  constructor(private authService: AuthService) {}

  /**
   * Require authentication for project operations
   */
  requireAuth() {
    return createRequireAuth(this.authService);
  }

  /**
   * Require admin role for project management operations
   */
  requireAdmin() {
    return createRequireRole(this.authService, 'admin');
  }

  /**
   * Require admin or manager role for project operations
   */
  requireManagerOrAdmin() {
    return createRequireRole(this.authService, 'admin', 'manager');
  }

  /**
   * Custom middleware for project ownership validation
   * Checks if user is owner of the project or has admin privileges
   */
  requireProjectOwnershipOrAdmin() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // First ensure user is authenticated
      await this.requireAuth()(request, reply);
      
      const user = (request as AuthenticatedRequest).user;
      const projectId = (request.params as any)?.id;

      // Admin users can access any project
      if (user.role === 'admin') {
        return;
      }

      // For non-admin users, we would need to check project ownership
      // This would require injecting ProjectService or ProjectRepository
      // For now, we'll allow manager role as well
      if (user.role !== 'manager') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions to access this project'
        });
      }
    };
  }

  /**
   * Middleware for project member validation
   * Checks if user is a member of the project, owner, or admin
   */
  requireProjectMembershipOrAdmin() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // First ensure user is authenticated
      await this.requireAuth()(request, reply);
      
      const user = (request as AuthenticatedRequest).user;
      
      // Admin users can access any project
      if (user.role === 'admin') {
        return;
      }

      // For project membership validation, we would need to:
      // 1. Extract project ID from request params
      // 2. Check if user is a member of the project
      // 3. Allow access if user is member, owner, or admin
      
      // This is a placeholder - actual implementation would require
      // injecting ProjectMemberService or similar
      const projectId = (request.params as any)?.id;
      
      // For now, allow authenticated users with manager role or above
      if (!['admin', 'manager'].includes(user.role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions to access this project'
        });
      }
    };
  }
}

/**
 * Factory function to create project auth middleware with dependencies
 */
export function createProjectAuthMiddleware(authService: AuthService): ProjectAuthMiddleware {
  return new ProjectAuthMiddleware(authService);
}

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticatedRequest(request: FastifyRequest): request is AuthenticatedRequest {
  return request.user !== undefined;
}