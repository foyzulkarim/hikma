import { BaseTrigger, TriggerEvent, TriggerConfig } from './base-trigger';
import { logger } from '@/core/utils/logger';

export interface IssueEventPayload {
  action: 'opened' | 'closed' | 'reopened' | 'assigned' | 'unassigned' | 'labeled' | 'unlabeled' | 'edited';
  issue: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    user: {
      login: string;
      id: number;
    };
    assignees: Array<{
      login: string;
      id: number;
    }>;
    labels: Array<{
      name: string;
      color: string;
    }>;
    milestone: {
      title: string;
      number: number;
    } | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
  };
  repository: {
    name: string;
    fullName: string;
    owner: {
      login: string;
    };
  };
  assignee?: {
    login: string;
    id: number;
  };
  label?: {
    name: string;
    color: string;
  };
}

export class IssueTrigger extends BaseTrigger {
  constructor(config: TriggerConfig) {
    super(config);
  }

  getEventTypes(): string[] {
    return [
      'issues.opened',
      'issues.closed',
      'issues.reopened',
      'issues.assigned',
      'issues.unassigned',
      'issues.labeled',
      'issues.unlabeled',
      'issues.edited'
    ];
  }

  async shouldTrigger(event: TriggerEvent): Promise<boolean> {
    try {
      // Validate event type
      if (!this.getEventTypes().includes(event.type)) {
        return false;
      }

      const payload = event.payload as IssueEventPayload;
      
      // Validate payload structure
      if (!payload.issue || !payload.repository) {
        logger.warn({ eventId: event.id }, 'Invalid issue event payload structure');
        return false;
      }

      // Apply custom conditions
      const conditionsMatch = this.evaluateConditions(event);
      
      if (!conditionsMatch) {
        logger.debug({ 
          eventId: event.id, 
          issueNumber: payload.issue.number 
        }, 'Issue trigger conditions not met');
        return false;
      }

      // Additional issue-specific logic
      return this.evaluateIssueSpecificConditions(payload);

    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Error evaluating issue trigger conditions');
      return false;
    }
  }

  private evaluateIssueSpecificConditions(payload: IssueEventPayload): boolean {
    const { issue, action } = payload;

    // Label-based filtering
    const requiredLabels = this.config.metadata?.requiredLabels as string[];
    if (requiredLabels && requiredLabels.length > 0) {
      const issueLabels = issue.labels.map(label => label.name);
      const hasRequiredLabel = requiredLabels.some(label => 
        issueLabels.includes(label)
      );
      
      if (!hasRequiredLabel) {
        logger.debug({ 
          issueNumber: issue.number,
          issueLabels,
          requiredLabels 
        }, 'Issue missing required labels');
        return false;
      }
    }

    // Skip issues with certain labels
    const skipLabels = this.config.metadata?.skipLabels as string[];
    if (skipLabels && skipLabels.length > 0) {
      const issueLabels = issue.labels.map(label => label.name);
      const hasSkipLabel = skipLabels.some(label => 
        issueLabels.includes(label)
      );
      
      if (hasSkipLabel) {
        logger.debug({ 
          issueNumber: issue.number,
          skipLabels 
        }, 'Issue has skip label');
        return false;
      }
    }

    // Author-based filtering
    const authorConditions = this.config.metadata?.authorConditions;
    if (authorConditions) {
      const author = issue.user.login;
      
      if (authorConditions.include && authorConditions.include.length > 0) {
        if (!authorConditions.include.includes(author)) {
          logger.debug({ 
            issueNumber: issue.number,
            author,
            includeAuthors: authorConditions.include 
          }, 'Issue author not in include list');
          return false;
        }
      }
      
      if (authorConditions.exclude && authorConditions.exclude.includes(author)) {
        logger.debug({ 
          issueNumber: issue.number,
          author,
          excludeAuthors: authorConditions.exclude 
        }, 'Issue author in exclude list');
        return false;
      }
    }

    // Assignee-based filtering
    const assigneeConditions = this.config.metadata?.assigneeConditions;
    if (assigneeConditions) {
      const assignees = issue.assignees.map(assignee => assignee.login);
      
      if (assigneeConditions.requireAssigned && assignees.length === 0) {
        logger.debug({ 
          issueNumber: issue.number 
        }, 'Issue requires assignee but none found');
        return false;
      }
      
      if (assigneeConditions.include && assigneeConditions.include.length > 0) {
        const hasIncludedAssignee = assignees.some(assignee => 
          assigneeConditions.include!.includes(assignee)
        );
        if (!hasIncludedAssignee) {
          logger.debug({ 
            issueNumber: issue.number,
            assignees,
            includeAssignees: assigneeConditions.include 
          }, 'Issue assignee not in include list');
          return false;
        }
      }
    }

    // Milestone-based filtering
    const milestoneConditions = this.config.metadata?.milestoneConditions;
    if (milestoneConditions) {
      if (milestoneConditions.requireMilestone && !issue.milestone) {
        logger.debug({ 
          issueNumber: issue.number 
        }, 'Issue requires milestone but none found');
        return false;
      }
      
      if (milestoneConditions.include && milestoneConditions.include.length > 0) {
        const milestoneName = issue.milestone?.title;
        if (!milestoneName || !milestoneConditions.include.includes(milestoneName)) {
          logger.debug({ 
            issueNumber: issue.number,
            milestone: milestoneName,
            includeMilestones: milestoneConditions.include 
          }, 'Issue milestone not in include list');
          return false;
        }
      }
    }

    // Title/body pattern matching
    const contentPatterns = this.config.metadata?.contentPatterns as {
      titleInclude?: string[];
      titleExclude?: string[];
      bodyInclude?: string[];
      bodyExclude?: string[];
    };
    
    if (contentPatterns) {
      // Title patterns
      if (contentPatterns.titleInclude && contentPatterns.titleInclude.length > 0) {
        const hasIncludedPattern = contentPatterns.titleInclude.some(pattern => 
          this.matchesPattern(issue.title, pattern)
        );
        if (!hasIncludedPattern) {
          logger.debug({ 
            issueNumber: issue.number,
            title: issue.title,
            includePatterns: contentPatterns.titleInclude 
          }, 'Issue title does not match include patterns');
          return false;
        }
      }
      
      if (contentPatterns.titleExclude && contentPatterns.titleExclude.length > 0) {
        const hasExcludedPattern = contentPatterns.titleExclude.some(pattern => 
          this.matchesPattern(issue.title, pattern)
        );
        if (hasExcludedPattern) {
          logger.debug({ 
            issueNumber: issue.number,
            title: issue.title,
            excludePatterns: contentPatterns.titleExclude 
          }, 'Issue title matches exclude pattern');
          return false;
        }
      }
      
      // Body patterns
      if (contentPatterns.bodyInclude && contentPatterns.bodyInclude.length > 0) {
        const hasIncludedPattern = contentPatterns.bodyInclude.some(pattern => 
          this.matchesPattern(issue.body || '', pattern)
        );
        if (!hasIncludedPattern) {
          logger.debug({ 
            issueNumber: issue.number,
            includePatterns: contentPatterns.bodyInclude 
          }, 'Issue body does not match include patterns');
          return false;
        }
      }
      
      if (contentPatterns.bodyExclude && contentPatterns.bodyExclude.length > 0) {
        const hasExcludedPattern = contentPatterns.bodyExclude.some(pattern => 
          this.matchesPattern(issue.body || '', pattern)
        );
        if (hasExcludedPattern) {
          logger.debug({ 
            issueNumber: issue.number,
            excludePatterns: contentPatterns.bodyExclude 
          }, 'Issue body matches exclude pattern');
          return false;
        }
      }
    }

    return true;
  }

