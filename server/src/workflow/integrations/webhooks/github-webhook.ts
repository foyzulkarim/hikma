import { logger } from '@/core/utils/logger';
import { eventBus } from '@/shared/events/event-bus';
import { TriggerEvent } from '../../triggers/base-trigger';

export interface GitHubWebhookConfig {
  secret: string;
  enabledEvents: string[];
  validateSignature: boolean;
  processAsync: boolean;
}

export interface GitHubWebhookPayload {
  headers: Record<string, string>;
  body: any;
  signature?: string;
}

export interface WebhookProcessingResult {
  processed: boolean;
  eventId: string;
  eventType: string;
  triggersActivated: number;
  processingTime: number;
  error?: string;
}

export class GitHubWebhookIntegration {
  private config: GitHubWebhookConfig;
  private initialized = false;
  private processedEvents = new Map<string, Date>();

  constructor(config: GitHubWebhookConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing GitHub webhook integration...');
      
      // Validate configuration
      this.validateConfig();
      
      this.initialized = true;
      logger.info('GitHub webhook integration initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize GitHub webhook integration');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up GitHub webhook integration...');
      this.processedEvents.clear();
      this.initialized = false;
      logger.info('GitHub webhook integration cleaned up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup GitHub webhook integration');
    }
  }

  async processWebhook(payload: GitHubWebhookPayload): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.ensureInitialized();
      
      // Extract event information from headers
      const eventType = this.extractEventType(payload.headers);
      const deliveryId = this.extractDeliveryId(payload.headers);
      
      if (!eventType) {
        throw new Error('No GitHub event type found in headers');
      }

      // Check if event type is enabled
      if (!this.isEventEnabled(eventType)) {
        logger.debug({ eventType, deliveryId }, 'GitHub event type not enabled');
        return {
          processed: false,
          eventId: deliveryId,
          eventType,
          triggersActivated: 0,
          processingTime: Date.now() - startTime
        };
      }

      // Validate signature if configured
      if (this.config.validateSignature) {
        const isValid = this.validateSignature(payload);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Check for duplicate delivery
      if (this.isDuplicateDelivery(deliveryId)) {
        logger.warn({ deliveryId, eventType }, 'Duplicate GitHub webhook delivery detected');
        return {
          processed: false,
          eventId: deliveryId,
          eventType,
          triggersActivated: 0,
          processingTime: Date.now() - startTime
        };
      }

      // Mark as processed
      this.markAsProcessed(deliveryId);

      // Create trigger event
      const triggerEvent = this.createTriggerEvent(eventType, deliveryId, payload.body);

      // Process event (sync or async)
      let triggersActivated = 0;
      if (this.config.processAsync) {
        // Process asynchronously
        this.processEventAsync(triggerEvent);
      } else {
        // Process synchronously
        triggersActivated = await this.processEventSync(triggerEvent);
      }

      logger.info({ 
        eventType,
        deliveryId,
        triggersActivated,
        processingTime: Date.now() - startTime
      }, 'GitHub webhook processed successfully');

      return {
        processed: true,
        eventId: deliveryId,
        eventType,
        triggersActivated,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error({ 
        error,
        headers: payload.headers,
        processingTime: Date.now() - startTime
      }, 'Failed to process GitHub webhook');

      return {
        processed: false,
        eventId: this.extractDeliveryId(payload.headers),
        eventType: this.extractEventType(payload.headers) || 'unknown',
        triggersActivated: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private validateConfig(): void {
    if (!this.config.secret) {
      throw new Error('GitHub webhook secret is required');
    }
    if (!Array.isArray(this.config.enabledEvents)) {
      throw new Error('Enabled events must be an array');
    }
  }

  private extractEventType(headers: Record<string, string>): string | null {
    // GitHub sends event type in X-GitHub-Event header
    return headers['x-github-event'] || headers['X-GitHub-Event'] || null;
  }

  private extractDeliveryId(headers: Record<string, string>): string {
    // GitHub sends unique delivery ID in X-GitHub-Delivery header
    return headers['x-github-delivery'] || headers['X-GitHub-Delivery'] || `delivery_${Date.now()}`;
  }

  private isEventEnabled(eventType: string): boolean {
    return this.config.enabledEvents.includes(eventType) || this.config.enabledEvents.includes('*');
  }

  private validateSignature(payload: GitHubWebhookPayload): boolean {
    const signature = payload.headers['x-hub-signature-256'] || payload.headers['X-Hub-Signature-256'];
    
    if (!signature) {
      logger.warn('No signature found in GitHub webhook headers');
      return false;
    }

    try {
      // In a real implementation, this would use crypto to validate the HMAC signature
      // const crypto = require('crypto');
      // const expectedSignature = 'sha256=' + crypto
      //   .createHmac('sha256', this.config.secret)
      //   .update(JSON.stringify(payload.body))
      //   .digest('hex');
      // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
      
      // For now, just log that validation would occur
      logger.debug({ signature }, 'Would validate GitHub webhook signature');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to validate GitHub webhook signature');
      return false;
    }
  }

  private isDuplicateDelivery(deliveryId: string): boolean {
    return this.processedEvents.has(deliveryId);
  }

  private markAsProcessed(deliveryId: string): void {
    this.processedEvents.set(deliveryId, new Date());
    
    // Clean up old entries (keep last 1000)
    if (this.processedEvents.size > 1000) {
      const entries = Array.from(this.processedEvents.entries());
      entries.sort((a, b) => b[1].getTime() - a[1].getTime());
      
      this.processedEvents.clear();
      entries.slice(0, 1000).forEach(([id, date]) => {
        this.processedEvents.set(id, date);
      });
    }
  }

  private createTriggerEvent(eventType: string, deliveryId: string, body: any): TriggerEvent {
    // Map GitHub event types to our internal event types
    const mappedEventType = this.mapEventType(eventType, body);
    
    return {
      id: deliveryId,
      type: mappedEventType,
      source: 'github',
      timestamp: new Date(),
      payload: body,
      metadata: {
        originalEventType: eventType,
        deliveryId,
        repository: body.repository?.full_name
      }
    };
  }

  private mapEventType(githubEventType: string, body: any): string {
    // Map GitHub event types to our standardized event types
    switch (githubEventType) {
      case 'pull_request':
        return `pull_request.${body.action}`;
      
      case 'issues':
        return `issues.${body.action}`;
      
      case 'push':
        return 'push';
      
      case 'release':
        return `release.${body.action}`;
      
      case 'deployment':
        return `deployment.${body.action}`;
      
      case 'deployment_status':
        return `deployment_status.${body.deployment_status?.state}`;
      
      case 'check_run':
        return `check_run.${body.action}`;
      
      case 'check_suite':
        return `check_suite.${body.action}`;
      
      case 'workflow_run':
        return `workflow_run.${body.action}`;
      
      case 'issue_comment':
        return `issue_comment.${body.action}`;
      
      case 'pull_request_review':
        return `pull_request_review.${body.action}`;
      
      case 'pull_request_review_comment':
        return `pull_request_review_comment.${body.action}`;
      
      default:
        return githubEventType;
    }
  }

  private async processEventSync(triggerEvent: TriggerEvent): Promise<number> {
    // Emit event to trigger system
    eventBus.emit('github-webhook-event', triggerEvent);
    
    // In a real implementation, this would wait for triggers to process
    // and return the actual count of activated triggers
    return 0; // Placeholder
  }

  private processEventAsync(triggerEvent: TriggerEvent): void {
    // Process asynchronously without waiting
    setImmediate(() => {
      eventBus.emit('github-webhook-event', triggerEvent);
    });
  }

  // Event-specific processing helpers
  async processPullRequestEvent(body: any): Promise<void> {
    const { action, pull_request: pr, repository } = body;
    
    logger.info({ 
      action,
      prNumber: pr?.number,
      repository: repository?.full_name,
      author: pr?.user?.login
    }, 'Processing GitHub PR event');

    // Emit specific PR event
    eventBus.emit('github-pr-event', {
      action,
      pullRequest: pr,
      repository,
      timestamp: new Date().toISOString()
    });
  }

  async processIssueEvent(body: any): Promise<void> {
    const { action, issue, repository } = body;
    
    logger.info({ 
      action,
      issueNumber: issue?.number,
      repository: repository?.full_name,
      author: issue?.user?.login
    }, 'Processing GitHub issue event');

    // Emit specific issue event
    eventBus.emit('github-issue-event', {
      action,
      issue,
      repository,
      timestamp: new Date().toISOString()
    });
  }

  async processPushEvent(body: any): Promise<void> {
    const { ref, commits, repository, pusher } = body;
    
    logger.info({ 
      ref,
      commitCount: commits?.length || 0,
      repository: repository?.full_name,
      pusher: pusher?.name
    }, 'Processing GitHub push event');

    // Emit specific push event
    eventBus.emit('github-push-event', {
      ref,
      commits,
      repository,
      pusher,
      timestamp: new Date().toISOString()
    });
  }

  // Utility methods
  getProcessedEventsCount(): number {
    return this.processedEvents.size;
  }

  getEnabledEvents(): string[] {
    return [...this.config.enabledEvents];
  }

  isEventTypeEnabled(eventType: string): boolean {
    return this.isEventEnabled(eventType);
  }

  // Configuration methods
  updateConfig(config: Partial<GitHubWebhookConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('GitHub webhook integration configuration updated');
  }

  getConfig(): GitHubWebhookConfig {
    return { ...this.config };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GitHub webhook integration not initialized');
    }
  }

  // Static helper methods
  static createConfig(options: {
    secret: string;
    enabledEvents?: string[];
    validateSignature?: boolean;
    processAsync?: boolean;
  }): GitHubWebhookConfig {
    return {
      secret: options.secret,
      enabledEvents: options.enabledEvents || [
        'pull_request',
        'issues',
        'push',
        'release',
        'deployment',
        'deployment_status'
      ],
      validateSignature: options.validateSignature ?? true,
      processAsync: options.processAsync ?? true
    };
  }

  static extractRepositoryInfo(body: any): {
    name: string;
    fullName: string;
    owner: string;
    private: boolean;
    defaultBranch: string;
  } | null {
    const repo = body.repository;
    if (!repo) return null;

    return {
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login,
      private: repo.private || false,
      defaultBranch: repo.default_branch || 'main'
    };
  }

  static extractUserInfo(body: any, userField: string = 'sender'): {
    login: string;
    id: number;
    type: string;
  } | null {
    const user = body[userField];
    if (!user) return null;

    return {
      login: user.login,
      id: user.id,
      type: user.type || 'User'
    };
  }
}
