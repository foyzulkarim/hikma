import { logger } from '@/core/utils/logger';
import { eventBus } from '@/shared/events/event-bus';

export interface ActionContext {
  triggerId: string;
  triggerName: string;
  eventId: string;
  eventType: string;
  eventPayload: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ActionConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  metadata?: Record<string, any>;
}

export interface ActionExecutionResult {
  success: boolean;
  executionTime: number;
  output?: any;
  error?: string;
  retryCount?: number;
  metadata?: Record<string, any>;
}

export abstract class BaseAction {
  protected config: ActionConfig;
  protected executionCount = 0;
  protected lastExecution: Date | null = null;
  protected successCount = 0;
  protected errorCount = 0;

  constructor(config: ActionConfig) {
    this.config = config;
  }

  abstract execute(context: ActionContext): Promise<ActionExecutionResult>;

  async executeWithRetry(context: ActionContext): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retryCount = 0;
    const maxRetries = this.config.retryAttempts || 0;

    // Check if action is enabled
    if (!this.config.enabled) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: 'Action is disabled'
      };
    }

    while (retryCount <= maxRetries) {
      try {
        // Set timeout if configured
        const timeoutMs = this.config.timeoutMs || 30000; // 30 second default
        const executionPromise = this.execute(context);
        
        const result = await Promise.race([
          executionPromise,
          this.createTimeoutPromise(timeoutMs)
        ]);

        // Update statistics
        this.updateExecutionStats(true);

        // Emit success event
        eventBus.emit('workflow-action-completed', {
          actionId: this.config.id,
          actionName: this.config.name,
          triggerId: context.triggerId,
          eventId: context.eventId,
          success: true,
          executionTime: Date.now() - startTime,
          retryCount,
          timestamp: new Date().toISOString()
        });

        logger.info({ 
          actionId: this.config.id,
          triggerId: context.triggerId,
          eventId: context.eventId,
          executionTime: Date.now() - startTime,
          retryCount
        }, 'Action executed successfully');

        return {
          ...result,
          executionTime: Date.now() - startTime,
          retryCount
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        logger.warn({ 
          error: lastError,
          actionId: this.config.id,
          triggerId: context.triggerId,
          eventId: context.eventId,
          retryCount,
          maxRetries
        }, 'Action execution failed, retrying...');

        // Wait before retry if configured
        if (retryCount <= maxRetries && this.config.retryDelayMs) {
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    // All retries exhausted
    this.updateExecutionStats(false);

    // Emit failure event
    eventBus.emit('workflow-action-failed', {
      actionId: this.config.id,
      actionName: this.config.name,
      triggerId: context.triggerId,
      eventId: context.eventId,
      error: lastError?.message,
      executionTime: Date.now() - startTime,
      retryCount,
      timestamp: new Date().toISOString()
    });

    logger.error({ 
      error: lastError,
      actionId: this.config.id,
      triggerId: context.triggerId,
      eventId: context.eventId,
      retryCount
    }, 'Action execution failed after all retries');

    return {
      success: false,
      executionTime: Date.now() - startTime,
      error: lastError?.message || 'Unknown error',
      retryCount
    };
  }

  private async createTimeoutPromise(timeoutMs: number): Promise<ActionExecutionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Action execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateExecutionStats(success: boolean): void {
    this.executionCount++;
    this.lastExecution = new Date();
    
    if (success) {
      this.successCount++;
    } else {
      this.errorCount++;
    }
  }

  // Validation methods that can be overridden
  protected validateContext(context: ActionContext): void {
    if (!context.triggerId) {
      throw new Error('Trigger ID is required');
    }
    if (!context.eventId) {
      throw new Error('Event ID is required');
    }
    if (!context.eventType) {
      throw new Error('Event type is required');
    }
  }

  protected validateConfig(): void {
    if (!this.config.id) {
      throw new Error('Action ID is required');
    }
    if (!this.config.name) {
      throw new Error('Action name is required');
    }
  }

  // Helper methods for common action patterns
  protected extractFromPayload(path: string, payload: Record<string, any>): any {
    const parts = path.split('.');
    let value = payload;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  protected formatTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  protected sanitizeForMarkdown(text: string): string {
    return text
      .replace(/[*_`~]/g, '\\$&')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  // Configuration methods
  updateConfig(config: Partial<ActionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug({ actionId: this.config.id }, 'Action configuration updated');
  }

  getConfig(): ActionConfig {
    return { ...this.config };
  }

  getStats(): {
    totalExecutions: number;
    successCount: number;
    errorCount: number;
    successRate: number;
    lastExecution: Date | null;
    enabled: boolean;
  } {
    const successRate = this.executionCount > 0 ? 
      (this.successCount / this.executionCount) * 100 : 0;

    return {
      totalExecutions: this.executionCount,
      successCount: this.successCount,
      errorCount: this.errorCount,
      successRate: Math.round(successRate * 100) / 100,
      lastExecution: this.lastExecution,
      enabled: this.config.enabled
    };
  }

  enable(): void {
    this.config.enabled = true;
    logger.info({ actionId: this.config.id }, 'Action enabled');
  }

  disable(): void {
    this.config.enabled = false;
    logger.info({ actionId: this.config.id }, 'Action disabled');
  }

  // Test method for validation
  async test(context: ActionContext): Promise<ActionExecutionResult> {
    try {
      this.validateContext(context);
      this.validateConfig();
      
      // Create a test context
      const testContext = {
        ...context,
        metadata: { ...context.metadata, isTest: true }
      };

      return await this.execute(testContext);
    } catch (error) {
      return {
        success: false,
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }
}
