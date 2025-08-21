import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { 
  AppError, 
  isAppError, 
  isOperationalError,
  ValidationError,
  DatabaseError,
  InternalServerError,
} from '@/core/errors/app-error.js';
import { logger, RequestLogger } from '@/core/utils/logger.js';
import { config } from '@/config/app.js';

// Error response interface
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    correlationId?: string;
    details?: any;
    stack?: string;
  };
  timestamp: string;
  path: string;
  method: string;
}

// Error handler class
export class ErrorHandler {
  static handle(error: Error | FastifyError, request: FastifyRequest, reply: FastifyReply): void {
    const correlationId = request.correlationId;
    const isDevelopment = config.server.environment === 'development';
    
    let appError: AppError;

    // Convert different error types to AppError
    if (isAppError(error)) {
      appError = error;
    } else if (error instanceof ZodError) {
      appError = this.handleZodError(error, correlationId);
    } else if (error instanceof PrismaClientKnownRequestError) {
      appError = this.handlePrismaError(error, correlationId);
    } else if (error instanceof PrismaClientValidationError) {
      appError = this.handlePrismaValidationError(error, correlationId);
    } else if (this.isFastifyError(error)) {
      appError = this.handleFastifyError(error, correlationId);
    } else {
      appError = this.handleGenericError(error, correlationId);
    }

    // Log the error
    this.logError(appError, request);

    // Create error response
    const errorResponse: ErrorResponse = {
      error: {
        message: appError.message,
        code: appError.errorCode,
        statusCode: appError.statusCode,
        correlationId,
        details: isDevelopment ? appError.details : undefined,
        stack: isDevelopment ? appError.stack : undefined,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Send error response
    reply
      .status(appError.statusCode)
      .type('application/json')
      .send(errorResponse);
  }

  private static handleZodError(error: ZodError, correlationId?: string): ValidationError {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: err.received,
    }));

    return new ValidationError(
      'Request validation failed',
      { errors: validationErrors },
      correlationId
    );
  }

  private static handlePrismaError(error: PrismaClientKnownRequestError, correlationId?: string): AppError {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = error.meta?.target as string[] | undefined;
        return new ValidationError(
          'Duplicate entry found',
          { 
            field: target?.join(', '),
            prismaCode: error.code,
            prismaMessage: error.message,
          },
          correlationId
        );

      case 'P2025':
        // Record not found
        return new ValidationError(
          'Record not found',
          { 
            prismaCode: error.code,
            prismaMessage: error.message,
          },
          correlationId
        );

      case 'P2003':
        // Foreign key constraint violation
        return new ValidationError(
          'Invalid reference to related record',
          { 
            field: error.meta?.field_name,
            prismaCode: error.code,
            prismaMessage: error.message,
          },
          correlationId
        );

      case 'P2014':
        // Required relation violation
        return new ValidationError(
          'Required relation missing',
          { 
            relation: error.meta?.relation_name,
            prismaCode: error.code,
            prismaMessage: error.message,
          },
          correlationId
        );

      default:
        return new DatabaseError(
          'Database operation failed',
          { 
            prismaCode: error.code,
            prismaMessage: error.message,
          },
          correlationId
        );
    }
  }

  private static handlePrismaValidationError(error: PrismaClientValidationError, correlationId?: string): ValidationError {
    return new ValidationError(
      'Database validation failed',
      { 
        prismaMessage: error.message,
      },
      correlationId
    );
  }

  private static isFastifyError(error: any): error is FastifyError {
    return error && typeof error.statusCode === 'number' && typeof error.code === 'string';
  }

  private static handleFastifyError(error: FastifyError, correlationId?: string): AppError {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Request processing failed';

    // Handle specific Fastify error codes
    switch (error.code) {
      case 'FST_ERR_VALIDATION':
        return new ValidationError(message, { fastifyCode: error.code }, correlationId);
      
      case 'FST_ERR_NOT_FOUND':
        return new ValidationError('Route not found', { fastifyCode: error.code }, correlationId);
      
      case 'FST_ERR_BAD_STATUS_CODE':
        return new InternalServerError('Invalid response status', { fastifyCode: error.code }, correlationId);
      
      case 'FST_ERR_ASYNC_CONSTRAINT':
        return new InternalServerError('Async constraint violation', { fastifyCode: error.code }, correlationId);
      
      default:
        if (statusCode >= 400 && statusCode < 500) {
          return new ValidationError(message, { fastifyCode: error.code }, correlationId);
        } else {
          return new InternalServerError(message, { fastifyCode: error.code }, correlationId);
        }
    }
  }

  private static handleGenericError(error: Error, correlationId?: string): InternalServerError {
    return new InternalServerError(
      'An unexpected error occurred',
      { 
        originalMessage: error.message,
        originalName: error.name,
      },
      correlationId
    );
  }

  private static logError(error: AppError, request: FastifyRequest): void {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        stack: error.stack,
        details: error.details,
      },
      request: {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: request.user?.id,
      },
      correlationId: error.correlationId,
    };

    if (error.statusCode >= 500) {
      logger.error(logData, 'Server error occurred');
    } else if (error.statusCode >= 400) {
      logger.warn(logData, 'Client error occurred');
    } else {
      logger.info(logData, 'Request completed with error');
    }

    // Log to request logger as well
    RequestLogger.logError(
      error,
      request.method,
      request.url,
      error.correlationId,
      request.user?.id
    );
  }
}

