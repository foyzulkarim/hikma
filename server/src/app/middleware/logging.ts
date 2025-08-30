import { FastifyRequest, FastifyReply } from 'fastify';
import { logger, RequestLogger, CorrelationIdManager } from '@/core/utils/logger';
import { config } from '@/config/app';

// Request logging configuration
export interface RequestLoggingConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logBody?: boolean;
  logHeaders?: boolean;
  logQuery?: boolean;
  logParams?: boolean;
  logResponse?: boolean;
  maxBodyLength?: number;
  excludePaths?: string[];
  excludeHeaders?: string[];
  includeUserAgent?: boolean;
  includeIP?: boolean;
  logSlowRequests?: boolean;
  slowRequestThreshold?: number;
}

// Default configuration
const defaultConfig: Required<RequestLoggingConfig> = {
  logLevel: 'info',
  logBody: false,
  logHeaders: false,
  logQuery: true,
  logParams: true,
  logResponse: false,
  maxBodyLength: 1000,
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
  excludeHeaders: [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'set-cookie',
  ],
  includeUserAgent: true,
  includeIP: true,
  logSlowRequests: true,
  slowRequestThreshold: 1000, // 1 second
};

// Request context interface
export interface RequestContext {
  correlationId: string;
  startTime: number;
  method: string;
  url: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
}

// Request logging middleware
export class RequestLoggingMiddleware {
  private config: Required<RequestLoggingConfig>;

  constructor(config: RequestLoggingConfig = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // Pre-handler middleware (logs incoming requests)
  preHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Generate or extract correlation ID
    const correlationId = this.extractCorrelationId(request) || CorrelationIdManager.generate();
    request.correlationId = correlationId;

    // Set correlation ID in response headers
    reply.header('X-Correlation-ID', correlationId);

    // Check if path should be excluded
    if (this.shouldExcludePath(request.url)) {
      return;
    }

    // Create request context
    const context: RequestContext = {
      correlationId,
      startTime: Date.now(),
      method: request.method,
      url: request.url,
      ip: this.config.includeIP ? request.ip : undefined,
      userAgent: this.config.includeUserAgent ? request.headers['user-agent'] : undefined,
      userId: request.user?.id,
      sessionId: this.extractSessionId(request),
    };

    // Store context in request for later use
    (request as any).loggingContext = context;

    // Log incoming request
    this.logIncomingRequest(request, context);
  };

  // On-response middleware (logs outgoing responses)
  onResponse = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const context = (request as any).loggingContext as RequestContext;
    
    if (!context || this.shouldExcludePath(request.url)) {
      return;
    }

    const responseTime = Date.now() - context.startTime;
    const statusCode = reply.statusCode;

    // Log outgoing response
    this.logOutgoingResponse(request, reply, context, responseTime);

    // Log slow requests
    if (this.config.logSlowRequests && responseTime > this.config.slowRequestThreshold) {
      this.logSlowRequest(request, context, responseTime);
    }

