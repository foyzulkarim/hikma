import { describe, it, expect, beforeEach, vi } from 'vitest';
import pino from 'pino';
import { CorrelationIdManager, EnhancedLogger, RequestLogger, DatabaseLogger, ExternalApiLogger, AgentLogger } from '@/core/utils/logger.js';
import { config } from '@/config/app.js';

// Mock pino logger to capture logs
const mockPinoLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => mockPinoLogger), // Mock child method as well
};

// Mock the pino default export
vi.mock('pino', async (importOriginal) => {
  const actualPino = await importOriginal();
  return {
    ...actualPino,
    default: vi.fn(() => mockPinoLogger),
    stdTimeFunctions: actualPino.stdTimeFunctions,
    destination: actualPino.destination,
  };
});

describe('CorrelationIdManager', () => {
  beforeEach(() => {
    CorrelationIdManager.clear();
  });

  it('should generate a unique correlation ID', () => {
    const id1 = CorrelationIdManager.generate();
    const id2 = CorrelationIdManager.generate();
    expect(id1).toBeTypeOf('string');
    expect(id1).not.toEqual(id2);
  });

  it('should set and get a correlation ID', () => {
    const requestId = 'req-123';
    const correlationId = 'corr-abc';
    CorrelationIdManager.set(requestId, correlationId);
    expect(CorrelationIdManager.get(requestId)).toEqual(correlationId);
  });

  it('should delete a correlation ID', () => {
    const requestId = 'req-123';
    const correlationId = 'corr-abc';
    CorrelationIdManager.set(requestId, correlationId);
    CorrelationIdManager.delete(requestId);
    expect(CorrelationIdManager.get(requestId)).toBeUndefined();
  });

  it('should clear all correlation IDs', () => {
    CorrelationIdManager.set('req-1', 'corr-1');
    CorrelationIdManager.set('req-2', 'corr-2');
    CorrelationIdManager.clear();
    expect(CorrelationIdManager.get('req-1')).toBeUndefined();
    expect(CorrelationIdManager.get('req-2')).toBeUndefined();
  });
});

describe('EnhancedLogger', () => {
  let enhancedLogger: EnhancedLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    enhancedLogger = new EnhancedLogger(mockPinoLogger as any);
  });

  it('should log debug messages with correlation ID', () => {
    const correlationId = 'test-corr-id';
    enhancedLogger.debug({ data: 'value' }, 'debug message', correlationId);
    expect(mockPinoLogger.debug).toHaveBeenCalledWith({ data: 'value', correlationId }, 'debug message');
  });

  it('should log info messages with correlation ID', () => {
    const correlationId = 'test-corr-id';
    enhancedLogger.info({ data: 'value' }, 'info message', correlationId);
    expect(mockPinoLogger.info).toHaveBeenCalledWith({ data: 'value', correlationId }, 'info message');
  });

  it('should log warn messages with correlation ID', () => {
    const correlationId = 'test-corr-id';
    enhancedLogger.warn({ data: 'value' }, 'warn message', correlationId);
    expect(mockPinoLogger.warn).toHaveBeenCalledWith({ data: 'value', correlationId }, 'warn message');
  });

  it('should log error messages with correlation ID', () => {
    const correlationId = 'test-corr-id';
    enhancedLogger.error({ data: 'value' }, 'error message', correlationId);
    expect(mockPinoLogger.error).toHaveBeenCalledWith({ data: 'value', correlationId }, 'error message');
  });

  it('should log fatal messages with correlation ID', () => {
    const correlationId = 'test-corr-id';
    enhancedLogger.fatal({ data: 'value' }, 'fatal message', correlationId);
    expect(mockPinoLogger.fatal).toHaveBeenCalledWith({ data: 'value', correlationId }, 'fatal message');
  });

  it('should log trace messages with correlation ID', () => {
    const correlationId = 'test-corr-id';
    enhancedLogger.trace({ data: 'value' }, 'trace message', correlationId);
    expect(mockPinoLogger.trace).toHaveBeenCalledWith({ data: 'value', correlationId }, 'trace message');
  });

  it('should not add correlation ID if not provided', () => {
    enhancedLogger.info({ data: 'value' }, 'info message');
    expect(mockPinoLogger.info).toHaveBeenCalledWith({ data: 'value' }, 'info message');
  });

  it('should create a child logger', () => {
    const childLogger = enhancedLogger.child({ module: 'test' });
    expect(mockPinoLogger.child).toHaveBeenCalledWith({ module: 'test' });
    expect(childLogger).toBeInstanceOf(EnhancedLogger);
  });
});