// Global error handler middleware
export const globalErrorHandler = (
  error: Error | FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void => {
  ErrorHandler.handle(error, request, reply);
};

// Async error wrapper for route handlers
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw error; // Let the global error handler catch it
    }
  };
}

// Not found handler
export const notFoundHandler = (request: FastifyRequest, reply: FastifyReply): void => {
  const correlationId = request.correlationId;
  
  const errorResponse: ErrorResponse = {
    error: {
      message: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
      statusCode: 404,
      correlationId,
    },
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method,
  };

  logger.warn({
    request: {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    },
    correlationId,
  }, 'Route not found');

  reply
    .status(404)
    .type('application/json')
    .send(errorResponse);
};

// Unhandled rejection handler
export const setupUnhandledRejectionHandler = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.fatal({
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack,
      } : reason,
      promise: promise.toString(),
    }, 'Unhandled promise rejection');

    // In production, you might want to gracefully shutdown
    if (config.server.environment === 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }, 'Uncaught exception');

    // Always exit on uncaught exceptions
    process.exit(1);
  });
};

// Error monitoring and alerting
export class ErrorMonitor {
  private static errorCounts = new Map<string, number>();
  private static readonly ERROR_THRESHOLD = 10;
  private static readonly TIME_WINDOW = 60000; // 1 minute

  static trackError(error: AppError): void {
    const key = `${error.errorCode}_${Math.floor(Date.now() / this.TIME_WINDOW)}`;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);

    // Check if error threshold is exceeded
    if (count + 1 >= this.ERROR_THRESHOLD) {
      this.alertHighErrorRate(error.errorCode, count + 1);
    }

    // Clean up old entries
    this.cleanupOldEntries();
  }

  private static alertHighErrorRate(errorCode: string, count: number): void {
    logger.error({
      errorCode,
      count,
      threshold: this.ERROR_THRESHOLD,
      timeWindow: this.TIME_WINDOW,
    }, 'High error rate detected');

    // Here you could integrate with alerting systems like:
    // - Slack notifications
    // - Email alerts
    // - PagerDuty
    // - Custom webhook
  }

  private static cleanupOldEntries(): void {
    const currentWindow = Math.floor(Date.now() / this.TIME_WINDOW);
    
    for (const [key] of this.errorCounts) {
      const keyWindow = parseInt(key.split('_').pop() || '0');
      if (keyWindow < currentWindow - 5) { // Keep last 5 windows
        this.errorCounts.delete(key);
      }
    }
  }

  static getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const [key, count] of this.errorCounts) {
      const errorCode = key.split('_').slice(0, -1).join('_');
      stats[errorCode] = (stats[errorCode] || 0) + count;
    }
    
    return stats;
  }
}

export { ErrorHandler, ErrorMonitor };

