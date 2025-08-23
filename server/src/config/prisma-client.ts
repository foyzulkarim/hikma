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
    try {
      await prisma.$connect();
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to database');
      throw error;
    }
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
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
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

