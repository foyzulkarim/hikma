import { logger } from '@/core/utils/logger';
import { eventBus } from '@/shared/events/event-bus';

export interface TriggerEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches' | 'greaterThan' | 'lessThan';
  value: any;
  caseSensitive?: boolean;
}

export interface TriggerConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: TriggerCondition[];
  actions: string[]; // Action IDs to execute
  cooldownMs?: number; // Minimum time between trigger executions
  maxExecutionsPerHour?: number;
  metadata?: Record<string, any>;
}

export interface TriggerExecutionResult {
  triggered: boolean;
  actionIds: string[];
  executionTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

export abstract class BaseTrigger {
  protected config: TriggerConfig;
  protected lastExecution: Date | null = null;
  protected executionCount = 0;
  protected hourlyExecutions: Date[] = [];

  constructor(config: TriggerConfig) {
    this.config = config;
  }

  abstract getEventTypes(): string[];
  abstract shouldTrigger(event: TriggerEvent): Promise<boolean>;

  async processEvent(event: TriggerEvent): Promise<TriggerExecutionResult> {
    const startTime = Date.now();

    try {
      // Check if trigger is enabled
      if (!this.config.enabled) {
        return {
          triggered: false,
          actionIds: [],
          executionTime: Date.now() - startTime
        };
      }

      // Check cooldown
      if (!this.checkCooldown()) {
        logger.debug({ 
          triggerId: this.config.id, 
          eventId: event.id 
        }, 'Trigger in cooldown period');
        
        return {
          triggered: false,
          actionIds: [],
          executionTime: Date.now() - startTime
        };
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        logger.warn({ 
          triggerId: this.config.id, 
          eventId: event.id 
        }, 'Trigger rate limit exceeded');
        
        return {
          triggered: false,
          actionIds: [],
          executionTime: Date.now() - startTime
        };
      }

      // Check if event should trigger actions
      const shouldTrigger = await this.shouldTrigger(event);
      
      if (!shouldTrigger) {
        return {
          triggered: false,
          actionIds: [],
          executionTime: Date.now() - startTime
        };
      }

      // Update execution tracking
      this.updateExecutionTracking();

      // Emit workflow trigger event
      eventBus.emit('workflow-trigger-activated', {
        triggerId: this.config.id,
        triggerName: this.config.name,
        eventId: event.id,
        actionIds: this.config.actions,
        timestamp: new Date().toISOString()
      });

      logger.info({ 
        triggerId: this.config.id, 
        eventId: event.id, 
        actionCount: this.config.actions.length 
      }, 'Trigger activated');

      return {
        triggered: true,
        actionIds: this.config.actions,
        executionTime: Date.now() - startTime,
        metadata: {
          triggerName: this.config.name,
          eventType: event.type
        }
      };

    } catch (error) {
      logger.error({ 
        error, 
        triggerId: this.config.id, 
        eventId: event.id 
      }, 'Trigger processing failed');

      return {
        triggered: false,
        actionIds: [],
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  protected evaluateConditions(event: TriggerEvent): boolean {
    if (this.config.conditions.length === 0) {
      return true; // No conditions means always trigger
    }

    return this.config.conditions.every(condition => 
      this.evaluateCondition(condition, event)
    );
  }

  protected evaluateCondition(condition: TriggerCondition, event: TriggerEvent): boolean {
    const fieldValue = this.getFieldValue(condition.field, event);
    
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    const { operator, value, caseSensitive = true } = condition;
    
    let fieldStr = String(fieldValue);
    let conditionStr = String(value);
    
    if (!caseSensitive) {
      fieldStr = fieldStr.toLowerCase();
      conditionStr = conditionStr.toLowerCase();
    }

    switch (operator) {
      case 'equals':
        return fieldStr === conditionStr;
      
      case 'contains':
        return fieldStr.includes(conditionStr);
      
      case 'startsWith':
        return fieldStr.startsWith(conditionStr);
      
      case 'endsWith':
        return fieldStr.endsWith(conditionStr);
      
      case 'matches':
        try {
          const regex = new RegExp(conditionStr, caseSensitive ? 'g' : 'gi');
          return regex.test(fieldStr);
        } catch {
          return false;
        }
      
      case 'greaterThan':
        const numField = Number(fieldValue);
        const numCondition = Number(value);
        return !isNaN(numField) && !isNaN(numCondition) && numField > numCondition;
      
      case 'lessThan':
        const numField2 = Number(fieldValue);
        const numCondition2 = Number(value);
        return !isNaN(numField2) && !isNaN(numCondition2) && numField2 < numCondition2;
      
      default:
        return false;
    }
  }

  protected getFieldValue(field: string, event: TriggerEvent): any {
    // Support dot notation for nested fields
    const parts = field.split('.');
    let value: any = event;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private checkCooldown(): boolean {
    if (!this.config.cooldownMs || !this.lastExecution) {
      return true;
    }

    const timeSinceLastExecution = Date.now() - this.lastExecution.getTime();
    return timeSinceLastExecution >= this.config.cooldownMs;
  }

  private checkRateLimit(): boolean {
    if (!this.config.maxExecutionsPerHour) {
      return true;
    }

    // Clean up old executions (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.hourlyExecutions = this.hourlyExecutions.filter(
      execution => execution > oneHourAgo
    );

    return this.hourlyExecutions.length < this.config.maxExecutionsPerHour;
  }

  private updateExecutionTracking(): void {
    this.lastExecution = new Date();
    this.executionCount++;
    this.hourlyExecutions.push(new Date());
  }

  // Configuration methods
  updateConfig(config: Partial<TriggerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug({ triggerId: this.config.id }, 'Trigger configuration updated');
  }

  getConfig(): TriggerConfig {
    return { ...this.config };
  }

  getStats(): {
    totalExecutions: number;
    lastExecution: Date | null;
    hourlyExecutions: number;
    enabled: boolean;
  } {
    // Clean up old executions for accurate count
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentExecutions = this.hourlyExecutions.filter(
      execution => execution > oneHourAgo
    );

    return {
      totalExecutions: this.executionCount,
      lastExecution: this.lastExecution,
      hourlyExecutions: recentExecutions.length,
      enabled: this.config.enabled
    };
  }

  enable(): void {
    this.config.enabled = true;
    logger.info({ triggerId: this.config.id }, 'Trigger enabled');
  }

  disable(): void {
    this.config.enabled = false;
    logger.info({ triggerId: this.config.id }, 'Trigger disabled');
  }
}
