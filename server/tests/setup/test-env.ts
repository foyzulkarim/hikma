import { beforeEach, afterEach, vi } from 'vitest';
import { config } from '@/config/app.js';

// Test environment setup that runs before each test
beforeEach(async () => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Reset environment variables to test defaults
  setupTestEnvironment();
  
  // Reset any global state
  resetGlobalState();
});

afterEach(async () => {
  // Cleanup after each test
  vi.restoreAllMocks();
  
  // Clear any test data
  await cleanupTestData();
});

function setupTestEnvironment() {
  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_EXPIRES_IN = '1h';
  
  // Database URLs
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 
    'postgresql://hikma:hikma123@localhost:5432/hikma_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 
    'redis://localhost:6379/1';
  
  // External service configurations
  process.env.OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY || 'test-openai-key';
  process.env.PINECONE_API_KEY = process.env.TEST_PINECONE_API_KEY || 'test-pinecone-key';
  process.env.PINECONE_INDEX_NAME = process.env.TEST_PINECONE_INDEX || 'test-index';
  
  // Mock external services by default
  process.env.USE_MOCK_OPENAI = 'true';
  process.env.USE_MOCK_PINECONE = 'true';
  
  // Rate limiting (more lenient for tests)
  process.env.RATE_LIMIT_MAX = '1000';
  process.env.RATE_LIMIT_WINDOW = '60000';
}

function resetGlobalState() {
  // Reset any global state that might affect tests
  // This includes clearing caches, resetting singletons, etc.
}

async function cleanupTestData() {
  // Cleanup any test data that might affect other tests
  // This is handled per test suite, but we can add global cleanup here
}

// Export test utilities
export const testConfig = {
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://hikma:hikma123@localhost:5432/hikma_test',
  },
  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
  },
  jwt: {
    secret: 'test-jwt-secret-key',
    expiresIn: '1h',
  },
  openai: {
    apiKey: 'test-openai-key',
    model: 'gpt-3.5-turbo',
  },
  pinecone: {
    apiKey: 'test-pinecone-key',
    indexName: 'test-index',
  },
};

// Test helper functions
export const testHelpers = {
  // Wait for a specific amount of time
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate test data
  generateTestUser: () => ({
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    name: 'Test User',
  }),
  
  generateTestProject: () => ({
    name: `Test Project ${Date.now()}`,
    description: 'A test project',
    repositoryPath: '/tmp/test-repo',
  }),
  
  generateTestQuery: () => ({
    query: 'What does this code do?',
    projectId: 'test-project-id',
  }),
  
  // Mock response generators
  mockOpenAIResponse: (content: string) => ({
    choices: [{
      message: {
        role: 'assistant',
        content,
      },
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  }),
  
  mockPineconeResponse: (matches: any[] = []) => ({
    matches,
    namespace: 'test',
  }),
  
  // Database helpers
  cleanupDatabase: async () => {
    // This would clean up test data from the database
    // Implementation depends on your database setup
  },
  
  // Authentication helpers
  generateTestToken: async (userId: string = 'test-user-id') => {
    const { JWTUtils } = await import('@/core/utils/crypto.js');
    return JWTUtils.generateToken({
      userId,
      email: 'test@example.com',
      role: 'user',
    }, '1h');
  },
};

