import pino from 'pino';

// Logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
};

// Create logger instance
export const logger = pino(
  loggerConfig,
  process.env.NODE_ENV === 'development'
    ? pino.destination({ sync: false })
    : undefined
);

// Correlation ID management
export class CorrelationIdManager {
  private static correlationIds = new Map<string, string>();

  static generate(): string {
    return `hikma-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static set(requestId: string, correlationId: string): void {
    this.correlationIds.set(requestId, correlationId);
  }

  static get(requestId: string): string | undefined {
    return this.correlationIds.get(requestId);
  }

  static delete(requestId: string): void {
    this.correlationIds.delete(requestId);
  }

  static clear(): void {
    this.correlationIds.clear();
  }
}

// Enhanced logger with correlation ID support
export class EnhancedLogger {
  private baseLogger: pino.Logger;

  constructor(baseLogger: pino.Logger = logger) {
    this.baseLogger = baseLogger;
  }

  private addCorrelationId(obj: any, correlationId?: string): any {
    if (correlationId) {
      return { ...obj, correlationId };
    }
    return obj;
  }

  debug(obj: any, msg?: string, correlationId?: string): void {
    this.baseLogger.debug(this.addCorrelationId(obj, correlationId), msg);
  }

  info(obj: any, msg?: string, correlationId?: string): void {
    this.baseLogger.info(this.addCorrelationId(obj, correlationId), msg);
  }

  warn(obj: any, msg?: string, correlationId?: string): void {
    this.baseLogger.warn(this.addCorrelationId(obj, correlationId), msg);
  }

  error(obj: any, msg?: string, correlationId?: string): void {
    this.baseLogger.error(this.addCorrelationId(obj, correlationId), msg);
  }

  fatal(obj: any, msg?: string, correlationId?: string): void {
    this.baseLogger.fatal(this.addCorrelationId(obj, correlationId), msg);
  }

  trace(obj: any, msg?: string, correlationId?: string): void {
    this.baseLogger.trace(this.addCorrelationId(obj, correlationId), msg);
  }

  child(bindings: pino.Bindings): EnhancedLogger {
    return new EnhancedLogger(this.baseLogger.child(bindings));
  }
}

// Request logger utility
export class RequestLogger {
  static logRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    correlationId?: string,
    userId?: string,
    userAgent?: string,
    ip?: string
  ): void {
    const logData = {
      req: {
        method,
        url,
        userAgent,
        ip,
      },
      res: {
        statusCode,
        responseTime,
      },
      userId,
      correlationId,
    };

    if (statusCode >= 500) {
      logger.error(logData, 'HTTP request completed with server error');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'HTTP request completed with client error');
    } else {
      logger.info(logData, 'HTTP request completed successfully');
    }
  }

  static logError(
    error: Error,
    method: string,
    url: string,
    correlationId?: string,
    userId?: string
  ): void {
    logger.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      req: {
        method,
        url,
      },
      userId,
      correlationId,
    }, 'HTTP request failed with error');
  }
}

// Database logger utility
export class DatabaseLogger {
  static logQuery(
    query: string,
    params: any[],
    duration: number,
    correlationId?: string
  ): void {
    logger.debug({
      database: {
        query: query.substring(0, 500), // Truncate long queries
        paramCount: params.length,
        duration,
      },
      correlationId,
    }, 'Database query executed');
  }

  static logError(
    error: Error,
    query: string,
    params: any[],
    correlationId?: string
  ): void {
    logger.error({
      error: {
        name: error.name,
        message: error.message,
      },
      database: {
        query: query.substring(0, 500),
        paramCount: params.length,
      },
      correlationId,
    }, 'Database query failed');
  }
}

// External API logger utility
export class ExternalApiLogger {
  static logRequest(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    correlationId?: string
  ): void {
    const logData = {
      externalApi: {
        service,
        method,
        url,
        statusCode,
        duration,
      },
      correlationId,
    };

    if (statusCode >= 500) {
      logger.error(logData, 'External API request failed with server error');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'External API request failed with client error');
    } else {
      logger.info(logData, 'External API request completed successfully');
    }
  }

  static logError(
    error: Error,
    service: string,
    method: string,
    url: string,
    correlationId?: string
  ): void {
    logger.error({
      error: {
        name: error.name,
        message: error.message,
      },
      externalApi: {
        service,
        method,
        url,
      },
      correlationId,
    }, 'External API request failed with error');
  }
}

// Agent logger utility
export class AgentLogger {
  static logExecution(
    queryId: string,
    intent: string,
    pipeline: string,
    duration: number,
    toolCallCount: number,
    correlationId?: string
  ): void {
    logger.info({
      agent: {
        queryId,
        intent,
        pipeline,
        duration,
        toolCallCount,
      },
      correlationId,
    }, 'Agent execution completed');
  }

  static logToolCall(
    queryId: string,
    toolName: string,
    duration: number,
    success: boolean,
    correlationId?: string
  ): void {
    const logData = {
      agent: {
        queryId,
        toolName,
        duration,
        success,
      },
      correlationId,
    };

    if (success) {
      logger.debug(logData, 'Agent tool call completed successfully');
    } else {
      logger.warn(logData, 'Agent tool call failed');
    }
  }

  static logError(
    error: Error,
    queryId: string,
    context: any,
    correlationId?: string
  ): void {
    logger.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      agent: {
        queryId,
        context,
      },
      correlationId,
    }, 'Agent execution failed with error');
  }
}

// Export enhanced logger instance
export const enhancedLogger = new EnhancedLogger(logger);

