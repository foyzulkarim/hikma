import { logger } from '@/core/utils/logger';
import { eventBus } from '@/shared/events/event-bus';

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
  appToken?: string;
  defaultChannel?: string;
  enabledFeatures: {
    notifications: boolean;
    commands: boolean;
    interactiveComponents: boolean;
    events: boolean;
  };
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
  threadTs?: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
}

export interface SlackCommand {
  command: string;
  text: string;
  userId: string;
  userName: string;
  channelId: string;
  channelName: string;
  teamId: string;
  teamDomain: string;
  responseUrl: string;
  triggerId: string;
}

export interface SlackInteraction {
  type: 'button_click' | 'menu_select' | 'dialog_submission';
  actionId: string;
  blockId?: string;
  value?: string;
  userId: string;
  channelId: string;
  messageTs: string;
  responseUrl: string;
}

export class SlackIntegration {
  private config: SlackConfig;
  private initialized = false;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Slack integration...');
      
      // Validate configuration
      this.validateConfig();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Test connection
      await this.testConnection();
      
      this.initialized = true;
      logger.info('Slack integration initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Slack integration');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up Slack integration...');
      this.initialized = false;
      logger.info('Slack integration cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup Slack integration');
    }
  }

  async sendMessage(message: SlackMessage): Promise<{ ts: string; channel: string }> {
    this.ensureInitialized();

    try {
      // In a real implementation, this would use Slack Web API
      logger.info({ 
        channel: message.channel,
        textLength: message.text.length,
        hasBlocks: !!message.blocks,
        hasAttachments: !!message.attachments
      }, 'Would send Slack message');

      // Simulate API response
      const response = {
        ts: `${Date.now()}.000001`,
        channel: message.channel
      };

      // Emit event for tracking
      eventBus.emit('slack-message-sent', {
        channel: message.channel,
        messageTs: response.ts,
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      logger.error({ error, message }, 'Failed to send Slack message');
      throw error;
    }
  }

  async updateMessage(
    channel: string, 
    messageTs: string, 
    message: Partial<SlackMessage>
  ): Promise<{ ts: string; channel: string }> {
    this.ensureInitialized();

    try {
      logger.info({ 
        channel,
        messageTs,
        updateFields: Object.keys(message)
      }, 'Would update Slack message');

      return { ts: messageTs, channel };
    } catch (error) {
      logger.error({ error, channel, messageTs }, 'Failed to update Slack message');
      throw error;
    }
  }

  async deleteMessage(channel: string, messageTs: string): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info({ channel, messageTs }, 'Would delete Slack message');
    } catch (error) {
      logger.error({ error, channel, messageTs }, 'Failed to delete Slack message');
      throw error;
    }
  }

  async handleCommand(command: SlackCommand): Promise<any> {
    this.ensureInitialized();

    try {
      logger.info({ 
        command: command.command,
        text: command.text,
        userId: command.userId,
        channelId: command.channelId
      }, 'Handling Slack command');

      // Route command to appropriate handler
      switch (command.command) {
        case '/hikma':
          return this.handleHikmaCommand(command);
        
        case '/deploy':
          return this.handleDeployCommand(command);
        
        case '/status':
          return this.handleStatusCommand(command);
        
        default:
          return {
            response_type: 'ephemeral',
            text: `Unknown command: ${command.command}`
          };
      }
    } catch (error) {
      logger.error({ error, command }, 'Failed to handle Slack command');
      return {
        response_type: 'ephemeral',
        text: 'Sorry, there was an error processing your command.'
      };
    }
  }

  async handleInteraction(interaction: SlackInteraction): Promise<any> {
    this.ensureInitialized();

    try {
      logger.info({ 
        type: interaction.type,
        actionId: interaction.actionId,
        userId: interaction.userId
      }, 'Handling Slack interaction');

      // Route interaction to appropriate handler
      switch (interaction.actionId) {
        case 'approve_deployment':
          return this.handleApprovalInteraction(interaction, true);
        
        case 'reject_deployment':
          return this.handleApprovalInteraction(interaction, false);
        
        case 'view_details':
          return this.handleViewDetailsInteraction(interaction);
        
        default:
          return {
            text: `Unknown interaction: ${interaction.actionId}`
          };
      }
    } catch (error) {
      logger.error({ error, interaction }, 'Failed to handle Slack interaction');
      return {
        text: 'Sorry, there was an error processing your interaction.'
      };
    }
  }

  // Notification helpers
  async sendWorkflowNotification(data: {
    type: 'pr_opened' | 'pr_merged' | 'deployment_started' | 'deployment_completed' | 'build_failed';
    title: string;
    description: string;
    url?: string;
    channel?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    metadata?: Record<string, any>;
  }): Promise<{ ts: string; channel: string }> {
    const channel = data.channel || this.config.defaultChannel;
    if (!channel) {
      throw new Error('No channel specified and no default channel configured');
    }

    const message = this.formatWorkflowNotification(data);
    return this.sendMessage({ ...message, channel });
  }

  async sendPRSummary(data: {
    prNumber: number;
    title: string;
    author: string;
    url: string;
    summary: string;
    complexity: string;
    riskLevel: string;
    channel?: string;
  }): Promise<{ ts: string; channel: string }> {
    const channel = data.channel || this.config.defaultChannel;
    if (!channel) {
      throw new Error('No channel specified and no default channel configured');
    }

    const blocks = this.createPRSummaryBlocks(data);
    return this.sendMessage({
      channel,
      text: `PR #${data.prNumber}: ${data.title}`,
      blocks
    });
  }

  async sendDeploymentApproval(data: {
    deploymentId: string;
    environment: string;
    version: string;
    requestedBy: string;
    channel?: string;
  }): Promise<{ ts: string; channel: string }> {
    const channel = data.channel || this.config.defaultChannel;
    if (!channel) {
      throw new Error('No channel specified and no default channel configured');
    }

    const blocks = this.createDeploymentApprovalBlocks(data);
    return this.sendMessage({
      channel,
      text: `Deployment approval requested for ${data.environment}`,
      blocks
    });
  }

  private validateConfig(): void {
    if (!this.config.botToken) {
      throw new Error('Slack bot token is required');
    }
    if (!this.config.signingSecret) {
      throw new Error('Slack signing secret is required');
    }
  }

  private setupEventListeners(): void {
    // Listen for workflow events to send notifications
    if (this.config.enabledFeatures.notifications) {
      eventBus.on('workflow-trigger-activated', this.handleWorkflowTrigger.bind(this));
      eventBus.on('workflow-action-completed', this.handleActionCompleted.bind(this));
      eventBus.on('workflow-action-failed', this.handleActionFailed.bind(this));
    }
  }

  private async testConnection(): Promise<void> {
    // In a real implementation, this would test the Slack API connection
    logger.info('Slack connection test would be performed here');
  }

  private async handleWorkflowTrigger(event: any): Promise<void> {
    if (!this.config.enabledFeatures.notifications) return;

    try {
      await this.sendWorkflowNotification({
        type: 'pr_opened', // This would be determined from event
        title: `Workflow Triggered: ${event.triggerName}`,
        description: `Event: ${event.eventId}`,
        priority: 'normal'
      });
    } catch (error) {
      logger.error({ error, event }, 'Failed to send workflow trigger notification');
    }
  }

  private async handleActionCompleted(event: any): Promise<void> {
    if (!this.config.enabledFeatures.notifications) return;

    // Only notify for important actions or failures
    if (event.actionName.includes('deployment') || event.actionName.includes('release')) {
      try {
        await this.sendWorkflowNotification({
          type: 'deployment_completed',
          title: `Action Completed: ${event.actionName}`,
          description: `Execution time: ${event.executionTime}ms`,
          priority: 'normal'
        });
      } catch (error) {
        logger.error({ error, event }, 'Failed to send action completed notification');
      }
    }
  }

  private async handleActionFailed(event: any): Promise<void> {
    if (!this.config.enabledFeatures.notifications) return;

    try {
      await this.sendWorkflowNotification({
        type: 'build_failed',
        title: `Action Failed: ${event.actionName}`,
        description: event.error || 'Unknown error',
        priority: 'high'
      });
    } catch (error) {
      logger.error({ error, event }, 'Failed to send action failed notification');
    }
  }

  private async handleHikmaCommand(command: SlackCommand): Promise<any> {
    const args = command.text.trim().split(' ');
    const subcommand = args[0];

    switch (subcommand) {
      case 'help':
        return {
          response_type: 'ephemeral',
          text: 'Available commands:\n• `/hikma status` - Show system status\n• `/hikma query <question>` - Ask a question\n• `/hikma help` - Show this help'
        };
      
      case 'status':
        return {
          response_type: 'in_channel',
          text: '🟢 Hikma is running normally\n• Agents: Active\n• Knowledge: Synced\n• Workflows: Enabled'
        };
      
      case 'query':
        const question = args.slice(1).join(' ');
        if (!question) {
          return {
            response_type: 'ephemeral',
            text: 'Please provide a question. Usage: `/hikma query <your question>`'
          };
        }
        
        // In a real implementation, this would integrate with the query system
        return {
          response_type: 'in_channel',
          text: `🤖 Processing query: "${question}"\nI'll get back to you with an answer shortly!`
        };
      
      default:
        return {
          response_type: 'ephemeral',
          text: `Unknown subcommand: ${subcommand}. Use \`/hikma help\` for available commands.`
        };
    }
  }

  private async handleDeployCommand(command: SlackCommand): Promise<any> {
    // Simplified deployment command handler
    return {
      response_type: 'ephemeral',
      text: 'Deployment commands are not yet implemented.'
    };
  }

  private async handleStatusCommand(command: SlackCommand): Promise<any> {
    // System status command
    return {
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*System Status* 🟢'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Agents:* Active'
            },
            {
              type: 'mrkdwn',
              text: '*Knowledge:* Synced'
            },
            {
              type: 'mrkdwn',
              text: '*Workflows:* Enabled'
            },
            {
              type: 'mrkdwn',
              text: '*Analytics:* Running'
            }
          ]
        }
      ]
    };
  }

  private async handleApprovalInteraction(interaction: SlackInteraction, approved: boolean): Promise<any> {
    // Handle deployment approval/rejection
    const action = approved ? 'approved' : 'rejected';
    
    // In a real implementation, this would trigger the actual deployment or cancellation
    logger.info({ 
      userId: interaction.userId,
      action,
      messageTs: interaction.messageTs
    }, 'Deployment approval interaction');

    return {
      text: `Deployment ${action} by <@${interaction.userId}>`
    };
  }

  private async handleViewDetailsInteraction(interaction: SlackInteraction): Promise<any> {
    // Show detailed information in a modal or ephemeral message
    return {
      response_type: 'ephemeral',
      text: 'Detailed information would be shown here.'
    };
  }

  private formatWorkflowNotification(data: any): Omit<SlackMessage, 'channel'> {
    const emoji = this.getNotificationEmoji(data.type);
    const color = this.getNotificationColor(data.priority);

    return {
      text: `${emoji} ${data.title}`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Description',
              value: data.description,
              short: false
            }
          ],
          footer: 'Hikma Workflow',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  private createPRSummaryBlocks(data: any): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*PR #${data.prNumber}: ${data.title}*\nBy ${data.author}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View PR'
          },
          url: data.url,
          action_id: 'view_pr'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Complexity:* ${data.complexity}`
          },
          {
            type: 'mrkdwn',
            text: `*Risk Level:* ${data.riskLevel}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:*\n${data.summary}`
        }
      }
    ];
  }

  private createDeploymentApprovalBlocks(data: any): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Deployment Approval Required*\n*Environment:* ${data.environment}\n*Version:* ${data.version}\n*Requested by:* ${data.requestedBy}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Approve'
            },
            style: 'primary',
            action_id: 'approve_deployment',
            value: data.deploymentId
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Reject'
            },
            style: 'danger',
            action_id: 'reject_deployment',
            value: data.deploymentId
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            action_id: 'view_details',
            value: data.deploymentId
          }
        ]
      }
    ];
  }

  private getNotificationEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      pr_opened: '🔄',
      pr_merged: '✅',
      deployment_started: '🚀',
      deployment_completed: '✅',
      build_failed: '❌'
    };
    return emojiMap[type] || '📢';
  }

  private getNotificationColor(priority: string = 'normal'): string {
    const colorMap: Record<string, string> = {
      low: '#36a64f',      // green
      normal: '#2196F3',   // blue
      high: '#ff9800',     // orange
      urgent: '#f44336'    // red
    };
    return colorMap[priority] || colorMap.normal;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Slack integration not initialized');
    }
  }

  // Configuration methods
  updateConfig(config: Partial<SlackConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Slack integration configuration updated');
  }

  getConfig(): SlackConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
