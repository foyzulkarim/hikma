import { logger } from '@/core/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: SpanLog[];
  status: 'ok' | 'error' | 'timeout';
}

export interface SpanLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  fields?: Record<string, any>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export class TraceCollector {
  private initialized = false;
  private activeSpans = new Map<string, Span>();
  private completedTraces = new Map<string, Span[]>();
  private maxTraces = 1000; // Keep last 1000 traces

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Trace Collector...');
      this.initialized = true;
      logger.info('Trace Collector initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Trace Collector');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Trace Collector...');
      this.activeSpans.clear();
      this.completedTraces.clear();
      this.initialized = false;
      logger.info('Trace Collector cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Trace Collector');
    }
  }

  // Start a new span
  startSpan(
    operationName: string,
    parentContext?: TraceContext,
    tags?: Record<string, any>
  ): TraceContext {
    const traceId = parentContext?.traceId || uuidv4();
    const spanId = uuidv4();
    const parentSpanId = parentContext?.spanId;

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      tags: tags || {},
      logs: [],
      status: 'ok'
    };

    this.activeSpans.set(spanId, span);

    logger.debug({ 
      traceId, 
      spanId, 
      parentSpanId, 
      operationName 
    }, 'Span started');

    return { traceId, spanId, parentSpanId };
  }

  // Finish a span
  finishSpan(spanId: string, status: 'ok' | 'error' | 'timeout' = 'ok'): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.warn({ spanId }, 'Attempted to finish unknown span');
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    this.activeSpans.delete(spanId);

    // Add to completed traces
    const traceSpans = this.completedTraces.get(span.traceId) || [];
    traceSpans.push(span);
    this.completedTraces.set(span.traceId, traceSpans);

    // Cleanup old traces
    if (this.completedTraces.size > this.maxTraces) {
      const oldestTraceId = this.completedTraces.keys().next().value;
      if (oldestTraceId) {
        this.completedTraces.delete(oldestTraceId);
      }
    }

    logger.debug({ 
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.duration,
      status: span.status
    }, 'Span finished');
  }

  // Add tags to a span
  setSpanTags(spanId: string, tags: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags = { ...span.tags, ...tags };
    }
  }

  // Add a log to a span
  logToSpan(
    spanId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    fields?: Record<string, any>
  ): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields
      });
    }
  }

  // Get a trace by ID
  getTrace(traceId: string): Span[] | undefined {
    return this.completedTraces.get(traceId);
  }

  // Get all traces
  getAllTraces(): Map<string, Span[]> {
    return new Map(this.completedTraces);
  }

  // Get active spans
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  // Get trace statistics
  getTraceStats(): {
    activeSpans: number;
    completedTraces: number;
    averageSpanDuration: number;
    errorRate: number;
  } {
    const allSpans = Array.from(this.completedTraces.values()).flat();
    const errorSpans = allSpans.filter(span => span.status === 'error');
    const totalDuration = allSpans.reduce((sum, span) => sum + (span.duration || 0), 0);

    return {
      activeSpans: this.activeSpans.size,
      completedTraces: this.completedTraces.size,
      averageSpanDuration: allSpans.length > 0 ? totalDuration / allSpans.length : 0,
      errorRate: allSpans.length > 0 ? (errorSpans.length / allSpans.length) * 100 : 0
    };
  }

  // Helper method to trace a function
  async traceFunction<T>(
    operationName: string,
    fn: (context: TraceContext) => Promise<T>,
    parentContext?: TraceContext,
    tags?: Record<string, any>
  ): Promise<T> {
    const context = this.startSpan(operationName, parentContext, tags);
    
    try {
      const result = await fn(context);
      this.finishSpan(context.spanId, 'ok');
      return result;
    } catch (error) {
      this.logToSpan(context.spanId, 'error', 'Function execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.finishSpan(context.spanId, 'error');
      throw error;
    }
  }
}

// Export singleton instance
export const traceCollector = new TraceCollector();
