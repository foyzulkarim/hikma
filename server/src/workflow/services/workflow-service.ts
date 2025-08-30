import { logger } from '@/core/utils/logger';
import { eventBus } from '@/shared/events/event-bus';
import { BaseTrigger, TriggerEvent, TriggerConfig } from '../triggers/base-trigger';
import { BaseAction, ActionContext, ActionConfig } from '../actions/base-action';
import { PRTrigger } from '../triggers/pr-trigger';
import { CommitTrigger } from '../triggers/commit-trigger';
import { IssueTrigger } from '../triggers/issue-trigger';
import { PRSummaryAction } from '../actions/pr-summary-action';
import { NotificationAction } from '../actions/notification-action';
import { QualityGateAction } from '../actions/quality-gate-action';

export interface WorkflowConfig {
  enabled: boolean;
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  retryAttempts: number;
  enableMetrics: boolean;
}

export interface WorkflowExecution {
  id: string;
  triggerId: string;
  triggerName: string;
  eventId: string;
  eventType: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  actions: Array<{
    actionId: string;
    actionName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    executionTime?: number;
    error?: string;
    output?: any;
  }>;
  totalExecutionTime?: number;
  error?: string;
}

export interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  triggerStats: Record<string, {
    executions: number;
    successRate: number;
    averageTime: number;
  }>;
  actionStats: Record<string, {
    executions: number;
    successRate: number;
    averageTime: number;
  }>;
}

export class WorkflowService {
  private config: WorkflowConfig;
  private initialized = false;
  private triggers = new Map<string, BaseTrigger>();
  private actions = new Map<string, BaseAction>();
  private executions = new Map<string, WorkflowExecution>();
  private runningExecutions = new Set<string>();

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Workflow Service...');
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize default triggers and actions
      await this.initializeDefaults();
      
      this.initialized = true;
      logger.info('Workflow Service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Workflow Service');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Workflow Service...');
      
      // Wait for running executions to complete (with timeout)
      await this.waitForExecutionsToComplete(10000); // 10 second timeout
      
      this.triggers.clear();
      this.actions.clear();
      this.executions.clear();
      this.runningExecutions.clear();
      
