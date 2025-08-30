import { logger } from '@/core/utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string; // Custom cache key
}

// Simple in-memory cache for demonstration
// In production, this would use Redis or another cache store
class SimpleCache {
  private cache = new Map<string, { value: any; expires: number }>();

  set(key: string, value: any, ttl: number): void {
    const expires = Date.now() + ttl;
    this.cache.set(key, { value, expires });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new SimpleCache();

/**
 * Cache decorator for method results
 */
export function Cache(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const ttl = options.ttl || 300000; // Default 5 minutes

    descriptor.value = async function (...args: any[]) {
      // Generate cache key
      const baseKey = options.key || `${target.constructor.name}.${propertyName}`;
      const argsKey = JSON.stringify(args);
      const cacheKey = `${baseKey}:${argsKey}`;

      // Try to get from cache
      const cached = cache.get(cacheKey);
      if (cached !== null) {
        logger.debug({ cacheKey }, 'Cache hit');
        return cached;
      }

      // Execute method and cache result
      try {
        const result = await method.apply(this, args);
        cache.set(cacheKey, result, ttl);
        logger.debug({ cacheKey, ttl }, 'Cache set');
        return result;
      } catch (error) {
        logger.error({ error, cacheKey }, 'Method execution failed');
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Cache invalidation decorator
 */
export function CacheInvalidate(pattern: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      // Simple pattern matching for cache invalidation
      // In production, this would be more sophisticated
      if (pattern === '*') {
        cache.clear();
        logger.debug('Cache cleared completely');
      } else {
        // For now, just clear all - in production would match pattern
        cache.clear();
        logger.debug({ pattern }, 'Cache invalidated by pattern');
      }

      return result;
    };

    return descriptor;
  };
}