describe('RequestLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log successful HTTP request', () => {
    RequestLogger.logRequest('GET', '/test', 200, 100, 'corr-id', 'user-id', 'UA', '127.0.0.1');
    expect(mockPinoLogger.info).toHaveBeenCalledWith(expect.objectContaining({
      req: { method: 'GET', url: '/test', userAgent: 'UA', ip: '127.0.0.1' },
      res: { statusCode: 200, responseTime: 100 },
      userId: 'user-id',
      correlationId: 'corr-id',
    }), 'HTTP request completed successfully');
  });

  it('should log client error HTTP request', () => {
    RequestLogger.logRequest('POST', '/data', 400, 50, 'corr-id');
    expect(mockPinoLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
      res: { statusCode: 400, responseTime: 50 },
    }), 'HTTP request completed with client error');
  });

  it('should log server error HTTP request', () => {
    RequestLogger.logRequest('PUT', '/resource', 500, 200, 'corr-id');
    expect(mockPinoLogger.error).toHaveBeenCalledWith(expect.objectContaining({
      res: { statusCode: 500, responseTime: 200 },
    }), 'HTTP request completed with server error');
  });

  it('should log HTTP request error', () => {
    const error = new Error('Test Error');
    RequestLogger.logError(error, 'GET', '/fail', 'corr-id', 'user-id');
    expect(mockPinoLogger.error).toHaveBeenCalledWith(expect.objectContaining({
      error: { name: 'Error', message: 'Test Error', stack: expect.any(String) },
      req: { method: 'GET', url: '/fail' },
      userId: 'user-id',
      correlationId: 'corr-id',
    }), 'HTTP request failed with error');
  });
});

describe('DatabaseLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log database query', () => {
    DatabaseLogger.logQuery('SELECT * FROM users', [], 10, 'corr-id');
    expect(mockPinoLogger.debug).toHaveBeenCalledWith(expect.objectContaining({
      database: { query: 'SELECT * FROM users', paramCount: 0, duration: 10 },
      correlationId: 'corr-id',
    }), 'Database query executed');
  });

  it('should log database error', () => {
    const error = new Error('DB Error');
    DatabaseLogger.logError(error, 'INSERT INTO users', ['value'], 'corr-id');
    expect(mockPinoLogger.error).toHaveBeenCalledWith(expect.objectContaining({
      error: { name: 'Error', message: 'DB Error' },
      database: { query: 'INSERT INTO users', paramCount: 1 },
      correlationId: 'corr-id',
    }), 'Database query failed');
  });
});

describe('ExternalApiLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log successful external API request', () => {
    ExternalApiLogger.logRequest('OpenAI', 'POST', '/chat', 200, 500, 'corr-id');
    expect(mockPinoLogger.info).toHaveBeenCalledWith(expect.objectContaining({
      externalApi: { service: 'OpenAI', method: 'POST', url: '/chat', statusCode: 200, duration: 500 },
      correlationId: 'corr-id',
    }), 'External API request completed successfully');
  });

  it('should log external API client error', () => {
    ExternalApiLogger.logRequest('GitHub', 'GET', '/repos', 404, 100, 'corr-id');
    expect(mockPinoLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
      externalApi: { service: 'GitHub', method: 'GET', url: '/repos', statusCode: 404, duration: 100 },
    }), 'External API request failed with client error');
  });

  it('should log external API server error', () => {
    ExternalApiLogger.logRequest('Jira', 'POST', '/issues', 500, 300, 'corr-id');
    expect(mockPinoLogger.error).toHaveBeenCalledWith(expect.objectContaining({
      externalApi: { service: 'Jira', method: 'POST', url: '/issues', statusCode: 500, duration: 300 },
    }), 'External API request failed with server error');
  });

  it('should log external API error', () => {
    const error = new Error('API Timeout');
    ExternalApiLogger.logError(error, 'OpenAI', 'POST', '/embeddings', 'corr-id');
    expect(mockPinoLogger.error).toHaveBeenCalledWith(expect.objectContaining({
      error: { name: 'Error', message: 'API Timeout' },
      externalApi: { service: 'OpenAI', method: 'POST', url: '/embeddings' },
      correlationId: 'corr-id',
    }), 'External API request failed with error');
  });
});

describe('AgentLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log agent execution', () => {
    AgentLogger.logExecution('query-1', 'Code Explanation', 'RAG Pipeline', 1500, 3, 'corr-id');
    expect(mockPinoLogger.info).toHaveBeenCalledWith(expect.objectContaining({
      agent: { queryId: 'query-1', intent: 'Code Explanation', pipeline: 'RAG Pipeline', duration: 1500, toolCallCount: 3 },
      correlationId: 'corr-id',
    }), 'Agent execution completed');
  });

  it('should log successful tool call', () => {
    AgentLogger.logToolCall('query-1', 'VectorSearchTool', 200, true, 'corr-id');
    expect(mockPinoLogger.debug).toHaveBeenCalledWith(expect.objectContaining({
      agent: { queryId: 'query-1', toolName: 'VectorSearchTool', duration: 200, success: true },
      correlationId: 'corr-id',
    }), 'Agent tool call completed successfully');
  });

  it('should log failed tool call', () => {
    AgentLogger.logToolCall('query-1', 'GitConnectorTool', 500, false, 'corr-id');
    expect(mockPinoLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
      agent: { queryId: 'query-1', toolName: 'GitConnectorTool', duration: 500, success: false },
      correlationId: 'corr-id',
    }), 'Agent tool call failed');
  });

  it('should log agent error', () => {
    const error = new Error('Agent Crash');
    AgentLogger.logError(error, 'query-1', { step: 'tool_execution' }, 'corr-id');
    expect(mockPinoLogger.error).toHaveBeenCalledWith(expect.objectContaining({
      error: { name: 'Error', message: 'Agent Crash', stack: expect.any(String) },
      agent: { queryId: 'query-1', context: { step: 'tool_execution' } },
      correlationId: 'corr-id',
    }), 'Agent execution failed with error');
  });
});


