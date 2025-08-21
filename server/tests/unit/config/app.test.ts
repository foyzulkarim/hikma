import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigValidator, appConfig, getEnvironmentConfig } from '@/config/app.js';
import { logger } from '@/core/utils/logger.js';

// Mock logger to prevent actual logging during tests
vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConfigValidator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should validate successfully with all required env vars', () => {
    process.env.DATABASE_URL = 'postgresql://user:password@host:port/database';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.PORT = '3000';
    process.env.BCRYPT_ROUNDS = '12';

    expect(() => ConfigValidator.validate()).not.toThrow();
    expect(logger.info).toHaveBeenCalledWith('Configuration validation passed');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw error if DATABASE_URL is missing', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.PORT = '3000';
    process.env.BCRYPT_ROUNDS = '12';

    expect(() => ConfigValidator.validate()).toThrow('Missing required environment variable: DATABASE_URL');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw error if JWT_SECRET is too short', () => {
    process.env.DATABASE_URL = 'test';
    process.env.JWT_SECRET = 'short';
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.PORT = '3000';
    process.env.BCRYPT_ROUNDS = '12';

    expect(() => ConfigValidator.validate()).toThrow('JWT_SECRET must be at least 32 characters long');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw error if ENCRYPTION_KEY is not 32 characters', () => {
    process.env.DATABASE_URL = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'short';
    process.env.PORT = '3000';
    process.env.BCRYPT_ROUNDS = '12';

    expect(() => ConfigValidator.validate()).toThrow('ENCRYPTION_KEY must be exactly 32 characters long');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw error if PORT is out of range', () => {
    process.env.DATABASE_URL = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.PORT = '0';
    process.env.BCRYPT_ROUNDS = '12';

    expect(() => ConfigValidator.validate()).toThrow('PORT must be between 1 and 65535');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw error if BCRYPT_ROUNDS is out of range', () => {
    process.env.DATABASE_URL = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.PORT = '3000';
    process.env.BCRYPT_ROUNDS = '9';

    expect(() => ConfigValidator.validate()).toThrow('BCRYPT_ROUNDS must be between 10 and 15');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should warn about missing recommended env vars', () => {
    process.env.DATABASE_URL = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.PORT = '3000';
    process.env.BCRYPT_ROUNDS = '12';
    // Missing OPENAI_API_KEY, REDIS_URL, etc.

    ConfigValidator.validate();
    expect(logger.warn).toHaveBeenCalledWith('Recommended environment variable not set: OPENAI_API_KEY');
    expect(logger.warn).toHaveBeenCalledWith('Recommended environment variable not set: REDIS_URL');
  });
});

describe('getEnvironmentConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return development config by default', () => {
    process.env.NODE_ENV = 'development';
    const config = getEnvironmentConfig();
    expect(config.server.logLevel).toBe('info'); // Default from appConfig
    expect(config.monitoring.metricsEnabled).toBe(false); // Default from appConfig
  });

  it('should return production config', () => {
    process.env.NODE_ENV = 'production';
    const config = getEnvironmentConfig();
    expect(config.server.logLevel).toBe('warn');
    expect(config.monitoring.metricsEnabled).toBe(true);
    expect(config.development.seedData).toBe(false);
  });

  it('should return staging config', () => {
    process.env.NODE_ENV = 'staging';
    const config = getEnvironmentConfig();
    expect(config.server.logLevel).toBe('info');
    expect(config.monitoring.metricsEnabled).toBe(true);
    expect(config.development.seedData).toBe(true);
  });

  it('should return test config', () => {
    process.env.NODE_ENV = 'test';
    const config = getEnvironmentConfig();
    expect(config.server.logLevel).toBe('silent');
    expect(config.monitoring.metricsEnabled).toBe(false);
    expect(config.development.mockExternalApis).toBe(true);
  });
});


