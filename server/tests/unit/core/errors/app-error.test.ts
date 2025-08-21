import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
  ValidationError,
  InvalidInputError,
  NotFoundError,
  ConflictError,
  DuplicateResourceError,
  RateLimitError,
  ExternalServiceError,
  ExternalServiceUnavailableError,
  DatabaseError,
  DatabaseConnectionError,
  AgentError,
  AgentTimeoutError,
  ToolExecutionError,
  FileUploadError,
  FileSizeError,
  FileTypeError,
  ConfigurationError,
  InternalServerError,
  ServiceUnavailableError,
  ErrorFactory,
  isAppError,
  isOperationalError,
  isAuthenticationError,
  isValidationError,
  isNotFoundError,
  isRateLimitError,
} from '@/core/errors/app-error.js';

describe('AppError', () => {
  it('should create a base AppError instance', () => {
    class CustomError extends AppError {
      constructor(message: string, details?: any, correlationId?: string) {
        super(message, 400, 'CUSTOM_ERROR', true, details, correlationId);
      }
    }
    const error = new CustomError('Test error', { key: 'value' }, 'corr-123');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CustomError');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('CUSTOM_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.details).toEqual({ key: 'value' });
    expect(error.correlationId).toBe('corr-123');
    expect(error.stack).toBeDefined();
  });

  it('should return correct JSON representation', () => {
    class CustomError extends AppError {
      constructor(message: string, details?: any, correlationId?: string) {
        super(message, 400, 'CUSTOM_ERROR', true, details, correlationId);
      }
    }
    const error = new CustomError('Test error', { key: 'value' }, 'corr-123');
    const json = error.toJSON();

    expect(json.name).toBe('CustomError');
    expect(json.message).toBe('Test error');
    expect(json.statusCode).toBe(400);
    expect(json.errorCode).toBe('CUSTOM_ERROR');
    expect(json.details).toEqual({ key: 'value' });
    expect(json.correlationId).toBe('corr-123');
    expect(json.stack).toBeDefined();
  });
});

