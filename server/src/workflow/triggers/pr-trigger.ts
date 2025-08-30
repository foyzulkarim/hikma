import { BaseTrigger, TriggerEvent, TriggerConfig } from './base-trigger';
import { logger } from '@/core/utils/logger';

export interface PREventPayload {
  action: 'opened' | 'closed' | 'synchronize' | 'ready_for_review' | 'converted_to_draft';
  pullRequest: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    draft: boolean;
    mergeable: boolean | null;
    merged: boolean;
    user: {
      login: string;
      id: number;
    };
    assignees: Array<{
      login: string;
      id: number;
    }>;
    reviewers: Array<{
      login: string;
      id: number;
    }>;
    labels: Array<{
      name: string;
      color: string;
    }>;
    base: {
      ref: string;
      sha: string;
    };
    head: {
      ref: string;
      sha: string;
    };
    changedFiles: number;
    additions: number;
    deletions: number;
    commits: number;
  };
  repository: {
    name: string;
    fullName: string;
    owner: {
      login: string;
    };
  };
}

export class PRTrigger extends BaseTrigger {
  constructor(config: TriggerConfig) {
    super(config);
  }

  getEventTypes(): string[] {
    return [
      'pull_request.opened',
      'pull_request.closed',
      'pull_request.synchronize',
      'pull_request.ready_for_review',
      'pull_request.converted_to_draft'
    ];
  }

  async shouldTrigger(event: TriggerEvent): Promise<boolean> {
    try {
      // Validate event type
      if (!this.getEventTypes().includes(event.type)) {
        return false;
      }

      const payload = event.payload as PREventPayload;
      
      // Validate payload structure
      if (!payload.pullRequest || !payload.repository) {
        logger.warn({ eventId: event.id }, 'Invalid PR event payload structure');
        return false;
      }

      // Apply custom conditions
      const conditionsMatch = this.evaluateConditions(event);
      
      if (!conditionsMatch) {
        logger.debug({ 
          eventId: event.id, 
          prNumber: payload.pullRequest.number 
        }, 'PR trigger conditions not met');
        return false;
      }

      // Additional PR-specific logic
      return this.evaluatePRSpecificConditions(payload);

    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Error evaluating PR trigger conditions');
      return false;
    }
  }

  private evaluatePRSpecificConditions(payload: PREventPayload): boolean {
    const { pullRequest, action } = payload;

    // Skip draft PRs for certain actions unless explicitly configured
    if (pullRequest.draft && action !== 'ready_for_review') {
      const allowDrafts = this.config.metadata?.allowDraftPRs === true;
      if (!allowDrafts) {
        logger.debug({ 
          prNumber: pullRequest.number 
        }, 'Skipping draft PR');
        return false;
      }
    }

    // Skip PRs with certain labels if configured
    const skipLabels = this.config.metadata?.skipLabels as string[] || [];
    if (skipLabels.length > 0) {
      const hasSkipLabel = pullRequest.labels.some(label => 
        skipLabels.includes(label.name)
      );
      
      if (hasSkipLabel) {
        logger.debug({ 
          prNumber: pullRequest.number,
          skipLabels 
        }, 'PR has skip label');
        return false;
      }
    }

    // Only trigger for specific branches if configured
    const targetBranches = this.config.metadata?.targetBranches as string[];
    if (targetBranches && targetBranches.length > 0) {
      if (!targetBranches.includes(pullRequest.base.ref)) {
        logger.debug({ 
          prNumber: pullRequest.number,
          baseBranch: pullRequest.base.ref,
          targetBranches 
        }, 'PR base branch not in target branches');
        return false;
      }
    }

    // Size-based filtering
    const maxChangedFiles = this.config.metadata?.maxChangedFiles as number;
    if (maxChangedFiles && pullRequest.changedFiles > maxChangedFiles) {
      logger.debug({ 
        prNumber: pullRequest.number,
        changedFiles: pullRequest.changedFiles,
        maxChangedFiles 
      }, 'PR exceeds maximum changed files');
      return false;
    }

    const maxChanges = this.config.metadata?.maxChanges as number;
    if (maxChanges) {
      const totalChanges = pullRequest.additions + pullRequest.deletions;
      if (totalChanges > maxChanges) {
        logger.debug({ 
          prNumber: pullRequest.number,
          totalChanges,
          maxChanges 
        }, 'PR exceeds maximum changes');
        return false;
      }
    }

    return true;
  }

  // Helper method to create PR-specific trigger configs
  static createConfig(options: {
    id: string;
    name: string;
    description: string;
    actions: string[];
    prActions?: Array<'opened' | 'closed' | 'synchronize' | 'ready_for_review'>;
    targetBranches?: string[];
    skipLabels?: string[];
    allowDraftPRs?: boolean;
    maxChangedFiles?: number;
    maxChanges?: number;
    authorConditions?: {
      include?: string[];
      exclude?: string[];
    };
    enabled?: boolean;
    cooldownMs?: number;
  }): TriggerConfig {
    const conditions: any[] = [];

    // Add action conditions
    if (options.prActions && options.prActions.length > 0) {
      conditions.push({
        field: 'payload.action',
        operator: 'equals' as const,
        value: options.prActions[0] // For multiple actions, we'd need OR logic
      });
    }

    // Add author conditions
    if (options.authorConditions?.include) {
      options.authorConditions.include.forEach(author => {
        conditions.push({
          field: 'payload.pullRequest.user.login',
          operator: 'equals' as const,
          value: author
        });
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
        targetBranches: options.targetBranches,
        skipLabels: options.skipLabels,
        allowDraftPRs: options.allowDraftPRs,
        maxChangedFiles: options.maxChangedFiles,
        maxChanges: options.maxChanges,
        authorConditions: options.authorConditions
      }
    };
  }

  // Extract useful information for actions
  extractPRInfo(event: TriggerEvent): {
    prNumber: number;
    title: string;
    author: string;
    baseBranch: string;
    headBranch: string;
    changedFiles: number;
    additions: number;
    deletions: number;
    labels: string[];
    isDraft: boolean;
    action: string;
  } | null {
    try {
      const payload = event.payload as PREventPayload;
      const { pullRequest } = payload;

      return {
        prNumber: pullRequest.number,
        title: pullRequest.title,
        author: pullRequest.user.login,
        baseBranch: pullRequest.base.ref,
        headBranch: pullRequest.head.ref,
        changedFiles: pullRequest.changedFiles,
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
        labels: pullRequest.labels.map(label => label.name),
        isDraft: pullRequest.draft,
        action: payload.action
      };
    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Failed to extract PR info');
      return null;
    }
  }
}
