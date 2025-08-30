import { logger } from '@/core/utils/logger';

interface RetryOptions {
  attempts?: number;
  delay?: number;
  backoff?: 'fixed' | 'exponential';
  retryCondition?: (error: Error) => boolean;
}

/**
 * Retry decorator for method execution
 */
export function Retry(options: RetryOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const attempts = options.attempts || 3;
    const delay = options.delay || 1000;
    const backoff = options.backoff || 'exponential';
    const retryCondition = options.retryCondition || (() => true);

    descriptor.value = async function (...args: any[]) {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await method.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          // Check if we should retry this error
          if (!retryCondition(lastError)) {
            logger.debug({ error: lastError, attempt }, 'Error not retryable');
            throw lastError;
          }

          // Don't wait after the last attempt
          if (attempt === attempts) {
            break;
          }

          // Calculate delay
          let waitTime = delay;
          if (backoff === 'exponential') {
            waitTime = delay * Math.pow(2, attempt - 1);
          }

          logger.warn(
            { 
              error: lastError.message, 
              attempt, 
              maxAttempts: attempts, 
              waitTime,
              method: `${target.constructor.name}.${propertyName}`
            }, 
            'Method failed, retrying'
          );

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // lastError should never be null here, but add safety check
      if (!lastError) {
        lastError = new Error('Unknown error occurred during retry attempts');
      }

      logger.error(
        { 
          error: lastError, 
          attempts,
          method: `${target.constructor.name}.${propertyName}`
        }, 
        'Method failed after all retry attempts'
      );
      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Common retry conditions
 */
export const RetryConditions = {
  // Retry on network errors
  networkError: (error: Error) => {
    return error.message.includes('ECONNRESET') ||
           error.message.includes('ENOTFOUND') ||
           error.message.includes('ETIMEDOUT') ||
           error.message.includes('ECONNREFUSED');
  },

  // Retry on temporary errors (5xx status codes)
  temporaryError: (error: any) => {
    return error.status >= 500 && error.status < 600;
  },

  // Retry on rate limit errors
  rateLimitError: (error: any) => {
    return error.status === 429;
  },

  // Combine multiple conditions
  combine: (...conditions: Array<(error: Error) => boolean>) => {
    return (error: Error) => conditions.some(condition => condition(error));
  }
};
