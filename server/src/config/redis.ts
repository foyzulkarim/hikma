import Redis, { RedisOptions } from 'ioredis';
import { logger } from '@/core/utils/logger';

// Parse Redis URL if provided, otherwise use individual environment variables
function parseRedisConfig(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;
  
  let baseConfig: Partial<RedisOptions> = {};
  
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      baseConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0,
      };
      logger.info('Using Redis configuration from REDIS_URL');
    } catch (error) {
      logger.warn({ error }, 'Invalid REDIS_URL format, falling back to individual environment variables');
    }
  }
  
  // Individual environment variables take precedence over URL parsing
  return {
    host: process.env.REDIS_HOST || baseConfig.host || 'localhost',
    port: parseInt(process.env.REDIS_PORT || String(baseConfig.port || 6379), 10),
    password: process.env.REDIS_PASSWORD || baseConfig.password,
    db: parseInt(process.env.REDIS_DB || String(baseConfig.db || 0), 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST || '3', 10),
    lazyConnect: true,
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE || '30000', 10),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
    family: 4, // IPv4
  };
}

// Redis Configuration
const redisConfig: RedisOptions = parseRedisConfig();

// Create Redis instances
export const redis = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);
export const redisPublisher = new Redis(redisConfig);
export const queueRedis = new Redis(redisConfig);

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
      logger.info({ host: redisConfig.host, port: redisConfig.port, db: redisConfig.db }, 'Redis connected successfully');
      this.isConnected = true;
    });

    redis.on('ready', () => {
      logger.info('Redis ready and accepting commands');
    });

    redis.on('error', (error: any) => {
       const errorContext = {
         error: error.message,
         code: error.code || 'UNKNOWN',
         host: redisConfig.host,
         port: redisConfig.port,
         hasPassword: !!redisConfig.password,
       };
       
       if (error.code === 'ECONNREFUSED') {
         logger.error(errorContext, 'Redis connection refused - check if Redis server is running');
       } else if (error.code === 'ENOTFOUND') {
         logger.error(errorContext, 'Redis host not found - check REDIS_HOST configuration');
       } else if (error.message && error.message.includes('NOAUTH')) {
         logger.error(errorContext, 'Redis authentication failed - check REDIS_PASSWORD configuration');
       } else if (error.message && error.message.includes('WRONGPASS')) {
         logger.error(errorContext, 'Redis authentication failed - incorrect password');
       } else {
         logger.error(errorContext, 'Redis connection error');
       }
       this.isConnected = false;
     });

    redis.on('close', () => {
      logger.warn({ host: redisConfig.host, port: redisConfig.port }, 'Redis connection closed');
      this.isConnected = false;
    });

    redis.on('reconnecting', (delay: number) => {
       logger.info({ delay, host: redisConfig.host, port: redisConfig.port }, 'Redis reconnecting after delay');
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