describe('Specific Error Classes', () => {
  it('AuthenticationError should have correct properties', () => {
    const error = new AuthenticationError('Auth failed', { reason: 'invalid' }, 'corr-1');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('AUTH_FAILED');
    expect(error.message).toBe('Auth failed');
    expect(error.details).toEqual({ reason: 'invalid' });
    expect(error.correlationId).toBe('corr-1');
  });

  it('ValidationError should have correct properties', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('NotFoundError should have correct properties', () => {
    const error = new NotFoundError('User not found');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('RESOURCE_NOT_FOUND');
    expect(error.message).toBe('User not found');
  });

  it('ConflictError should have correct properties', () => {
    const error = new ConflictError('Duplicate entry');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe('RESOURCE_CONFLICT');
    expect(error.message).toBe('Duplicate entry');
  });

  it('RateLimitError should have correct properties', () => {
    const error = new RateLimitError('Too many requests');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(429);
    expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.message).toBe('Too many requests');
  });

  it('InternalServerError should have correct properties', () => {
    const error = new InternalServerError('Something went wrong');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('INTERNAL_SERVER_ERROR');
    expect(error.message).toBe('Something went wrong');
    expect(error.isOperational).toBe(false); // Internal errors are not operational by default
  });

  // Test all other error types for basic instantiation and properties
  it('AuthorizationError should have correct properties', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.errorCode).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
  });

  it('TokenExpiredError should have correct properties', () => {
    const error = new TokenExpiredError();
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('InvalidTokenError should have correct properties', () => {
    const error = new InvalidTokenError();
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('AUTH_INVALID_TOKEN');
  });

  it('InvalidInputError should have correct properties', () => {
    const error = new InvalidInputError();
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('INVALID_INPUT');
  });

  it('DuplicateResourceError should have correct properties', () => {
    const error = new DuplicateResourceError();
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe('RESOURCE_DUPLICATE');
  });

  it('ExternalServiceError should have correct properties', () => {
    const error = new ExternalServiceError();
    expect(error.statusCode).toBe(502);
    expect(error.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
  });

  it('ExternalServiceUnavailableError should have correct properties', () => {
    const error = new ExternalServiceUnavailableError();
    expect(error.statusCode).toBe(503);
    expect(error.errorCode).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('DatabaseError should have correct properties', () => {
    const error = new DatabaseError();
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('DATABASE_ERROR');
  });

  it('DatabaseConnectionError should have correct properties', () => {
    const error = new DatabaseConnectionError();
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('DATABASE_CONNECTION_ERROR');
  });

  it('AgentError should have correct properties', () => {
    const error = new AgentError();
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('AGENT_ERROR');
  });

  it('AgentTimeoutError should have correct properties', () => {
    const error = new AgentTimeoutError();
    expect(error.statusCode).toBe(408);
    expect(error.errorCode).toBe('AGENT_TIMEOUT');
  });

  it('ToolExecutionError should have correct properties', () => {
    const error = new ToolExecutionError();
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('TOOL_EXECUTION_ERROR');
  });

  it('FileUploadError should have correct properties', () => {
    const error = new FileUploadError();
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('FILE_UPLOAD_ERROR');
  });

  it('FileSizeError should have correct properties', () => {
    const error = new FileSizeError();
    expect(error.statusCode).toBe(413);
    expect(error.errorCode).toBe('FILE_SIZE_EXCEEDED');
  });

  it('FileTypeError should have correct properties', () => {
    const error = new FileTypeError();
    expect(error.statusCode).toBe(415);
    expect(error.errorCode).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('ConfigurationError should have correct properties', () => {
    const error = new ConfigurationError();
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('CONFIGURATION_ERROR');
    expect(error.isOperational).toBe(false);
  });

  it('ServiceUnavailableError should have correct properties', () => {
    const error = new ServiceUnavailableError();
    expect(error.statusCode).toBe(503);
    expect(error.errorCode).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('ErrorFactory', () => {
  it('should create AuthenticationError', () => {
    const error = ErrorFactory.authentication('Test auth', { id: 1 });
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Test auth');
    expect(error.details).toEqual({ id: 1 });
  });

  it('should create ValidationError', () => {
    const error = ErrorFactory.validation('Test validation');
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Test validation');
  });

  it('should create NotFoundError', () => {
    const error = ErrorFactory.notFound();
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Resource not found');
  });

  it('should create ConflictError', () => {
    const error = ErrorFactory.conflict();
    expect(error).toBeInstanceOf(ConflictError);
  });

  it('should create RateLimitError', () => {
    const error = ErrorFactory.rateLimit();
    expect(error).toBeInstanceOf(RateLimitError);
  });

  it('should create ExternalServiceError', () => {
    const error = ErrorFactory.externalService();
    expect(error).toBeInstanceOf(ExternalServiceError);
  });

  it('should create DatabaseError', () => {
    const error = ErrorFactory.database();
    expect(error).toBeInstanceOf(DatabaseError);
  });

  it('should create AgentError', () => {
    const error = ErrorFactory.agent();
    expect(error).toBeInstanceOf(AgentError);
  });

  it('should create InternalServerError', () => {
    const error = ErrorFactory.internalServer();
    expect(error).toBeInstanceOf(InternalServerError);
  });

  it('should create generic error with createError', () => {
    const error = ErrorFactory.createError(AuthenticationError, 'Generic auth error');
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Generic auth error');
  });
});

describe('Error Type Guards', () => {
  it('isAppError should correctly identify AppError instances', () => {
    class CustomError extends AppError {
      constructor(message: string) { super(message, 400, 'CUSTOM'); }
    }
    expect(isAppError(new CustomError('test'))).toBe(true);
    expect(isAppError(new Error('test'))).toBe(false);
    expect(isAppError({})).toBe(false);
  });

  it('isOperationalError should correctly identify operational errors', () => {
    class OperationalCustomError extends AppError {
      constructor(message: string) { super(message, 400, 'OPERATIONAL', true); }
    }
    class NonOperationalCustomError extends AppError {
      constructor(message: string) { super(message, 500, 'NON_OPERATIONAL', false); }
    }
    expect(isOperationalError(new OperationalCustomError('test'))).toBe(true);
    expect(isOperationalError(new NonOperationalCustomError('test'))).toBe(false);
    expect(isOperationalError(new Error('test'))).toBe(false);
  });

  it('isAuthenticationError should correctly identify AuthenticationError instances', () => {
    expect(isAuthenticationError(new AuthenticationError())).toBe(true);
    expect(isAuthenticationError(new ValidationError())).toBe(false);
  });

  it('isValidationError should correctly identify ValidationError instances', () => {
    expect(isValidationError(new ValidationError())).toBe(true);
    expect(isValidationError(new AuthenticationError())).toBe(false);
  });

  it('isNotFoundError should correctly identify NotFoundError instances', () => {
    expect(isNotFoundError(new NotFoundError())).toBe(true);
    expect(isNotFoundError(new ValidationError())).toBe(false);
  });

  it('isRateLimitError should correctly identify RateLimitError instances', () => {
    expect(isRateLimitError(new RateLimitError())).toBe(true);
    expect(isRateLimitError(new AuthenticationError())).toBe(false);
  });
});


