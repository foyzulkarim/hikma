import { BaseAction, ActionContext, ActionConfig, ActionExecutionResult } from './base-action';
import { logger } from '@/core/utils/logger';

export interface NotificationConfig extends ActionConfig {
  metadata: {
    channels: Array<{
      type: 'email' | 'slack' | 'webhook' | 'teams' | 'discord';
      target: string; // email address, webhook URL, channel ID, etc.
      enabled: boolean;
    }>;
    messageTemplate?: string;
    subject?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    includeEventDetails?: boolean;
    rateLimitMinutes?: number; // Prevent spam
    conditions?: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
  };
}

export interface NotificationResult {
  channelResults: Array<{
    channel: string;
    type: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  message: string;
  totalSent: number;
  totalFailed: number;
}

export class NotificationAction extends BaseAction {
  private lastNotificationTimes = new Map<string, Date>();

  constructor(config: NotificationConfig) {
    super(config);
  }

  async execute(context: ActionContext): Promise<ActionExecutionResult> {
    try {
      this.validateContext(context);
      
      const config = this.config as NotificationConfig;
      
      // Check rate limiting
      if (!this.checkRateLimit(config)) {
        return {
          success: true,
          executionTime: 0,
          output: { message: 'Notification skipped due to rate limiting' },
          metadata: { rateLimited: true }
        };
      }

      // Check additional conditions
      if (!this.checkConditions(config, context)) {
        return {
          success: true,
          executionTime: 0,
          output: { message: 'Notification skipped due to conditions not met' },
          metadata: { conditionsNotMet: true }
        };
      }

      // Generate notification message
      const message = this.generateMessage(config, context);
      
      // Send notifications to all enabled channels
      const channelResults = await this.sendToChannels(config, message, context);
      
      // Update rate limiting
      this.updateRateLimit();

      const totalSent = channelResults.filter(r => r.success).length;
      const totalFailed = channelResults.filter(r => !r.success).length;

      const result: NotificationResult = {
        channelResults,
        message,
        totalSent,
        totalFailed
      };

      logger.info({ 
        actionId: this.config.id,
        totalSent,
        totalFailed,
        channels: channelResults.map(r => r.type)
      }, 'Notification sent');

      return {
        success: totalFailed === 0 || totalSent > 0, // Success if at least one channel worked
        executionTime: 0,
        output: result,
        metadata: {
          totalSent,
          totalFailed,
          channels: channelResults.length
        }
      };

    } catch (error) {
      logger.error({ error, actionId: this.config.id }, 'Notification action failed');
      throw error;
    }
  }

  private checkRateLimit(config: NotificationConfig): boolean {
    const rateLimitMinutes = config.metadata?.rateLimitMinutes;
    if (!rateLimitMinutes) return true;

    const lastNotification = this.lastNotificationTimes.get(this.config.id);
    if (!lastNotification) return true;

    const timeSinceLastNotification = Date.now() - lastNotification.getTime();
    const minutesSinceLastNotification = timeSinceLastNotification / (1000 * 60);

    return minutesSinceLastNotification >= rateLimitMinutes;
  }

