import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { ErrorHandler, globalErrorHandler, asyncHandler, notFoundHandler, setupUnhandledRejectionHandler, ErrorMonitor } from '@/modules/interfaces/api/middleware/error-handler.js';
import { AppError, AuthenticationError, AuthorizationError, ConflictError, DatabaseError, InternalServerError, InvalidTokenError, NotFoundError, TokenExpiredError, ValidationError } from '@/core/errors/app-error.js';
import { logger, RequestLogger } from '@/core/utils/logger.js';
import { config } from '@/config/app.js';

// Mock external dependencies
vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
  RequestLogger: {
    logError: vi.fn(),
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

describe('ErrorHandler', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      id: 'req-123',
      url: '/test-path',
      method: 'GET',
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      correlationId: 'mock-correlation-id',
      user: { id: 'user123' } as any,
    };
    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    vi.clearAllMocks();
    config.server.environment = 'development'; // Reset environment for each test
  });

  describe('handle', () => {
    it('should handle AppError correctly', () => {
      const error = new NotFoundError('Resource not found', { id: 'abc' }, 'custom-cid');
      ErrorHandler.handle(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: 'Resource not found',
          code: 'NOT_FOUND',
          statusCode: 404,
          correlationId: 'custom-cid',
          details: { id: 'abc' },
          stack: expect.any(String),
        }),
      }));
      expect(logger.warn).toHaveBeenCalled();
      expect(RequestLogger.logError).toHaveBeenCalled();
    });

    it('should handle ZodError correctly', () => {
      const error = new ZodError([{
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string, received number',
      }]);
      ErrorHandler.handle(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: 'Request validation failed',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          details: { errors: expect.any(Array) },
        }),
      }));
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle PrismaClientKnownRequestError (P2002) correctly', () => {
      const error = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      });
      ErrorHandler.handle(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: 'Duplicate entry found',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          details: { field: 'email', prismaCode: 'P2002', prismaMessage: expect.any(String) },
        }),
      }));
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle generic Error correctly', () => {
      const error = new Error('Something went wrong');
      ErrorHandler.handle(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: 'An unexpected error occurred',
          code: 'INTERNAL_SERVER_ERROR',
          statusCode: 500,
          details: { originalMessage: 'Something went wrong', originalName: 'Error' },
        }),
      }));
      expect(logger.error).toHaveBeenCalled();
    });

    it('should hide stack and details in production environment', () => {
      config.server.environment = 'production';
      const error = new InternalServerError('Internal error');
      ErrorHandler.handle(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          details: undefined,
          stack: undefined,
        }),
      }));
    });
  });

  describe('globalErrorHandler', () => {
    it('should call ErrorHandler.handle', () => {
      const spy = vi.spyOn(ErrorHandler, 'handle');
      const error = new Error('Test error');
      globalErrorHandler(error, mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(spy).toHaveBeenCalledWith(error, mockRequest, mockReply);
    });
  });

  describe('asyncHandler', () => {
    it('should execute the async function and return its result', async () => {
      const mockFn = vi.fn(async (a: number, b: number) => a + b);
      const wrappedFn = asyncHandler(mockFn);
      const result = await wrappedFn(1, 2);
      expect(mockFn).toHaveBeenCalledWith(1, 2);
      expect(result).toBe(3);
    });

    it('should re-throw errors from the async function', async () => {
      const mockFn = vi.fn(async () => { throw new Error('Async error'); });
      const wrappedFn = asyncHandler(mockFn);
      await expect(wrappedFn()).rejects.toThrow('Async error');
    });
  });

  describe('notFoundHandler', () => {
    it('should send a 404 response for route not found', () => {
      notFoundHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: 'Route not found',
          code: 'ROUTE_NOT_FOUND',
          statusCode: 404,
        }),
      }));
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('ErrorMonitor', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Reset internal state of ErrorMonitor
      (ErrorMonitor as any).errorCounts = new Map();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should track errors and log high error rate', () => {
      const error = new InternalServerError('Test error');
      for (let i = 0; i < 10; i++) {
        ErrorMonitor.trackError(error);
      }
      expect(logger.error).not.toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'INTERNAL_SERVER_ERROR' }), 'High error rate detected');
      ErrorMonitor.trackError(error); // 11th error
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'INTERNAL_SERVER_ERROR' }), 'High error rate detected');
    });

    it('should clean up old entries', () => {
      const error = new InternalServerError('Test error');
      ErrorMonitor.trackError(error); // Current window
      vi.advanceTimersByTime(60000 * 6); // Move 6 windows forward
      ErrorMonitor.trackError(error); // New window

      const stats = ErrorMonitor.getErrorStats();
      expect(stats).toEqual({ INTERNAL_SERVER_ERROR: 1 }); // Only new error should remain
    });

    it('should return correct error stats', () => {
      ErrorMonitor.trackError(new InternalServerError('Error 1'));
      ErrorMonitor.trackError(new InternalServerError('Error 1'));
      ErrorMonitor.trackError(new ValidationError('Error 2'));

      const stats = ErrorMonitor.getErrorStats();
      expect(stats).toEqual({
        INTERNAL_SERVER_ERROR: 2,
        VALIDATION_ERROR: 1,
      });
    });
  });
});


