import { logger } from '@/core/utils/logger.js';

// Application Configuration
export const appConfig = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  },

  // Rate Limiting Configuration
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true',
  },

  // File Upload Configuration
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10), // 10MB
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || [
      '.txt', '.md', '.json', '.yaml', '.yml', '.csv'
    ],
    uploadDir: process.env.UPLOAD_DIR || './data/uploads',
  },

  // Queue Configuration
  queue: {
    redisUrl: process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379',
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
    defaultJobOptions: {
      removeOnComplete: parseInt(process.env.QUEUE_REMOVE_COMPLETE || '100', 10),
      removeOnFail: parseInt(process.env.QUEUE_REMOVE_FAILED || '50', 10),
      attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000', 10),
      },
    },
  },

  // Monitoring Configuration
  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    tracingEnabled: process.env.TRACING_ENABLED === 'true',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    metricsPath: process.env.METRICS_PATH || '/metrics',
    healthPath: process.env.HEALTH_PATH || '/health',
  },

  // External Services Configuration
  external: {
    github: {
      token: process.env.GITHUB_TOKEN || '',
      cliPath: process.env.GITHUB_CLI_PATH || '/usr/bin/gh',
      apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    },
    jira: {
      url: process.env.JIRA_URL || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
      cliPath: process.env.JIRA_CLI_PATH || '/usr/local/bin/acli',
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN || '',
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      appToken: process.env.SLACK_APP_TOKEN || '',
    },
  },

  // Agent Configuration
  agent: {
    defaultPipeline: process.env.AGENT_DEFAULT_PIPELINE || 'general_inquiry',
    maxExecutionTime: parseInt(process.env.AGENT_MAX_EXECUTION_TIME || '300000', 10), // 5 minutes
    maxToolCalls: parseInt(process.env.AGENT_MAX_TOOL_CALLS || '10', 10),
    contextWindowSize: parseInt(process.env.AGENT_CONTEXT_WINDOW || '8192', 10),
    enableMemory: process.env.AGENT_ENABLE_MEMORY === 'true',
    memoryTtl: parseInt(process.env.AGENT_MEMORY_TTL || '3600', 10), // 1 hour
  },

  // Search Configuration
  search: {
    defaultTopK: parseInt(process.env.SEARCH_DEFAULT_TOP_K || '10', 10),
    maxTopK: parseInt(process.env.SEARCH_MAX_TOP_K || '50', 10),
    similarityThreshold: parseFloat(process.env.SEARCH_SIMILARITY_THRESHOLD || '0.7'),
    hybridSearchWeight: parseFloat(process.env.SEARCH_HYBRID_WEIGHT || '0.7'), // Vector vs keyword
    enableReranking: process.env.SEARCH_ENABLE_RERANKING === 'true',
  },

  // Ingestion Configuration
  ingestion: {
    batchSize: parseInt(process.env.INGESTION_BATCH_SIZE || '100', 10),
    chunkSize: parseInt(process.env.INGESTION_CHUNK_SIZE || '1000', 10),
    chunkOverlap: parseInt(process.env.INGESTION_CHUNK_OVERLAP || '200', 10),
    maxFileSize: parseInt(process.env.INGESTION_MAX_FILE_SIZE || '52428800', 10), // 50MB
    enableAutoSync: process.env.INGESTION_ENABLE_AUTO_SYNC === 'true',
    syncInterval: parseInt(process.env.INGESTION_SYNC_INTERVAL || '3600000', 10), // 1 hour
  },

  // Development Configuration
  development: {
    seedData: process.env.DEV_SEED_DATA === 'true',
    mockExternalApis: process.env.DEV_MOCK_EXTERNAL_APIS === 'true',
    logSqlQueries: process.env.DEV_LOG_SQL_QUERIES === 'true',
    enableDebugRoutes: process.env.DEV_ENABLE_DEBUG_ROUTES === 'true',
    hotReload: process.env.DEV_HOT_RELOAD === 'true',
  },
};

// Configuration validation
export class ConfigValidator {
  static validate(): void {
    const errors: string[] = [];

    // Required environment variables
    const required = [
      'DATABASE_URL',
      'JWT_SECRET',
    ];

    for (const key of required) {
      if (!process.env[key]) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    }

    // Validate JWT secret length
    if (appConfig.security.jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }

    // Validate encryption key length
    if (appConfig.security.encryptionKey.length !== 32) {
      errors.push('ENCRYPTION_KEY must be exactly 32 characters long');
    }

    // Validate port range
    if (appConfig.server.port < 1 || appConfig.server.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    // Validate bcrypt rounds
    if (appConfig.security.bcryptRounds < 10 || appConfig.security.bcryptRounds > 15) {
      errors.push('BCRYPT_ROUNDS must be between 10 and 15');
    }

    // Log warnings for optional but recommended variables
    const recommended = [
      'OPENAI_API_KEY',
      'PINECONE_API_KEY',
      'REDIS_URL',
      'NEO4J_URL',
    ];

    for (const key of recommended) {
      if (!process.env[key]) {
        logger.warn(`Recommended environment variable not set: ${key}`);
      }
    }

    if (errors.length > 0) {
      logger.error({ errors }, 'Configuration validation failed');
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    logger.info('Configuration validation passed');
  }
}

// Environment-specific configurations
export const getEnvironmentConfig = () => {
  const env = appConfig.server.environment;

  switch (env) {
    case 'production':
      return {
        ...appConfig,
        server: {
          ...appConfig.server,
          logLevel: 'warn',
        },
        monitoring: {
          ...appConfig.monitoring,
          metricsEnabled: true,
          tracingEnabled: true,
        },
        development: {
          ...appConfig.development,
          seedData: false,
          mockExternalApis: false,
          logSqlQueries: false,
          enableDebugRoutes: false,
          hotReload: false,
        },
      };

    case 'staging':
      return {
        ...appConfig,
        server: {
          ...appConfig.server,
          logLevel: 'info',
        },
        monitoring: {
          ...appConfig.monitoring,
          metricsEnabled: true,
          tracingEnabled: true,
        },
        development: {
          ...appConfig.development,
          seedData: true,
          mockExternalApis: false,
          logSqlQueries: false,
          enableDebugRoutes: true,
          hotReload: false,
        },
      };

    case 'test':
      return {
        ...appConfig,
        server: {
          ...appConfig.server,
          logLevel: 'silent',
        },
        monitoring: {
          ...appConfig.monitoring,
          metricsEnabled: false,
          tracingEnabled: false,
        },
        development: {
          ...appConfig.development,
          seedData: true,
          mockExternalApis: true,
          logSqlQueries: false,
          enableDebugRoutes: true,
          hotReload: false,
        },
      };

    case 'development':
    default:
      return appConfig;
  }
};

// Export the environment-specific configuration
export const config = getEnvironmentConfig();

// Validate configuration on import
ConfigValidator.validate();

