// Export main workflow service
export { WorkflowService } from './services/workflow-service';
export type { 
  WorkflowConfig,
  WorkflowExecution,
  WorkflowMetrics
} from './services/workflow-service';

// Export triggers
export * from './triggers';

// Export actions
export * from './actions';

// Export integrations
export { SlackIntegration } from './integrations/chatops/slack-integration';
export type { 
  SlackConfig,
  SlackMessage,
  SlackCommand,
  SlackInteraction
} from './integrations/chatops/slack-integration';

export { GitHubWebhookIntegration } from './integrations/webhooks/github-webhook';
export type { 
  GitHubWebhookConfig,
  GitHubWebhookPayload,
  WebhookProcessingResult
} from './integrations/webhooks/github-webhook';