    // Use the centralized request logger
    RequestLogger.logRequest(
      context.method,
      context.url,
      statusCode,
      responseTime,
      context.correlationId,
      context.userId,
      context.userAgent,
      context.ip
    );
  };

  private extractCorrelationId(request: FastifyRequest): string | undefined {
    return (
      request.headers['x-correlation-id'] as string ||
      request.headers['x-request-id'] as string ||
      request.headers['x-trace-id'] as string
    );
  }

  private extractSessionId(request: FastifyRequest): string | undefined {
    return (
      request.headers['x-session-id'] as string ||
      request.cookies?.sessionId
    );
  }

  private shouldExcludePath(path: string): boolean {
    return this.config.excludePaths.some(excludePath => 
      path.startsWith(excludePath)
    );
  }

  private filterHeaders(headers: Record<string, any>): Record<string, any> {
    const filtered: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (!this.config.excludeHeaders.includes(key.toLowerCase())) {
        filtered[key] = value;
      } else {
        filtered[key] = '[REDACTED]';
      }
    }
    
    return filtered;
  }

  private truncateBody(body: any): any {
    if (!body) return body;
    
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    
    if (bodyString.length > this.config.maxBodyLength) {
      return bodyString.substring(0, this.config.maxBodyLength) + '... [TRUNCATED]';
    }
    
    return body;
  }

  private logIncomingRequest(request: FastifyRequest, context: RequestContext): void {
    const logData: any = {
      type: 'request_incoming',
      correlationId: context.correlationId,
      request: {
        method: context.method,
        url: context.url,
        ip: context.ip,
        userAgent: context.userAgent,
        userId: context.userId,
        sessionId: context.sessionId,
      },
    };

    // Add optional data based on configuration
    if (this.config.logHeaders) {
      logData.request.headers = this.filterHeaders(request.headers);
    }

    if (this.config.logQuery && Object.keys(request.query as object).length > 0) {
      logData.request.query = request.query;
    }

    if (this.config.logParams && Object.keys(request.params as object).length > 0) {
      logData.request.params = request.params;
    }

    if (this.config.logBody && request.body) {
      logData.request.body = this.truncateBody(request.body);
    }

    logger[this.config.logLevel](logData, 'Incoming request');
  }

  private logOutgoingResponse(
    request: FastifyRequest,
    reply: FastifyReply,
    context: RequestContext,
    responseTime: number
  ): void {
    const logData: any = {
      type: 'request_outgoing',
      correlationId: context.correlationId,
      request: {
        method: context.method,
        url: context.url,
        userId: context.userId,
      },
      response: {
        statusCode: reply.statusCode,
        responseTime,
      },
    };

    // Add response headers if configured
    if (this.config.logHeaders) {
      logData.response.headers = this.filterHeaders(reply.getHeaders());
    }

    // Add response body if configured (be careful with this in production)
    if (this.config.logResponse && config.server.environment === 'development') {
      // Note: Getting response body is complex in Fastify and should be avoided in production
      logData.response.note = 'Response body logging not implemented for performance reasons';
    }

    const logLevel = this.getLogLevelForStatus(reply.statusCode);
    logger[logLevel](logData, 'Outgoing response');
  }

  private logSlowRequest(
    request: FastifyRequest,
    context: RequestContext,
    responseTime: number
  ): void {
    logger.warn({
      type: 'slow_request',
      correlationId: context.correlationId,
      request: {
        method: context.method,
        url: context.url,
        userId: context.userId,
      },
      performance: {
        responseTime,
        threshold: this.config.slowRequestThreshold,
      },
    }, 'Slow request detected');
  }

  private getLogLevelForStatus(statusCode: number): 'debug' | 'info' | 'warn' | 'error' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (statusCode >= 300) return 'info';
    return this.config.logLevel;
  }
}

// Create middleware instances with different configurations
export const createRequestLoggingMiddleware = (config?: RequestLoggingConfig) => {
  return new RequestLoggingMiddleware(config);
};

// Default request logging middleware
export const requestLoggingMiddleware = createRequestLoggingMiddleware();

// Development logging middleware (more verbose)
export const developmentLoggingMiddleware = createRequestLoggingMiddleware({
  logLevel: 'debug',
  logBody: true,
  logHeaders: true,
  logResponse: false, // Still avoid response body logging
  maxBodyLength: 2000,
});

// Production logging middleware (minimal)
export const productionLoggingMiddleware = createRequestLoggingMiddleware({
  logLevel: 'info',
  logBody: false,
  logHeaders: false,
  logQuery: false,
  logParams: false,
  logResponse: false,
  slowRequestThreshold: 2000, // 2 seconds for production
});

// Security audit logging middleware
export const securityAuditLoggingMiddleware = createRequestLoggingMiddleware({
  logLevel: 'info',
  logBody: false,
  logHeaders: true,
  logQuery: true,
  logParams: true,
  excludePaths: [], // Log all paths for security audit
  excludeHeaders: ['cookie'], // Still exclude cookies but log other headers
});

// Performance monitoring middleware
export const performanceLoggingMiddleware = createRequestLoggingMiddleware({
  logLevel: 'info',
  logBody: false,
  logHeaders: false,
  logSlowRequests: true,
  slowRequestThreshold: 500, // 500ms threshold for performance monitoring
});

// Correlation ID middleware (lightweight, just for correlation ID)
export const correlationIdMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const correlationId = 
    request.headers['x-correlation-id'] as string ||
    request.headers['x-request-id'] as string ||
    CorrelationIdManager.generate();

  request.correlationId = correlationId;
  reply.header('X-Correlation-ID', correlationId);
};

// Request timing middleware
export const requestTimingMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const startTime = Date.now();
  
  reply.header('X-Response-Time-Start', startTime.toString());
  
  // Add onResponse hook to calculate total time
  reply.raw.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // This header won't be sent since response is already finished,
    // but we can log it or store it for metrics
    logger.debug({
      correlationId: request.correlationId,
      responseTime,
      url: request.url,
      method: request.method,
    }, 'Request timing');
  });
};

// Request size logging middleware
export const requestSizeMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const contentLength = request.headers['content-length'];
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    
    if (size > 1024 * 1024) { // Log requests larger than 1MB
      logger.info({
        correlationId: request.correlationId,
        requestSize: size,
        url: request.url,
        method: request.method,
        userId: request.user?.id,
      }, 'Large request detected');
    }
  }
};

// All exports are already handled by the individual export declarations above

