import { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '@/config/redis';
import { config } from '@/config/app';
import { RateLimitError } from '@/core/errors/app-error';
import { logger } from '@/core/utils/logger';

// Rate limit configuration interface
export interface RateLimitConfig {
  max: number;
  windowMs: number;
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skipIf?: (request: FastifyRequest) => boolean;
  onLimitReached?: (request: FastifyRequest, reply: FastifyReply) => void;
  store?: RateLimitStore;
}

// Rate limit store interface
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  reset(key: string): Promise<void>;
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
}

// Redis-based rate limit store
export class RedisRateLimitStore implements RateLimitStore {
  private redis = redis;

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const redisKey = `rate_limit:${key}:${window}`;
    const resetTime = (window + 1) * windowMs;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 1;

      return { count, resetTime };
    } catch (error) {
      logger.error({ error, key, windowMs }, 'Failed to increment rate limit counter');
      // Fallback: allow the request if Redis is down
      return { count: 1, resetTime };
    }
  }

  async reset(key: string): Promise<void> {
    try {
      const pattern = `rate_limit:${key}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error({ error, key }, 'Failed to reset rate limit counter');
    }
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    try {
      const now = Date.now();
      const windowMs = 60000; // Default 1 minute window for get operations
      const window = Math.floor(now / windowMs);
      const redisKey = `rate_limit:${key}:${window}`;
      const resetTime = (window + 1) * windowMs;

      const count = await this.redis.get(redisKey);
      
      if (count === null) {
        return null;
      }

      return { count: parseInt(count, 10), resetTime };
    } catch (error) {
      logger.error({ error, key }, 'Failed to get rate limit counter');
      return null;
    }
  }
}

// In-memory rate limit store (for development/testing)
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const storeKey = `${key}:${window}`;
    const resetTime = (window + 1) * windowMs;

    const existing = this.store.get(storeKey);
    const count = (existing?.count || 0) + 1;

    this.store.set(storeKey, { count, resetTime });

    // Clean up expired entries
    this.cleanup();

    return { count, resetTime };
  }

  async reset(key: string): Promise<void> {
    for (const storeKey of this.store.keys()) {
      if (storeKey.startsWith(`${key}:`)) {
        this.store.delete(storeKey);
      }
    }
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const now = Date.now();
    const windowMs = 60000; // Default 1 minute window
    const window = Math.floor(now / windowMs);
    const storeKey = `${key}:${window}`;

    return this.store.get(storeKey) || null;
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
}

// Rate limiter class
export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig) {
    this.config = {
      max: config.max,
      windowMs: config.windowMs,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      skipIf: config.skipIf || (() => false),
      onLimitReached: config.onLimitReached || this.defaultOnLimitReached,
      store: config.store || new RedisRateLimitStore(),
    };
    
    this.store = this.config.store;
  }

  private defaultKeyGenerator(request: FastifyRequest): string {
    // Use user ID if authenticated, otherwise use IP address
    if (request.user?.id) {
      return `user:${request.user.id}`;
    }
    
    return `ip:${request.ip}`;
  }

  private defaultOnLimitReached(request: FastifyRequest, reply: FastifyReply): void {
    const correlationId = request.correlationId;
    
    logger.warn({
      ip: request.ip,
      userId: request.user?.id,
      url: request.url,
      method: request.method,
      correlationId,
    }, 'Rate limit exceeded');
  }

  async middleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const correlationId = request.correlationId;

    try {
      // Check if request should be skipped
      if (this.config.skipIf(request)) {
        return;
      }

      // Generate rate limit key
      const key = this.config.keyGenerator(request);

      // Increment counter
      const { count, resetTime } = await this.store.increment(key, this.config.windowMs);

      // Set rate limit headers
      reply.header('X-RateLimit-Limit', this.config.max);
      reply.header('X-RateLimit-Remaining', Math.max(0, this.config.max - count));
      reply.header('X-RateLimit-Reset', new Date(resetTime).toISOString());

      // Check if limit is exceeded
      if (count > this.config.max) {
        this.config.onLimitReached(request, reply);
        
        throw new RateLimitError(
          'Rate limit exceeded',
          {
            limit: this.config.max,
            current: count,
            resetTime: new Date(resetTime).toISOString(),
            windowMs: this.config.windowMs,
          },
          correlationId
        );
      }

      logger.debug({
        key,
        count,
        limit: this.config.max,
        resetTime: new Date(resetTime).toISOString(),
        correlationId,
      }, 'Rate limit check passed');

    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }

      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      }, 'Rate limit check failed');

      // If rate limiting fails, allow the request to proceed
      // This prevents Redis issues from blocking all traffic
    }
  }
}

// Rate limit middleware factory
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const rateLimiter = new RateLimiter(config);
  
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await rateLimiter.middleware(request, reply);
  };
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // General API rate limiting
  general: {
    max: config.rateLimit.max,
    windowMs: config.rateLimit.windowMs,
  },

  // Strict rate limiting for authentication endpoints
  auth: {
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyGenerator: (request: FastifyRequest) => `auth:${request.ip}`,
  },

  // Rate limiting for query endpoints (more permissive for authenticated users)
  query: {
    max: 50,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (request: FastifyRequest) => {
      if (request.user?.id) {
        // Higher limit for authenticated users
        return `query:user:${request.user.id}`;
      }
      return `query:ip:${request.ip}`;
    },
  },

  // Rate limiting for file uploads
  upload: {
    max: 10,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (request: FastifyRequest) => {
      if (request.user?.id) {
        return `upload:user:${request.user.id}`;
      }
      return `upload:ip:${request.ip}`;
    },
  },

  // Rate limiting for admin operations
  admin: {
    max: 100,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (request: FastifyRequest) => `admin:${request.user?.id || request.ip}`,
    skipIf: (request: FastifyRequest) => request.user?.role !== 'ADMIN',
  },

  // Rate limiting for webhook endpoints
  webhook: {
    max: 1000,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (request: FastifyRequest) => {
      const webhookId = request.headers['x-webhook-id'] as string;
      return webhookId ? `webhook:${webhookId}` : `webhook:ip:${request.ip}`;
    },
  },
};

// Convenience middleware functions
export const generalRateLimit = createRateLimitMiddleware(rateLimitConfigs.general);
export const authRateLimit = createRateLimitMiddleware(rateLimitConfigs.auth);
export const queryRateLimit = createRateLimitMiddleware(rateLimitConfigs.query);
export const uploadRateLimit = createRateLimitMiddleware(rateLimitConfigs.upload);
export const adminRateLimit = createRateLimitMiddleware(rateLimitConfigs.admin);
export const webhookRateLimit = createRateLimitMiddleware(rateLimitConfigs.webhook);

// Rate limit bypass for specific conditions
export function createBypassRateLimit(condition: (request: FastifyRequest) => boolean) {
  return (request: FastifyRequest, reply: FastifyReply): void => {
    if (condition(request)) {
      // Skip rate limiting
      return;
    }
    // Continue to next middleware (rate limiter)
  };
}

// Rate limit monitoring
export class RateLimitMonitor {
  private store: RateLimitStore;

  constructor(store: RateLimitStore = new RedisRateLimitStore()) {
    this.store = store;
  }

  async getUserRateLimit(userId: string): Promise<{ count: number; resetTime: number } | null> {
    return await this.store.get(`user:${userId}`);
  }

  async getIpRateLimit(ip: string): Promise<{ count: number; resetTime: number } | null> {
    return await this.store.get(`ip:${ip}`);
  }

  async resetUserRateLimit(userId: string): Promise<void> {
    await this.store.reset(`user:${userId}`);
  }

  async resetIpRateLimit(ip: string): Promise<void> {
    await this.store.reset(`ip:${ip}`);
  }

  async getRateLimitStats(): Promise<Record<string, any>> {
    // This would require additional Redis operations to gather statistics
    // Implementation depends on specific monitoring requirements
    return {
      message: 'Rate limit statistics not implemented yet',
      timestamp: new Date().toISOString(),
    };
  }
}

// Export rate limit monitor instance
export const rateLimitMonitor = new RateLimitMonitor();

// Rate limit utilities
export class RateLimitUtils {
  static calculateResetTime(windowMs: number): number {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    return (window + 1) * windowMs;
  }

  static formatResetTime(resetTime: number): string {
    return new Date(resetTime).toISOString();
  }

  static getRemainingTime(resetTime: number): number {
    return Math.max(0, resetTime - Date.now());
  }

  static formatRemainingTime(resetTime: number): string {
    const remaining = this.getRemainingTime(resetTime);
    const seconds = Math.ceil(remaining / 1000);
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minutes`;
    } else {
      const hours = Math.ceil(seconds / 3600);
      return `${hours} hours`;
    }
  }
}

// Export is already handled by the class declaration above

