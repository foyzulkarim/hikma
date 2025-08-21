// Base application error class
export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;
  public readonly details?: any;
  public readonly correlationId?: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational = true,
    details?: any,
    correlationId?: string
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.details = details;
    this.correlationId = correlationId;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      correlationId: this.correlationId,
      stack: this.stack,
    };
  }
}

// Authentication errors
export class AuthenticationError extends AppError {
  constructor(
    message = 'Authentication failed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 401, 'AUTH_FAILED', true, details, correlationId);
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message = 'Insufficient permissions',
    details?: any,
    correlationId?: string
  ) {
    super(message, 403, 'AUTH_INSUFFICIENT_PERMISSIONS', true, details, correlationId);
  }
}

export class TokenExpiredError extends AppError {
  constructor(
    message = 'Token has expired',
    details?: any,
    correlationId?: string
  ) {
    super(message, 401, 'AUTH_TOKEN_EXPIRED', true, details, correlationId);
  }
}

export class InvalidTokenError extends AppError {
  constructor(
    message = 'Invalid token provided',
    details?: any,
    correlationId?: string
  ) {
    super(message, 401, 'AUTH_INVALID_TOKEN', true, details, correlationId);
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 400, 'VALIDATION_FAILED', true, details, correlationId);
  }
}

export class InvalidInputError extends AppError {
  constructor(
    message = 'Invalid input provided',
    details?: any,
    correlationId?: string
  ) {
    super(message, 400, 'INVALID_INPUT', true, details, correlationId);
  }
}

// Resource errors
export class NotFoundError extends AppError {
  constructor(
    message = 'Resource not found',
    details?: any,
    correlationId?: string
  ) {
    super(message, 404, 'RESOURCE_NOT_FOUND', true, details, correlationId);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'Resource conflict',
    details?: any,
    correlationId?: string
  ) {
    super(message, 409, 'RESOURCE_CONFLICT', true, details, correlationId);
  }
}

export class DuplicateResourceError extends AppError {
  constructor(
    message = 'Resource already exists',
    details?: any,
    correlationId?: string
  ) {
    super(message, 409, 'RESOURCE_DUPLICATE', true, details, correlationId);
  }
}

// Rate limiting errors
export class RateLimitError extends AppError {
  constructor(
    message = 'Rate limit exceeded',
    details?: any,
    correlationId?: string
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, details, correlationId);
  }
}

// External service errors
export class ExternalServiceError extends AppError {
  constructor(
    message = 'External service error',
    details?: any,
    correlationId?: string
  ) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', true, details, correlationId);
  }
}

export class ExternalServiceUnavailableError extends AppError {
  constructor(
    message = 'External service unavailable',
    details?: any,
    correlationId?: string
  ) {
    super(message, 503, 'EXTERNAL_SERVICE_UNAVAILABLE', true, details, correlationId);
  }
}

// Database errors
export class DatabaseError extends AppError {
  constructor(
    message = 'Database operation failed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 500, 'DATABASE_ERROR', true, details, correlationId);
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(
    message = 'Database connection failed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 500, 'DATABASE_CONNECTION_ERROR', true, details, correlationId);
  }
}

// Agent errors
export class AgentError extends AppError {
  constructor(
    message = 'Agent execution failed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 500, 'AGENT_ERROR', true, details, correlationId);
  }
}

export class AgentTimeoutError extends AppError {
  constructor(
    message = 'Agent execution timed out',
    details?: any,
    correlationId?: string
  ) {
    super(message, 408, 'AGENT_TIMEOUT', true, details, correlationId);
  }
}

export class ToolExecutionError extends AppError {
  constructor(
    message = 'Tool execution failed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 500, 'TOOL_EXECUTION_ERROR', true, details, correlationId);
  }
}

// File upload errors
export class FileUploadError extends AppError {
  constructor(
    message = 'File upload failed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 400, 'FILE_UPLOAD_ERROR', true, details, correlationId);
  }
}

export class FileSizeError extends AppError {
  constructor(
    message = 'File size exceeds limit',
    details?: any,
    correlationId?: string
  ) {
    super(message, 413, 'FILE_SIZE_EXCEEDED', true, details, correlationId);
  }
}

export class FileTypeError extends AppError {
  constructor(
    message = 'File type not allowed',
    details?: any,
    correlationId?: string
  ) {
    super(message, 415, 'FILE_TYPE_NOT_ALLOWED', true, details, correlationId);
  }
}

// Configuration errors
export class ConfigurationError extends AppError {
  constructor(
    message = 'Configuration error',
    details?: any,
    correlationId?: string
  ) {
    super(message, 500, 'CONFIGURATION_ERROR', false, details, correlationId);
  }
}

// Generic server errors
export class InternalServerError extends AppError {
  constructor(
    message = 'Internal server error',
    details?: any,
    correlationId?: string
  ) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false, details, correlationId);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = 'Service temporarily unavailable',
    details?: any,
    correlationId?: string
  ) {
    super(message, 503, 'SERVICE_UNAVAILABLE', true, details, correlationId);
  }
}

// Error factory for creating errors with correlation ID
export class ErrorFactory {
  static createError(
    ErrorClass: new (...args: any[]) => AppError,
    message?: string,
    details?: any,
    correlationId?: string
  ): AppError {
    return new ErrorClass(message, details, correlationId);
  }

  static authentication(
    message?: string,
    details?: any,
    correlationId?: string
  ): AuthenticationError {
    return new AuthenticationError(message, details, correlationId);
  }

  static authorization(
    message?: string,
    details?: any,
    correlationId?: string
  ): AuthorizationError {
    return new AuthorizationError(message, details, correlationId);
  }

  static validation(
    message?: string,
    details?: any,
    correlationId?: string
  ): ValidationError {
    return new ValidationError(message, details, correlationId);
  }

  static notFound(
    message?: string,
    details?: any,
    correlationId?: string
  ): NotFoundError {
    return new NotFoundError(message, details, correlationId);
  }

  static conflict(
    message?: string,
    details?: any,
    correlationId?: string
  ): ConflictError {
    return new ConflictError(message, details, correlationId);
  }

  static rateLimit(
    message?: string,
    details?: any,
    correlationId?: string
  ): RateLimitError {
    return new RateLimitError(message, details, correlationId);
  }

  static externalService(
    message?: string,
    details?: any,
    correlationId?: string
  ): ExternalServiceError {
    return new ExternalServiceError(message, details, correlationId);
  }

  static database(
    message?: string,
    details?: any,
    correlationId?: string
  ): DatabaseError {
    return new DatabaseError(message, details, correlationId);
  }

  static agent(
    message?: string,
    details?: any,
    correlationId?: string
  ): AgentError {
    return new AgentError(message, details, correlationId);
  }

  static internalServer(
    message?: string,
    details?: any,
    correlationId?: string
  ): InternalServerError {
    return new InternalServerError(message, details, correlationId);
  }
}

// Error type guards
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

export const isOperationalError = (error: any): boolean => {
  return isAppError(error) && error.isOperational;
};

export const isAuthenticationError = (error: any): error is AuthenticationError => {
  return error instanceof AuthenticationError;
};

export const isValidationError = (error: any): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isNotFoundError = (error: any): error is NotFoundError => {
  return error instanceof NotFoundError;
};

export const isRateLimitError = (error: any): error is RateLimitError => {
  return error instanceof RateLimitError;
};

