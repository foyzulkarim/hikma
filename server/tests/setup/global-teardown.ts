import { logger } from '@/core/utils/logger.js';

// Global test teardown
export default async function globalTeardown() {
  logger.info('Starting global test teardown...');

  try {
    // Cleanup test database
    await cleanupTestDatabase();
    
    // Cleanup test Redis
    await cleanupTestRedis();
    
    // Cleanup test vector store
    await cleanupTestVectorStore();
    
    logger.info('Global test teardown completed successfully');
    
  } catch (error) {
    logger.error({ error }, 'Global test teardown failed');
    // Don't throw error in teardown to avoid masking test failures
  }
}

async function cleanupTestDatabase() {
  try {
    // Database cleanup is handled by Prisma reset in setup
    // No additional cleanup needed
    logger.info('Test database cleanup completed');
  } catch (error) {
    logger.error({ error }, 'Test database cleanup failed');
  }
}

async function cleanupTestRedis() {
  try {
    // Redis cleanup - flush test database
    if (process.env.TEST_REDIS_URL) {
      const { Redis } = await import('ioredis');
      const redis = new Redis(process.env.TEST_REDIS_URL);
      await redis.flushdb();
      await redis.quit();
    }
    
    logger.info('Test Redis cleanup completed');
  } catch (error) {
    logger.error({ error }, 'Test Redis cleanup failed');
  }
}

async function cleanupTestVectorStore() {
  try {
    // Vector store cleanup
    // For test Pinecone index, we might want to delete all vectors
    // For mock vector store, no cleanup needed
    
    logger.info('Test vector store cleanup completed');
  } catch (error) {
    logger.error({ error }, 'Test vector store cleanup failed');
  }
}

