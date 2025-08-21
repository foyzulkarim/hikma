import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RequestLoggingMiddleware, RequestContext } from '@/modules/interfaces/api/middleware/logging.js';
import { logger, RequestLogger, CorrelationIdManager } from '@/core/utils/logger.js';
import { config } from '@/config/app.js';

// Mock external dependencies
vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  RequestLogger: {
    logRequest: vi.fn(),
  },
  CorrelationIdManager: {
    generate: vi.fn(() => 'mock-correlation-id'),
  },
}));

vi.mock('@/config/app.js', () => ({
  config: {
    server: {
      environment: 'development',
    },
  },
}));

describe('RequestLoggingMiddleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let loggingMiddleware: RequestLoggingMiddleware;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
      id: 'req-123',
      url: '/test-path',
      method: 'GET',
      ip: '127.0.0.1',
      user: { id: 'user123' } as any,
      getHeaders: vi.fn(() => ({ 'content-type': 'application/json' })),
    };
    mockReply = {
      header: vi.fn().mockReturnThis(),
      statusCode: 200,
      getHeaders: vi.fn(() => ({ 'x-correlation-id': 'mock-correlation-id' })),
      raw: { on: vi.fn() } as any,
    };
    loggingMiddleware = new RequestLoggingMiddleware();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('preHandler', () => {
    it('should set correlationId and loggingContext on request', async () => {
      await loggingMiddleware.preHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.correlationId).toBe('mock-correlation-id');
      expect(mockReply.header).toHaveBeenCalledWith('X-Correlation-ID', 'mock-correlation-id');
      expect((mockRequest as any).loggingContext).toBeDefined();
      expect(((mockRequest as any).loggingContext as RequestContext).correlationId).toBe('mock-correlation-id');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should extract correlationId from headers if present', async () => {
      mockRequest.headers['x-correlation-id'] = 'existing-cid';
      await loggingMiddleware.preHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.correlationId).toBe('existing-cid');
      expect(mockReply.header).toHaveBeenCalledWith('X-Correlation-ID', 'existing-cid');
    });

    it('should not log for excluded paths', async () => {
      loggingMiddleware = new RequestLoggingMiddleware({ excludePaths: ['/health'] });
      mockRequest.url = '/health';

      await loggingMiddleware.preHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logger.info).not.toHaveBeenCalled();
      expect((mockRequest as any).loggingContext).toBeUndefined();
    });

    it('should log request body if configured', async () => {
      loggingMiddleware = new RequestLoggingMiddleware({ logBody: true });
      mockRequest.body = { key: 'value' };

      await loggingMiddleware.preHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
        request: expect.objectContaining({
          body: { key: 'value' },
        }),
      }), 'Incoming request');
    });

    it('should truncate request body if too long', async () => {
      loggingMiddleware = new RequestLoggingMiddleware({ logBody: true, maxBodyLength: 10 });
      mockRequest.body = 'this is a very long body that should be truncated';

      await loggingMiddleware.preHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
        request: expect.objectContaining({
          body: 'this is a ... [TRUNCATED]',
        }),
      }), 'Incoming request');
    });

    it('should filter sensitive headers', async () => {
      loggingMiddleware = new RequestLoggingMiddleware({ logHeaders: true });
      mockRequest.headers = { authorization: 'Bearer token', 'x-api-key': 'secret', 'user-agent': 'test-agent' };

      await loggingMiddleware.preHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
        request: expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '[REDACTED]',
            'x-api-key': '[REDACTED]',
            'user-agent': 'test-agent',
          }),
        }),
      }), 'Incoming request');
    });
  });

  describe('onResponse', () => {
    it('should log outgoing response and request metrics', async () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      (mockRequest as any).loggingContext = {
        correlationId: 'mock-correlation-id',
        startTime: startTime - 100, // Simulate 100ms response time
        method: 'GET',
        url: '/test-path',
        userId: 'user123',
      };

      await loggingMiddleware.onResponse(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
        type: 'request_outgoing',
        response: expect.objectContaining({
          statusCode: 200,
          responseTime: 100,
        }),
      }), 'Outgoing response');
      expect(RequestLogger.logRequest).toHaveBeenCalledWith(
        'GET',
        '/test-path',
        200,
        100,
        'mock-correlation-id',
        'user123',
        undefined,
        undefined,
      );
    });

    it('should log slow requests if configured', async () => {
      loggingMiddleware = new RequestLoggingMiddleware({ logSlowRequests: true, slowRequestThreshold: 50 });
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      (mockRequest as any).loggingContext = {
        correlationId: 'mock-correlation-id',
        startTime: startTime - 100, // Simulate 100ms response time
        method: 'GET',
        url: '/test-path',
        userId: 'user123',
      };

      await loggingMiddleware.onResponse(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
        type: 'slow_request',
        performance: expect.objectContaining({
          responseTime: 100,
          threshold: 50,
        }),
      }), 'Slow request detected');
    });

    it('should use correct log level based on status code', async () => {
      (mockRequest as any).loggingContext = {
        correlationId: 'mock-correlation-id',
        startTime: Date.now() - 100,
        method: 'GET',
        url: '/test-path',
      };

      mockReply.statusCode = 500;
      await loggingMiddleware.onResponse(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(logger.error).toHaveBeenCalled();

      mockReply.statusCode = 400;
      await loggingMiddleware.onResponse(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(logger.warn).toHaveBeenCalled();

      mockReply.statusCode = 300;
      await loggingMiddleware.onResponse(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(logger.info).toHaveBeenCalled();

      mockReply.statusCode = 200;
      await loggingMiddleware.onResponse(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(logger.info).toHaveBeenCalled();
    });
  });
});


