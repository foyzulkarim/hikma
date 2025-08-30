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
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
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
      cliPath: process.env.GITHUB_CLI_PATH || 'gh',
      apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
      enableTempCloning: process.env.GITHUB_ENABLE_TEMP_CLONING === 'true',
      tempCloneTimeout: parseInt(process.env.GITHUB_TEMP_CLONE_TIMEOUT || '300000', 10), // 5 minutes
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

  // Temporary Directory Configuration
  tempDirectory: {
    basePath: process.env.TEMP_DIR_BASE_PATH || '/tmp/hikma',
    maxAge: parseInt(process.env.TEMP_DIR_MAX_AGE || '3600000', 10), // 1 hour
    cleanupInterval: parseInt(process.env.TEMP_DIR_CLEANUP_INTERVAL || '1800000', 10), // 30 minutes
    maxSize: parseInt(process.env.TEMP_DIR_MAX_SIZE || '1073741824', 10), // 1GB
    enableAutoCleanup: process.env.TEMP_DIR_ENABLE_AUTO_CLEANUP !== 'false',
  },

  // LLM Configuration
  llm: {
    provider: process.env.LLM_PROVIDER || 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
  },

  // Vector Database Configuration
  vectorDb: {
    provider: process.env.VECTOR_DB_PROVIDER || 'qdrant',
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || '',
    collection: process.env.QDRANT_COLLECTION || 'hikma-embeddings',
    dimension: parseInt(process.env.VECTOR_DIMENSION || '1536', 10),
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
      'ENCRYPTION_KEY',
    ];

    for (const key of required) {
      if (!process.env[key]) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // Validate JWT secret length (only if provided)
    if (appConfig.security.jwtSecret && appConfig.security.jwtSecret.length < 32) {
      if (isProduction) {
        errors.push('JWT_SECRET must be at least 32 characters long in production');
      }
    }

    // Validate encryption key length (only if provided)
    if (appConfig.security.encryptionKey && appConfig.security.encryptionKey.length !== 32) {
      if (isProduction) {
        errors.push('ENCRYPTION_KEY must be exactly 32 characters long in production');
      }
    }

    // Check for insecure default values
    if (appConfig.security.jwtSecret === 'your-super-secret-jwt-key') {
      if (isProduction) {
        errors.push('JWT_SECRET cannot use the default insecure value in production');
      }
    }

    if (appConfig.security.encryptionKey === 'your-32-character-encryption-key') {
      if (isProduction) {
        errors.push('ENCRYPTION_KEY cannot use the default insecure value in production');
      }
    }

    // Validate port range
    if (appConfig.server.port < 1 || appConfig.server.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    // Validate bcrypt rounds
    if (appConfig.security.bcryptRounds < 10 || appConfig.security.bcryptRounds > 15) {
      errors.push('BCRYPT_ROUNDS must be between 10 and 15');
    }

    // Validate external services configuration
    ConfigValidator.validateExternalServices(errors);

    // Validate production readiness
    ConfigValidator.validateProductionReadiness(errors);

    // Log warnings for optional but recommended variables
    const recommended = [
      'OPENAI_API_KEY',
      'REDIS_URL',
      'NEO4J_URL',
    ];

    for (const key of recommended) {
      if (!process.env[key]) {
        console.warn(`Recommended environment variable not set: ${key}`);
      }
    }

    if (errors.length > 0) {
      console.error('Configuration validation failed:', errors);
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    console.log('Configuration validation passed');
  }

  private static validateExternalServices(errors: string[]): void {
    // GitHub validation
    if (appConfig.external.github.token && appConfig.external.github.token.length < 10) {
      errors.push('GITHUB_TOKEN appears to be invalid (too short)');
    }

    // Jira validation - if any Jira config is provided, all required fields should be present
    const jiraConfig = appConfig.external.jira;
    const hasJiraConfig = jiraConfig.url || jiraConfig.email || jiraConfig.apiToken;
    if (hasJiraConfig) {
      if (!jiraConfig.url) {
        errors.push('JIRA_URL is required when Jira integration is configured');
      }
      if (!jiraConfig.email) {
        errors.push('JIRA_EMAIL is required when Jira integration is configured');
      }
      if (!jiraConfig.apiToken) {
        errors.push('JIRA_API_TOKEN is required when Jira integration is configured');
      }
      if (jiraConfig.url && !jiraConfig.url.startsWith('https://')) {
        errors.push('JIRA_URL must use HTTPS protocol');
      }
    }

    // Slack validation - if any Slack config is provided, required fields should be present
    const slackConfig = appConfig.external.slack;
    const hasSlackConfig = slackConfig.botToken || slackConfig.signingSecret || slackConfig.appToken;
    if (hasSlackConfig) {
      if (!slackConfig.botToken) {
        errors.push('SLACK_BOT_TOKEN is required when Slack integration is configured');
      }
      if (!slackConfig.signingSecret) {
        errors.push('SLACK_SIGNING_SECRET is required when Slack integration is configured');
      }
      if (slackConfig.botToken && !slackConfig.botToken.startsWith('xoxb-')) {
        errors.push('SLACK_BOT_TOKEN appears to be invalid (should start with xoxb-)');
      }
    }

    // LLM validation
    if (appConfig.llm.provider === 'openai' && !appConfig.llm.apiKey) {
      errors.push('OPENAI_API_KEY is required when using OpenAI as LLM provider');
    }

    // Vector DB validation
    if (appConfig.vectorDb.provider === 'qdrant' && !appConfig.vectorDb.url) {
      errors.push('QDRANT_URL is required when using Qdrant as vector database');
    }
  }

  private static validateProductionReadiness(errors: string[]): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
      console.log('Skipping production readiness checks (not in production mode)');
      return;
    }

    const warnings: string[] = [];

    // Check for development database URLs
    if (process.env.DATABASE_URL?.includes('localhost') || 
        process.env.DATABASE_URL?.includes('127.0.0.1')) {
      warnings.push('DATABASE_URL appears to use localhost - ensure this is intentional for production');
    }

    // Check for development Redis URLs
    if (process.env.REDIS_URL?.includes('localhost') || 
        process.env.REDIS_URL?.includes('127.0.0.1')) {
      warnings.push('REDIS_URL appears to use localhost - ensure this is intentional for production');
    }

    // Check for development Neo4j URLs
    if (process.env.NEO4J_URL?.includes('localhost') || 
        process.env.NEO4J_URL?.includes('127.0.0.1')) {
      warnings.push('NEO4J_URL appears to use localhost - ensure this is intentional for production');
    }

    // Check for development Qdrant URLs
    if (process.env.QDRANT_URL?.includes('localhost') || 
        process.env.QDRANT_URL?.includes('127.0.0.1')) {
      warnings.push('QDRANT_URL appears to use localhost - ensure this is intentional for production');
    }

    // Check for weak passwords in URLs
    const weakPasswords = ['password', '123', 'admin', 'root', 'test'];
    const urlsToCheck = [
      process.env.DATABASE_URL,
      process.env.REDIS_URL,
      process.env.NEO4J_URL
    ];

    urlsToCheck.forEach((url, index) => {
      if (url) {
        const urlNames = ['DATABASE_URL', 'REDIS_URL', 'NEO4J_URL'];
        weakPasswords.forEach(weakPass => {
          if (url.includes(weakPass)) {
            errors.push(`${urlNames[index]} contains weak password pattern '${weakPass}'`);
          }
        });
      }
    });

    // Check for development mode flags
    if (process.env.DEV_LOG_SQL_QUERIES === 'true') {
      warnings.push('DEV_LOG_SQL_QUERIES is enabled - consider disabling in production for performance');
    }

    // Check for missing CORS origins in production
    if (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS === '*') {
      warnings.push('CORS_ORIGINS is not properly configured - using wildcard (*) is not recommended for production');
    }

    // Check for default encryption key length
    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
      errors.push('ENCRYPTION_KEY should be at least 32 characters long for production use');
    }

    // Check for HTTPS requirements
    if (process.env.JIRA_URL && !process.env.JIRA_URL.startsWith('https://')) {
      warnings.push('JIRA_URL should use HTTPS in production');
    }

    // Log warnings
    if (warnings.length > 0) {
      console.warn('Production configuration warnings:', warnings);
    }

    if (warnings.length === 0) {
      console.log('Production readiness validation completed successfully');
    }
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

