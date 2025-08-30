import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { config } from '@/config/app.js';
import { logger } from '@/core/utils/logger.js';

// Global test setup
export default async function globalSetup() {
  logger.info('Starting global test setup...');

  try {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
    
    // Setup test database
    await setupTestDatabase();
    
    // Setup test Redis
    await setupTestRedis();
    
    // Setup test vector store
    await setupTestVectorStore();
    
    logger.info('Global test setup completed successfully');
    
  } catch (error) {
    logger.error({ error }, 'Global test setup failed');
    throw error;
  }
}

async function setupTestDatabase() {
  try {
    // Use test database URL
    const testDbUrl = process.env.TEST_DATABASE_URL || 
      'postgresql://hikma:hikma123@localhost:5432/hikma_test';
    
    process.env.DATABASE_URL = testDbUrl;
    
    // Run database migrations for test database
    logger.info('Setting up test database...');
    execSync('npx prisma db push --force-reset', { 
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: testDbUrl }
    });
    
    logger.info('Test database setup completed');
  } catch (error) {
    logger.error({ error }, 'Test database setup failed');
    throw error;
  }
}

async function setupTestRedis() {
  try {
    // Use test Redis URL
    const testRedisUrl = process.env.TEST_REDIS_URL || 
      'redis://localhost:6379/1'; // Use database 1 for tests
    
    process.env.REDIS_URL = testRedisUrl;
    
    logger.info('Test Redis setup completed');
  } catch (error) {
    logger.error({ error }, 'Test Redis setup failed');
    throw error;
  }
}

async function setupTestVectorStore() {
  try {
    // Use mock vector store for tests (Pinecone no longer used)
    process.env.USE_MOCK_VECTOR_STORE = 'true';
    
    logger.info('Test vector store setup completed');
  } catch (error) {
    logger.error({ error }, 'Test vector store setup failed');
    throw error;
  }
}

