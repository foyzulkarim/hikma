import Redis, { RedisOptions } from 'ioredis';
import { logger } from '@/core/utils/logger.js';

// Redis Configuration
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
  family: 4, // IPv4
};

// Create Redis instances
export const redis = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);
export const redisPublisher = new Redis(redisConfig);

// Redis connection management
export class RedisManager {
  private static instance: RedisManager;
  private isConnected = false;

  private constructor() {
    this.setupEventHandlers();
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private setupEventHandlers(): void {
    // Main Redis client events
    redis.on('connect', () => {
      logger.info('Redis connected');
      this.isConnected = true;
    });

    redis.on('ready', () => {
      logger.info('Redis ready');
    });

    redis.on('error', (error) => {
      logger.error({ error }, 'Redis error');
      this.isConnected = false;
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    redis.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });

    // Subscriber events
    redisSubscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    redisSubscriber.on('error', (error) => {
      logger.error({ error }, 'Redis subscriber error');
    });

    // Publisher events
    redisPublisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });

    redisPublisher.on('error', (error) => {
      logger.error({ error }, 'Redis publisher error');
    });
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        redis.connect(),
        redisSubscriber.connect(),
        redisPublisher.connect(),
      ]);
      logger.info('All Redis connections established');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        redis.disconnect(),
        redisSubscriber.disconnect(),
        redisPublisher.disconnect(),
      ]);
      this.isConnected = false;
      logger.info('All Redis connections closed');
    } catch (error) {
      logger.error({ error }, 'Failed to disconnect from Redis');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error({ error }, 'Redis health check failed');
      return false;
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public getClient(): Redis {
    return redis;
  }

  public getSubscriber(): Redis {
    return redisSubscriber;
  }

  public getPublisher(): Redis {
    return redisPublisher;
  }
}

// Cache utility functions
export class CacheService {
  private redis: Redis;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error({ error, key }, 'Failed to get cache value');
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Failed to set cache value');
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete cache value');
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Failed to check cache existence');
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      await this.redis.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Failed to set cache expiration');
      return false;
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, by);
    } catch (error) {
      logger.error({ error, key }, 'Failed to increment cache value');
      throw error;
    }
  }

  async getPattern(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      logger.error({ error, pattern }, 'Failed to get keys by pattern');
      return [];
    }
  }
}

// Export singleton instances
export const redisManager = RedisManager.getInstance();
export const cacheService = new CacheService();

// Graceful shutdown handling
process.on('beforeExit', async () => {
  await redisManager.disconnect();
});

process.on('SIGINT', async () => {
  await redisManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisManager.disconnect();
  process.exit(0);
});