      this.initialized = false;
      logger.info('Workflow Service cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Workflow Service');
    }
  }

  // Trigger management
  registerTrigger(trigger: BaseTrigger): void {
    const config = trigger.getConfig();
    this.triggers.set(config.id, trigger);
    
    logger.info({ 
      triggerId: config.id,
      triggerName: config.name,
      enabled: config.enabled
    }, 'Trigger registered');
  }

  unregisterTrigger(triggerId: string): void {
    const removed = this.triggers.delete(triggerId);
    if (removed) {
      logger.info({ triggerId }, 'Trigger unregistered');
    }
  }

  getTrigger(triggerId: string): BaseTrigger | undefined {
    return this.triggers.get(triggerId);
  }

  listTriggers(): Array<{ id: string; name: string; enabled: boolean; type: string }> {
    return Array.from(this.triggers.values()).map(trigger => {
      const config = trigger.getConfig();
      return {
        id: config.id,
        name: config.name,
        enabled: config.enabled,
        type: trigger.constructor.name
      };
    });
  }

  // Action management
  registerAction(action: BaseAction): void {
    const config = action.getConfig();
    this.actions.set(config.id, action);
    
    logger.info({ 
      actionId: config.id,
      actionName: config.name,
      enabled: config.enabled
    }, 'Action registered');
  }

  unregisterAction(actionId: string): void {
    const removed = this.actions.delete(actionId);
    if (removed) {
      logger.info({ actionId }, 'Action unregistered');
    }
  }

  getAction(actionId: string): BaseAction | undefined {
    return this.actions.get(actionId);
  }

  listActions(): Array<{ id: string; name: string; enabled: boolean; type: string }> {
    return Array.from(this.actions.values()).map(action => {
      const config = action.getConfig();
      return {
        id: config.id,
        name: config.name,
        enabled: config.enabled,
        type: action.constructor.name
      };
    });
  }

  // Event processing
  async processEvent(event: TriggerEvent): Promise<string[]> {
    if (!this.config.enabled) {
      logger.debug({ eventId: event.id }, 'Workflow processing disabled');
      return [];
    }

    const executionIds: string[] = [];

    try {
      // Find matching triggers
      const matchingTriggers = await this.findMatchingTriggers(event);
      
      if (matchingTriggers.length === 0) {
        logger.debug({ 
          eventId: event.id,
          eventType: event.type
        }, 'No matching triggers found for event');
        return [];
      }

      // Process each matching trigger
      for (const trigger of matchingTriggers) {
        try {
          const executionId = await this.executeTrigger(trigger, event);
          if (executionId) {
            executionIds.push(executionId);
          }
        } catch (error) {
          logger.error({ 
            error,
            triggerId: trigger.getConfig().id,
            eventId: event.id
          }, 'Failed to execute trigger');
        }
      }

      return executionIds;
    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Failed to process event');
      return [];
    }
  }

  private async findMatchingTriggers(event: TriggerEvent): Promise<BaseTrigger[]> {
    const matchingTriggers: BaseTrigger[] = [];

    for (const trigger of this.triggers.values()) {
      try {
        const eventTypes = trigger.getEventTypes();
        
        // Check if trigger handles this event type
        if (eventTypes.includes(event.type) || eventTypes.includes('*')) {
          const result = await trigger.processEvent(event);
          
          if (result.triggered) {
            matchingTriggers.push(trigger);
          }
        }
      } catch (error) {
        logger.error({ 
          error,
          triggerId: trigger.getConfig().id,
          eventId: event.id
        }, 'Error checking trigger match');
      }
    }

    return matchingTriggers;
  }

  private async executeTrigger(trigger: BaseTrigger, event: TriggerEvent): Promise<string | null> {
    const triggerConfig = trigger.getConfig();
    
    // Check concurrent execution limit
    if (this.runningExecutions.size >= this.config.maxConcurrentExecutions) {
      logger.warn({ 
        triggerId: triggerConfig.id,
        runningExecutions: this.runningExecutions.size,
        maxConcurrent: this.config.maxConcurrentExecutions
      }, 'Max concurrent executions reached, skipping trigger');
      return null;
    }

    const executionId = this.generateExecutionId();
    const execution: WorkflowExecution = {
      id: executionId,
      triggerId: triggerConfig.id,
      triggerName: triggerConfig.name,
      eventId: event.id,
      eventType: event.type,
      startTime: new Date(),
      status: 'running',
      actions: triggerConfig.actions.map(actionId => ({
        actionId,
        actionName: this.actions.get(actionId)?.getConfig().name || 'Unknown',
        status: 'pending'
      }))
    };

    this.executions.set(executionId, execution);
    this.runningExecutions.add(executionId);

    try {
      // Execute actions
      await this.executeActions(triggerConfig.actions, event, execution);
      
      // Mark as completed
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.totalExecutionTime = execution.endTime.getTime() - execution.startTime.getTime();

      logger.info({ 
        executionId,
        triggerId: triggerConfig.id,
        totalTime: execution.totalExecutionTime,
        actionCount: triggerConfig.actions.length
      }, 'Workflow execution completed');

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.totalExecutionTime = execution.endTime.getTime() - execution.startTime.getTime();

      logger.error({ 
        error,
        executionId,
        triggerId: triggerConfig.id
      }, 'Workflow execution failed');
    } finally {
      this.runningExecutions.delete(executionId);
    }

    return executionId;
  }

  private async executeActions(
    actionIds: string[], 
    event: TriggerEvent, 
    execution: WorkflowExecution
  ): Promise<void> {
    for (const actionId of actionIds) {
      const action = this.actions.get(actionId);
      if (!action) {
        logger.warn({ actionId, executionId: execution.id }, 'Action not found');
        continue;
      }

      const actionExecution = execution.actions.find(a => a.actionId === actionId);
      if (!actionExecution) continue;

      try {
        actionExecution.status = 'running';
        actionExecution.startTime = new Date();

        // Create action context
        const context: ActionContext = {
          triggerId: execution.triggerId,
          triggerName: execution.triggerName,
          eventId: event.id,
          eventType: event.type,
          eventPayload: event.payload,
          timestamp: event.timestamp,
          metadata: event.metadata
        };

        // Execute action with retry
        const result = await action.executeWithRetry(context);

        actionExecution.status = result.success ? 'completed' : 'failed';
        actionExecution.endTime = new Date();
        actionExecution.executionTime = result.executionTime;
        actionExecution.error = result.error;
        actionExecution.output = result.output;

        if (!result.success) {
          logger.warn({ 
            actionId,
            executionId: execution.id,
            error: result.error
          }, 'Action execution failed');
        }

      } catch (error) {
        actionExecution.status = 'failed';
        actionExecution.endTime = new Date();
        actionExecution.error = error instanceof Error ? error.message : 'Unknown error';

        logger.error({ 
          error,
          actionId,
          executionId: execution.id
        }, 'Action execution threw error');
      }
    }
  }

  // Execution management
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  listExecutions(limit: number = 50): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    return executions
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  getRunningExecutions(): WorkflowExecution[] {
    return Array.from(this.runningExecutions)
      .map(id => this.executions.get(id))
      .filter((execution): execution is WorkflowExecution => !!execution);
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') {
      return false;
    }

    execution.status = 'failed';
    execution.endTime = new Date();
    execution.error = 'Execution cancelled';
    execution.totalExecutionTime = execution.endTime.getTime() - execution.startTime.getTime();

    this.runningExecutions.delete(executionId);

    logger.info({ executionId }, 'Workflow execution cancelled');
    return true;
  }

  // Metrics and monitoring
  getMetrics(): WorkflowMetrics {
    const executions = Array.from(this.executions.values());
    const completedExecutions = executions.filter(e => e.status === 'completed' || e.status === 'failed');

    const totalExecutions = completedExecutions.length;
    const successfulExecutions = completedExecutions.filter(e => e.status === 'completed').length;
    const failedExecutions = totalExecutions - successfulExecutions;

    const totalTime = completedExecutions.reduce((sum, e) => sum + (e.totalExecutionTime || 0), 0);
    const averageExecutionTime = totalExecutions > 0 ? totalTime / totalExecutions : 0;

    // Calculate trigger stats
    const triggerStats: Record<string, any> = {};
    for (const execution of completedExecutions) {
      if (!triggerStats[execution.triggerId]) {
        triggerStats[execution.triggerId] = {
          executions: 0,
          successful: 0,
          totalTime: 0
        };
      }
      
      const stats = triggerStats[execution.triggerId];
      stats.executions++;
      if (execution.status === 'completed') stats.successful++;
      stats.totalTime += execution.totalExecutionTime || 0;
    }

    // Convert to final format
    Object.keys(triggerStats).forEach(triggerId => {
      const stats = triggerStats[triggerId];
      triggerStats[triggerId] = {
        executions: stats.executions,
        successRate: (stats.successful / stats.executions) * 100,
        averageTime: stats.totalTime / stats.executions
      };
    });

    // Calculate action stats (simplified)
    const actionStats: Record<string, any> = {};

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: Math.round(averageExecutionTime),
      triggerStats,
      actionStats
    };
  }

  // Configuration and utility methods
  private setupEventListeners(): void {
    // Listen for external events
    eventBus.on('github-webhook-event', this.processEvent.bind(this));
    eventBus.on('manual-trigger-event', this.processEvent.bind(this));
  }

  private async initializeDefaults(): Promise<void> {
    // Register default triggers
    const prTrigger = new PRTrigger(PRTrigger.createConfig({
      id: 'default-pr-trigger',
      name: 'Default PR Trigger',
      description: 'Triggers on PR events',
      actions: ['pr-summary', 'pr-notification']
    }));
    this.registerTrigger(prTrigger);

    const commitTrigger = new CommitTrigger(CommitTrigger.createConfig({
      id: 'default-commit-trigger',
      name: 'Default Commit Trigger',
      description: 'Triggers on push events',
      actions: ['commit-notification']
    }));
    this.registerTrigger(commitTrigger);

    // Register default actions
    const prSummaryAction = new PRSummaryAction(PRSummaryAction.createConfig({
      id: 'pr-summary',
      name: 'PR Summary Generator',
      description: 'Generates automated PR summaries'
    }));
    this.registerAction(prSummaryAction);

    const notificationAction = new NotificationAction(NotificationAction.createConfig({
      id: 'pr-notification',
      name: 'PR Notification',
      description: 'Sends PR notifications',
      channels: [
        { type: 'slack', target: '#development', enabled: true }
      ]
    }));
    this.registerAction(notificationAction);
  }

  private async waitForExecutionsToComplete(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.runningExecutions.size > 0 && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.runningExecutions.size > 0) {
      logger.warn({ 
        runningExecutions: this.runningExecutions.size 
      }, 'Some executions did not complete before timeout');
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateConfig(config: Partial<WorkflowConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Workflow service configuration updated');
  }

  getConfig(): WorkflowConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
