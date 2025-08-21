// Authentication middleware
export {
  createAuthMiddleware,
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireApiKey,
  requireRole,
  AuthService,
  PermissionUtils,
  type UserContext,
  type AuthMethod,
} from './auth.js';

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
} from './validation.js';

// Error handling middleware
export {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  setupUnhandledRejectionHandler,
  ErrorHandler,
  ErrorMonitor,
  type ErrorResponse,
} from './error-handler.js';

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
} from './rate-limit.js';

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
} from './logging.js';

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
  authenticated: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .add(requireAuth)
    .compose(),

  // Admin stack for admin endpoints
  admin: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(adminRateLimit)
    .add(requireAdmin)
    .compose(),

  // API key stack for API endpoints
  apiKey: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .add(requireApiKey)
    .compose(),

  // Upload stack for file upload endpoints
  upload: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(uploadRateLimit)
    .add(requireAuth)
    .add(requestSizeMiddleware)
    .compose(),

  // Query stack for query endpoints
  query: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(queryRateLimit)
    .add(requireAuth)
    .compose(),

  // Webhook stack for webhook endpoints
  webhook: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(requestLoggingMiddleware.preHandler)
    .add(webhookRateLimit)
    .compose(),

  // Development stack with verbose logging
  development: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(developmentLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .add(optionalAuth)
    .compose(),

  // Security audit stack
  securityAudit: MiddlewareComposer.create()
    .add(correlationIdMiddleware)
    .add(securityAuditLoggingMiddleware.preHandler)
    .add(generalRateLimit)
    .add(requireAuth)
    .compose(),
};

// Middleware configuration based on environment
export const getEnvironmentMiddleware = (environment: string) => {
  switch (environment) {
    case 'development':
      return {
        logging: developmentLoggingMiddleware,
        rateLimit: generalRateLimit,
        auth: optionalAuth,
      };
    
    case 'staging':
      return {
        logging: requestLoggingMiddleware,
        rateLimit: generalRateLimit,
        auth: requireAuth,
      };
    
    case 'production':
      return {
        logging: productionLoggingMiddleware,
        rateLimit: generalRateLimit,
        auth: requireAuth,
      };
    
    default:
      return {
        logging: requestLoggingMiddleware,
        rateLimit: generalRateLimit,
        auth: requireAuth,
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

export { MiddlewareUtils };

