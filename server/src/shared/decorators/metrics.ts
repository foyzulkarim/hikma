import { logger } from '@/core/utils/logger';

interface MetricsOptions {
  name?: string;
  tags?: Record<string, string>;
  logExecution?: boolean;
  logErrors?: boolean;
}

/**
 * Metrics decorator for method execution tracking
 */
export function Metrics(options: MetricsOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const metricName = options.name || `${target.constructor.name}.${propertyName}`;
    const tags = options.tags || {};
    const logExecution = options.logExecution !== false;
    const logErrors = options.logErrors !== false;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const correlationId = (this as any).correlationId || 'unknown';

      try {
        if (logExecution) {
          logger.debug(
            { 
              metric: metricName, 
              tags, 
              correlationId,
              args: args.length 
            }, 
            'Method execution started'
          );
        }

        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        if (logExecution) {
          logger.info(
            { 
              metric: metricName, 
              tags, 
              duration, 
              correlationId,
              status: 'success'
            }, 
            'Method execution completed'
          );
        }

        // In production, this would send metrics to a monitoring system
        // For now, we'll just log structured metrics
        logger.debug({
          type: 'metric',
          name: metricName,
          value: duration,
          unit: 'milliseconds',
          tags: { ...tags, status: 'success' },
          timestamp: new Date().toISOString()
        }, 'Performance metric');

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (logErrors) {
          logger.error(
            { 
              metric: metricName, 
              tags, 
              duration, 
              correlationId,
              error: (error as Error).message,
              status: 'error'
            }, 
            'Method execution failed'
          );
        }

        // Log error metric
        logger.debug({
          type: 'metric',
          name: `${metricName}.error`,
          value: 1,
          unit: 'count',
          tags: { ...tags, status: 'error', errorType: (error as Error).constructor.name },
          timestamp: new Date().toISOString()
        }, 'Error metric');

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Counter decorator for counting method invocations
 */
export function Counter(name?: string, tags?: Record<string, string>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const counterName = name || `${target.constructor.name}.${propertyName}.count`;

    descriptor.value = async function (...args: any[]) {
      // Log counter metric
      logger.debug({
        type: 'metric',
        name: counterName,
        value: 1,
        unit: 'count',
        tags: tags || {},
        timestamp: new Date().toISOString()
      }, 'Counter metric');

      return await method.apply(this, args);
    };

    return descriptor;
  };
}