  private checkConditions(config: NotificationConfig, context: ActionContext): boolean {
    const conditions = config.metadata?.conditions;
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = this.extractFromPayload(condition.field, context.eventPayload);
      return this.evaluateCondition(condition, fieldValue);
    });
  }

  private evaluateCondition(condition: any, fieldValue: any): boolean {
    const { operator, value } = condition;
    
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'not_contains':
        return !String(fieldValue).includes(String(value));
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        return true;
    }
  }

  private generateMessage(config: NotificationConfig, context: ActionContext): string {
    const template = config.metadata?.messageTemplate;
    
    if (template) {
      // Extract common variables from context
      const variables = this.extractVariables(context);
      return this.formatTemplate(template, variables);
    }

    // Default message format
    return this.generateDefaultMessage(context);
  }

  private extractVariables(context: ActionContext): Record<string, any> {
    const variables: Record<string, any> = {
      triggerName: context.triggerName,
      eventType: context.eventType,
      timestamp: context.timestamp.toISOString(),
      eventId: context.eventId
    };

    // Extract common fields from different event types
    const payload = context.eventPayload;

    // PR events
    if (payload.pullRequest || payload.pull_request) {
      const pr = payload.pullRequest || payload.pull_request;
      variables.prNumber = pr.number;
      variables.prTitle = pr.title;
      variables.prAuthor = pr.user?.login;
      variables.prUrl = pr.html_url;
      variables.action = payload.action;
    }

    // Issue events
    if (payload.issue) {
      variables.issueNumber = payload.issue.number;
      variables.issueTitle = payload.issue.title;
      variables.issueAuthor = payload.issue.user?.login;
      variables.issueUrl = payload.issue.html_url;
      variables.action = payload.action;
    }

    // Push events
    if (payload.commits) {
      variables.commitCount = payload.commits.length;
      variables.pusher = payload.pusher?.name;
      variables.branch = payload.ref?.replace('refs/heads/', '');
      variables.repository = payload.repository?.full_name;
    }

    // Repository info
    if (payload.repository) {
      variables.repository = payload.repository.full_name;
      variables.repositoryName = payload.repository.name;
      variables.repositoryOwner = payload.repository.owner?.login;
    }

    return variables;
  }

  private generateDefaultMessage(context: ActionContext): string {
    const eventType = context.eventType;
    const payload = context.eventPayload;

    switch (eventType) {
      case 'pull_request.opened':
        return `🔄 New PR opened: #${payload.pullRequest?.number} "${payload.pullRequest?.title}" by ${payload.pullRequest?.user?.login}`;
      
      case 'pull_request.closed':
        const merged = payload.pullRequest?.merged ? 'merged' : 'closed';
        return `✅ PR ${merged}: #${payload.pullRequest?.number} "${payload.pullRequest?.title}"`;
      
      case 'issues.opened':
        return `🐛 New issue opened: #${payload.issue?.number} "${payload.issue?.title}" by ${payload.issue?.user?.login}`;
      
      case 'issues.closed':
        return `✅ Issue closed: #${payload.issue?.number} "${payload.issue?.title}"`;
      
      case 'push':
        const commitCount = payload.commits?.length || 0;
        const branch = payload.ref?.replace('refs/heads/', '');
        return `📝 ${commitCount} commit(s) pushed to ${branch} by ${payload.pusher?.name}`;
      
      default:
        return `🔔 Workflow triggered: ${context.triggerName} (${eventType})`;
    }
  }

  private async sendToChannels(
    config: NotificationConfig, 
    message: string, 
    context: ActionContext
  ): Promise<Array<{
    channel: string;
    type: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>> {
    const channels = config.metadata?.channels || [];
    const enabledChannels = channels.filter(channel => channel.enabled);
    
    const results = await Promise.allSettled(
      enabledChannels.map(channel => this.sendToChannel(channel, message, config, context))
    );

    return results.map((result, index) => {
      const channel = enabledChannels[index];
      
      if (result.status === 'fulfilled') {
        return {
          channel: channel.target,
          type: channel.type,
          success: true,
          messageId: result.value.messageId
        };
      } else {
        return {
          channel: channel.target,
          type: channel.type,
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }

  private async sendToChannel(
    channel: any, 
    message: string, 
    config: NotificationConfig, 
    context: ActionContext
  ): Promise<{ messageId?: string }> {
    switch (channel.type) {
      case 'email':
        return this.sendEmail(channel.target, message, config, context);
      
      case 'slack':
        return this.sendSlack(channel.target, message, config, context);
      
      case 'webhook':
        return this.sendWebhook(channel.target, message, config, context);
      
      case 'teams':
        return this.sendTeams(channel.target, message, config, context);
      
      case 'discord':
        return this.sendDiscord(channel.target, message, config, context);
      
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  private async sendEmail(
    email: string, 
    message: string, 
    config: NotificationConfig, 
    context: ActionContext
  ): Promise<{ messageId?: string }> {
    // In a real implementation, this would integrate with an email service
    logger.info({ 
      actionId: this.config.id,
      email,
      subject: config.metadata?.subject || 'Workflow Notification'
    }, 'Would send email notification');
    
    return { messageId: `email_${Date.now()}` };
  }

  private async sendSlack(
    channel: string, 
    message: string, 
    config: NotificationConfig, 
    context: ActionContext
  ): Promise<{ messageId?: string }> {
    // In a real implementation, this would use Slack Web API
    logger.info({ 
      actionId: this.config.id,
      channel,
      messageLength: message.length
    }, 'Would send Slack notification');
    
    return { messageId: `slack_${Date.now()}` };
  }

  private async sendWebhook(
    url: string, 
    message: string, 
    config: NotificationConfig, 
    context: ActionContext
  ): Promise<{ messageId?: string }> {
    // In a real implementation, this would make HTTP POST request
    const payload = {
      message,
      trigger: context.triggerName,
      eventType: context.eventType,
      timestamp: context.timestamp.toISOString(),
      priority: config.metadata?.priority || 'normal'
    };

    logger.info({ 
      actionId: this.config.id,
      url,
      payload
    }, 'Would send webhook notification');
    
    return { messageId: `webhook_${Date.now()}` };
  }

  private async sendTeams(
    webhookUrl: string, 
    message: string, 
    config: NotificationConfig, 
    context: ActionContext
  ): Promise<{ messageId?: string }> {
    // In a real implementation, this would send to Microsoft Teams
    logger.info({ 
      actionId: this.config.id,
      webhookUrl,
      messageLength: message.length
    }, 'Would send Teams notification');
    
    return { messageId: `teams_${Date.now()}` };
  }

  private async sendDiscord(
    webhookUrl: string, 
    message: string, 
    config: NotificationConfig, 
    context: ActionContext
  ): Promise<{ messageId?: string }> {
    // In a real implementation, this would send to Discord
    logger.info({ 
      actionId: this.config.id,
      webhookUrl,
      messageLength: message.length
    }, 'Would send Discord notification');
    
    return { messageId: `discord_${Date.now()}` };
  }

  private updateRateLimit(): void {
    this.lastNotificationTimes.set(this.config.id, new Date());
  }

  // Helper method to create notification action configs
  static createConfig(options: {
    id: string;
    name: string;
    description: string;
    channels: Array<{
      type: 'email' | 'slack' | 'webhook' | 'teams' | 'discord';
      target: string;
      enabled?: boolean;
    }>;
    messageTemplate?: string;
    subject?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    includeEventDetails?: boolean;
    rateLimitMinutes?: number;
    conditions?: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
    enabled?: boolean;
    retryAttempts?: number;
    timeoutMs?: number;
  }): NotificationConfig {
    return {
      id: options.id,
      name: options.name,
      description: options.description,
      enabled: options.enabled ?? true,
      retryAttempts: options.retryAttempts ?? 2,
      timeoutMs: options.timeoutMs ?? 15000,
      metadata: {
        channels: options.channels.map(channel => ({
          ...channel,
          enabled: channel.enabled ?? true
        })),
        messageTemplate: options.messageTemplate,
        subject: options.subject,
        priority: options.priority ?? 'normal',
        includeEventDetails: options.includeEventDetails ?? true,
        rateLimitMinutes: options.rateLimitMinutes,
        conditions: options.conditions
      }
    };
  }
}
