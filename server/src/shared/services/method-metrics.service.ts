import { logger } from '@/core/utils/logger';

/**
 * Method performance metrics interface
 */
export interface MethodMetrics {
  methodName: string;
  duration: number;
  timestamp: string;
  correlationId: string;
  success: boolean;
  error?: string;
}

/**
 * MethodMetricsService
 * 
 * Centralized performance tracking service with consistent logging.
 * Provides method performance monitoring and metrics collection for
 * all service methods.
 */
export class MethodMetricsService {
  private metricsBuffer: MethodMetrics[] = [];
  private readonly bufferFlushInterval: number;
  private flushTimer?: NodeJS.Timeout;

  constructor(bufferFlushInterval: number = 30000) { // 30 seconds default
    this.bufferFlushInterval = bufferFlushInterval;
    this.startPeriodicFlush();
  }

  /**
   * Track method performance with automatic timing and error handling
   * 
   * @param methodName - Name of the method being tracked
   * @param operation - Async operation to execute and measure
   * @param correlationId - Request correlation ID for tracing
   * @returns Promise<T> - Result of the operation
   */
  async trackMethodPerformance<T>(
    methodName: string,
    operation: () => Promise<T>,
    correlationId: string
  ): Promise<T> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      // Execute the operation
      const result = await operation();
      
      // Record successful metrics
      const duration = Date.now() - startTime;
      this.recordMetrics({
        methodName,
        duration,
        timestamp,
        correlationId,
        success: true
      });
      
      return result;
    } catch (error) {
      // Record failed metrics
      const duration = Date.now() - startTime;
      this.recordMetrics({
        methodName,
        duration,
        timestamp,
        correlationId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Re-throw the error to maintain the original flow
      throw error;
    }
  }

  /**
   * Record metrics data
   * 
   * @param metrics - Method metrics to record
   */
  private recordMetrics(metrics: MethodMetrics): void {
    this.metricsBuffer.push(metrics);
    this.logMetrics(metrics);
    
    // If buffer is getting large, flush immediately
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics();
    }
  }

  /**
   * Log metrics with structured logging
   * 
   * @param metrics - Method metrics to log
   */
  private logMetrics(metrics: MethodMetrics): void {
    const logData = {
      type: 'method_metrics',
      method: metrics.methodName,
      duration: metrics.duration,
      timestamp: metrics.timestamp,
      correlationId: metrics.correlationId,
      success: metrics.success,
      ...(metrics.error && { error: metrics.error })
    };

    if (metrics.success) {
      if (metrics.duration > 5000) { // Log slow methods (>5s) as warnings
        logger.warn('Slow method execution detected', logData);
      } else {
        logger.info('Method execution completed', logData);
      }
    } else {
      logger.error('Method execution failed', logData);
    }
  }

  /**
   * Get metrics summary for a specific method
   * 
   * @param methodName - Name of the method to get metrics for
   * @returns Method metrics summary or null if no metrics found
   */
  getMethodSummary(methodName: string): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    lastCall: string;
  } | null {
    const methodMetrics = this.metricsBuffer.filter(m => m.methodName === methodName);
    
    if (methodMetrics.length === 0) {
      return null;
    }

    const durations = methodMetrics.map(m => m.duration);
    const successfulCalls = methodMetrics.filter(m => m.success).length;
    
    return {
      totalCalls: methodMetrics.length,
      successfulCalls,
      failedCalls: methodMetrics.length - successfulCalls,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      lastCall: methodMetrics[methodMetrics.length - 1].timestamp
    };
  }

  /**
   * Get all metrics in the buffer
   * 
   * @returns Array of all collected metrics
   */
  getAllMetrics(): MethodMetrics[] {
    return [...this.metricsBuffer]; // Return a copy
  }

  /**
   * Clear all metrics from the buffer
   */
  clearMetrics(): void {
    this.metricsBuffer = [];
  }

  /**
   * Flush metrics to storage/external systems
   * Currently just logs the buffer size, but can be extended to send
   * metrics to external monitoring systems like Prometheus, DataDog, etc.
   */
  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) return;
    
    logger.info('Flushing method metrics', {
      type: 'metrics_flush',
      bufferSize: this.metricsBuffer.length,
      timestamp: new Date().toISOString()
    });

    // Here you could implement:
    // - Send to Prometheus metrics endpoint
    // - Send to DataDog StatsD
    // - Store in database for analytics
    // - Send to external monitoring service
    
    // For now, we'll keep a sliding window of the last 1000 metrics
    if (this.metricsBuffer.length > 1000) {
      this.metricsBuffer = this.metricsBuffer.slice(-1000);
    }
  }

  /**
   * Start periodic metrics flushing
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.bufferFlushInterval);
    
    // Ensure flush timer is cleared on process exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * Cleanup method to ensure proper shutdown
   */
  private cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Final flush on cleanup
    this.flushMetrics();
  }

  /**
   * Get performance metrics for the last N minutes
   * 
   * @param minutes - Number of minutes to look back
   * @returns Array of metrics within the time window
   */
  getRecentMetrics(minutes: number = 10): MethodMetrics[] {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return this.metricsBuffer.filter(m => new Date(m.timestamp).getTime() > cutoffTime);
  }

  /**
   * Calculate method performance statistics across all methods
   * 
   * @returns Overall performance statistics
   */
  getOverallStats(): {
    totalMethods: number;
    totalCalls: number;
    successRate: number;
    averageDuration: number;
    slowestMethod: string | null;
    fastestMethod: string | null;
  } {
    if (this.metricsBuffer.length === 0) {
      return {
        totalMethods: 0,
        totalCalls: 0,
        successRate: 0,
        averageDuration: 0,
        slowestMethod: null,
        fastestMethod: null
      };
    }

    const uniqueMethods = new Set(this.metricsBuffer.map(m => m.methodName));
    const successfulCalls = this.metricsBuffer.filter(m => m.success).length;
    const durations = this.metricsBuffer.map(m => m.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    const slowestMetric = this.metricsBuffer.reduce((slowest, current) => 
      current.duration > slowest.duration ? current : slowest
    );
    
    const fastestMetric = this.metricsBuffer.reduce((fastest, current) => 
      current.duration < fastest.duration ? current : fastest
    );

    return {
      totalMethods: uniqueMethods.size,
      totalCalls: this.metricsBuffer.length,
      successRate: (successfulCalls / this.metricsBuffer.length) * 100,
      averageDuration,
      slowestMethod: slowestMetric.methodName,
      fastestMethod: fastestMetric.methodName
    };
  }
}