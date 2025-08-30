// Import middleware functions for local use in middleware stacks
import {
  correlationIdMiddleware,
  requestLoggingMiddleware,
  developmentLoggingMiddleware,
  productionLoggingMiddleware,
  securityAuditLoggingMiddleware,
  requestSizeMiddleware,
} from './logging';

// Auth middleware is now in the users module

import {
  generalRateLimit,
  authRateLimit,
  queryRateLimit,
  uploadRateLimit,
  adminRateLimit,
  webhookRateLimit,
} from './rate-limit';

// Authentication middleware is now in the users module
// Import from '@/modules/domains/users' instead

// Validation middleware
export {
  createValidationMiddleware,
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders,
  validatePagination,
  validateSearch,
  validateDateRange,
  validateId,
  validateUuid,
  validateFileUpload,
  commonSchemas,
  ValidationHelpers,
  type ValidationTarget,
  type ValidationOptions,
} from './validation';

// Error handling middleware
export {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  setupUnhandledRejectionHandler,
  ErrorHandler,
  ErrorMonitor,
  type ErrorResponse,
} from './error-handler';

// Rate limiting middleware
export {
  createRateLimitMiddleware,
  generalRateLimit,
  authRateLimit,
  queryRateLimit,
  uploadRateLimit,
  adminRateLimit,
  webhookRateLimit,
  createBypassRateLimit,
  rateLimitMonitor,
  RateLimiter,
  RedisRateLimitStore,
  MemoryRateLimitStore,
  RateLimitUtils,
  rateLimitConfigs,
  type RateLimitConfig,
  type RateLimitStore,
} from './rate-limit';

// Logging middleware
export {
  createRequestLoggingMiddleware,
  requestLoggingMiddleware,
  developmentLoggingMiddleware,
  productionLoggingMiddleware,
  securityAuditLoggingMiddleware,
  performanceLoggingMiddleware,
  correlationIdMiddleware,
  requestTimingMiddleware,
  requestSizeMiddleware,
  RequestLoggingMiddleware,
  type RequestLoggingConfig,
  type RequestContext,
} from './logging';

// Middleware composition utilities
export class MiddlewareComposer {
  private middlewares: Array<(request: any, reply: any) => Promise<void>> = [];

  add(middleware: (request: any, reply: any) => Promise<void>): this {
    this.middlewares.push(middleware);
    return this;
  }

  compose(): (request: any, reply: any) => Promise<void> {
    return async (request: any, reply: any): Promise<void> => {
      for (const middleware of this.middlewares) {
        await middleware(request, reply);
      }
    };
  }

  static create(): MiddlewareComposer {
    return new MiddlewareComposer();
  }
}

// Common middleware stacks
export const commonMiddlewareStacks = {
  // Basic stack for public endpoints
  public: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .compose(),

  // Authenticated stack for protected endpoints
  // Note: Auth middleware should be imported from '@/modules/domains/users'
  authenticated: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .compose(),

  // Admin stack for admin endpoints
  // Note: Auth middleware should be imported from '@/modules/domains/users'
  admin: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(adminRateLimit)
    .compose(),

  // API key stack for API endpoints
  // Note: Auth middleware should be imported from '@/modules/domains/users'
  apiKey: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .compose(),

  // Upload stack for file upload endpoints
  // Note: Auth middleware should be imported from '@/modules/domains/users'
  upload: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(uploadRateLimit)
    .add(requestSizeMiddleware)
    .compose(),

  // Query stack for query endpoints
  // Note: Auth middleware should be imported from '@/modules/domains/users'
  query: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(queryRateLimit)
    .compose(),

  // Webhook stack for webhook endpoints
  webhook: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(webhookRateLimit)
    .compose(),

  // Development stack with verbose logging
  // Note: Auth middleware should be imported from '@/modules/domains/users'
  development: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(developmentLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .compose(),

  // Security audit stack
  // Note: Auth middleware should be imported from '@/modules/domains/users'
  securityAudit: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(securityAuditLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .compose(),
};

// Middleware configuration based on environment
// Note: Auth middleware should be imported from '@/modules/domains/users'
export const getEnvironmentMiddleware = (environment: string) => {
  switch (environment) {
    case 'development':
      return {
        logging: developmentLoggingMiddleware,
        rateLimit: generalRateLimit,
      };
    
    case 'staging':
      return {
        logging: requestLoggingMiddleware,
        rateLimit: generalRateLimit,
      };
    
    case 'production':
      return {
        logging: productionLoggingMiddleware,
        rateLimit: generalRateLimit,
      };
    
    default:
      return {
        logging: requestLoggingMiddleware,
        rateLimit: generalRateLimit,
      };
  }
};

// Middleware utilities
export class MiddlewareUtils {
  static conditionalMiddleware(
    condition: (request: any) => boolean,
    middleware: (request: any, reply: any) => Promise<void>
  ) {
    return async (request: any, reply: any): Promise<void> => {
      if (condition(request)) {
        await middleware(request, reply);
      }
    };
  }

  static skipMiddleware(
    skipCondition: (request: any) => boolean,
    middleware: (request: any, reply: any) => Promise<void>
  ) {
    return async (request: any, reply: any): Promise<void> => {
      if (!skipCondition(request)) {
        await middleware(request, reply);
      }
    };
  }

  static timeoutMiddleware(timeoutMs: number) {
    return async (request: any, reply: any): Promise<void> => {
      const timeout = setTimeout(() => {
        if (!reply.sent) {
          reply.status(408).send({
            error: {
              message: 'Request timeout',
              code: 'REQUEST_TIMEOUT',
              statusCode: 408,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }, timeoutMs);

      reply.raw.on('finish', () => {
        clearTimeout(timeout);
      });
    };
  }

  static cacheMiddleware(cacheKeyGenerator: (request: any) => string, ttlSeconds: number) {
    return async (request: any, reply: any): Promise<void> => {
      // This would integrate with the cache service
      // Implementation depends on specific caching requirements
      const cacheKey = cacheKeyGenerator(request);
      // TODO: Implement caching logic
    };
  }
}

// Export is already handled by the class declaration above