  private matchesPattern(text: string, pattern: string): boolean {
    // Support regex patterns
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      try {
        const regex = new RegExp(pattern.slice(1, -1), 'i');
        return regex.test(text);
      } catch {
        return false;
      }
    }
    
    // Simple substring match
    return text.toLowerCase().includes(pattern.toLowerCase());
  }

  // Helper method to create issue-specific trigger configs
  static createConfig(options: {
    id: string;
    name: string;
    description: string;
    actions: string[];
    issueActions?: Array<'opened' | 'closed' | 'reopened' | 'assigned' | 'labeled'>;
    requiredLabels?: string[];
    skipLabels?: string[];
    authorConditions?: {
      include?: string[];
      exclude?: string[];
    };
    assigneeConditions?: {
      requireAssigned?: boolean;
      include?: string[];
    };
    milestoneConditions?: {
      requireMilestone?: boolean;
      include?: string[];
    };
    contentPatterns?: {
      titleInclude?: string[];
      titleExclude?: string[];
      bodyInclude?: string[];
      bodyExclude?: string[];
    };
    enabled?: boolean;
    cooldownMs?: number;
  }): TriggerConfig {
    const conditions: any[] = [];

    // Add action conditions
    if (options.issueActions && options.issueActions.length > 0) {
      conditions.push({
        field: 'payload.action',
        operator: 'equals' as const,
        value: options.issueActions[0] // For multiple actions, we'd need OR logic
      });
    }

    return {
      id: options.id,
      name: options.name,
      description: options.description,
      enabled: options.enabled ?? true,
      conditions,
      actions: options.actions,
      cooldownMs: options.cooldownMs,
      metadata: {
        requiredLabels: options.requiredLabels,
        skipLabels: options.skipLabels,
        authorConditions: options.authorConditions,
        assigneeConditions: options.assigneeConditions,
        milestoneConditions: options.milestoneConditions,
        contentPatterns: options.contentPatterns
      }
    };
  }

  // Extract useful information for actions
  extractIssueInfo(event: TriggerEvent): {
    issueNumber: number;
    title: string;
    author: string;
    assignees: string[];
    labels: string[];
    milestone: string | null;
    state: string;
    action: string;
    repository: string;
    createdAt: string;
    updatedAt: string;
  } | null {
    try {
      const payload = event.payload as IssueEventPayload;
      const { issue } = payload;

      return {
        issueNumber: issue.number,
        title: issue.title,
        author: issue.user.login,
        assignees: issue.assignees.map(assignee => assignee.login),
        labels: issue.labels.map(label => label.name),
        milestone: issue.milestone?.title || null,
        state: issue.state,
        action: payload.action,
        repository: payload.repository.fullName,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt
      };
    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Failed to extract issue info');
      return null;
    }
  }
}
