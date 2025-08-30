import { PrismaClient } from '@prisma/client';
import { logger } from '@/core/utils/logger';

// Prisma Client Configuration
const prismaConfig = {
  log: [
    {
      emit: 'event' as const,
      level: 'query' as const,
    },
    {
      emit: 'event' as const,
      level: 'error' as const,
    },
    {
      emit: 'event' as const,
      level: 'info' as const,
    },
    {
      emit: 'event' as const,
      level: 'warn' as const,
    },
  ],
  errorFormat: 'pretty' as const,
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

// Database connection retry configuration
const dbRetryConfig = {
  maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.DB_RETRY_DELAY || '2000', 10),
  connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  queryTimeoutMs: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
};

// Create Prisma Client instance
export const prisma = new PrismaClient(prismaConfig);

// Event listeners for logging
prisma.$on('query', (e) => {
  if (process.env.DEV_LOG_SQL_QUERIES === 'true') {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: e.duration,
    }, 'Database query executed');
  }
});

prisma.$on('error', (e) => {
  logger.error({
    target: e.target,
    message: e.message,
  }, 'Database error occurred');
});

prisma.$on('info', (e) => {
  logger.info({
    target: e.target,
    message: e.message,
  }, 'Database info');
});

prisma.$on('warn', (e) => {
  logger.warn({
    target: e.target,
    message: e.message,
  }, 'Database warning');
});

// Database connection management
export class DatabaseManager {
  private static instance: DatabaseManager;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async connect(): Promise<void> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= dbRetryConfig.maxRetries; attempt++) {
      try {
        // Set connection timeout
        const connectPromise = prisma.$connect();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), dbRetryConfig.connectionTimeoutMs);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        this.isConnected = true;
        logger.info({
          attempt,
          connectionTimeout: dbRetryConfig.connectionTimeoutMs,
        }, 'Database connected successfully');
        return;
      } catch (error: any) {
        lastError = error;
        logger.warn({ 
          error: error.message, 
          attempt, 
          maxRetries: dbRetryConfig.maxRetries,
          code: error.code || 'UNKNOWN'
        }, 'Database connection attempt failed');
        
        if (attempt < dbRetryConfig.maxRetries) {
          await this.delay(dbRetryConfig.retryDelayMs * attempt);
        }
      }
    }
    
    logger.error({ error: lastError }, 'Failed to connect to database after all retries');
    throw lastError;
  }

  public async disconnect(): Promise<void> {
    try {
      await prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to disconnect from database');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Add timeout to health check query
      const queryPromise = prisma.$queryRaw`SELECT 1`;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), dbRetryConfig.queryTimeoutMs);
      });
      
      await Promise.race([queryPromise, timeoutPromise]);
      return true;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public getClient(): PrismaClient {
    return prisma;
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();

// Graceful shutdown handling
process.on('beforeExit', async () => {
  await databaseManager.disconnect();
});

process.on('SIGINT', async () => {
  await databaseManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await databaseManager.disconnect();
  process.exit(0);
});

