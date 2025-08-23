import { BaseTrigger, TriggerEvent, TriggerConfig } from './base-trigger';
import { logger } from '@/core/utils/logger';

export interface CommitEventPayload {
  ref: string; // e.g., "refs/heads/main"
  before: string; // SHA of previous commit
  after: string; // SHA of new commit
  created: boolean;
  deleted: boolean;
  forced: boolean;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    committer: {
      name: string;
      email: string;
      username?: string;
    };
    timestamp: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  headCommit: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    committer: {
      name: string;
      email: string;
      username?: string;
    };
    timestamp: string;
    added: string[];
    removed: string[];
    modified: string[];
  };
  repository: {
    name: string;
    fullName: string;
    owner: {
      login: string;
    };
    defaultBranch: string;
  };
  pusher: {
    name: string;
    email: string;
  };
}

export class CommitTrigger extends BaseTrigger {
  constructor(config: TriggerConfig) {
    super(config);
  }

  getEventTypes(): string[] {
    return ['push'];
  }

  async shouldTrigger(event: TriggerEvent): Promise<boolean> {
    try {
      // Validate event type
      if (!this.getEventTypes().includes(event.type)) {
        return false;
      }

      const payload = event.payload as CommitEventPayload;
      
      // Validate payload structure
      if (!payload.commits || !payload.repository) {
        logger.warn({ eventId: event.id }, 'Invalid commit event payload structure');
        return false;
      }

      // Skip deleted branches unless configured otherwise
      if (payload.deleted && !this.config.metadata?.includeBranchDeletions) {
        logger.debug({ eventId: event.id, ref: payload.ref }, 'Skipping branch deletion');
        return false;
      }

      // Skip empty pushes unless configured otherwise
      if (payload.commits.length === 0 && !this.config.metadata?.includeEmptyPushes) {
        logger.debug({ eventId: event.id, ref: payload.ref }, 'Skipping empty push');
        return false;
      }

      // Apply custom conditions
      const conditionsMatch = this.evaluateConditions(event);
      
      if (!conditionsMatch) {
        logger.debug({ 
          eventId: event.id, 
          ref: payload.ref 
        }, 'Commit trigger conditions not met');
        return false;
      }

      // Additional commit-specific logic
      return this.evaluateCommitSpecificConditions(payload);

    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Error evaluating commit trigger conditions');
      return false;
    }
  }

  private evaluateCommitSpecificConditions(payload: CommitEventPayload): boolean {
    // Extract branch name from ref
    const branchName = this.extractBranchName(payload.ref);
    
    // Only trigger for specific branches if configured
    const targetBranches = this.config.metadata?.targetBranches as string[];
    if (targetBranches && targetBranches.length > 0) {
      if (!targetBranches.includes(branchName)) {
        logger.debug({ 
          ref: payload.ref,
          branchName,
          targetBranches 
        }, 'Branch not in target branches');
        return false;
      }
    }

    // Skip certain branches if configured
    const skipBranches = this.config.metadata?.skipBranches as string[];
    if (skipBranches && skipBranches.includes(branchName)) {
      logger.debug({ 
        ref: payload.ref,
        branchName,
        skipBranches 
      }, 'Branch in skip list');
      return false;
    }

    // Author-based filtering
    const authorConditions = this.config.metadata?.authorConditions;
    if (authorConditions) {
      const authors = payload.commits.map(commit => 
        commit.author.username || commit.author.email
      );
      
      if (authorConditions.include && authorConditions.include.length > 0) {
        const hasIncludedAuthor = authors.some(author => 
          authorConditions.include!.includes(author)
        );
        if (!hasIncludedAuthor) {
          logger.debug({ authors, includeAuthors: authorConditions.include }, 'No included authors found');
          return false;
        }
      }
      
      if (authorConditions.exclude && authorConditions.exclude.length > 0) {
        const hasExcludedAuthor = authors.some(author => 
          authorConditions.exclude!.includes(author)
        );
        if (hasExcludedAuthor) {
          logger.debug({ authors, excludeAuthors: authorConditions.exclude }, 'Excluded author found');
          return false;
        }
      }
    }

    // File pattern filtering
    const filePatterns = this.config.metadata?.filePatterns as {
      include?: string[];
      exclude?: string[];
    };
    
    if (filePatterns) {
      const allFiles = this.getAllChangedFiles(payload);
      
      if (filePatterns.include && filePatterns.include.length > 0) {
        const hasIncludedFile = allFiles.some(file => 
          filePatterns.include!.some(pattern => this.matchesPattern(file, pattern))
        );
        if (!hasIncludedFile) {
          logger.debug({ files: allFiles, includePatterns: filePatterns.include }, 'No included files found');
          return false;
        }
      }
      
      if (filePatterns.exclude && filePatterns.exclude.length > 0) {
        const hasExcludedFile = allFiles.some(file => 
          filePatterns.exclude!.some(pattern => this.matchesPattern(file, pattern))
        );
        if (hasExcludedFile) {
          logger.debug({ files: allFiles, excludePatterns: filePatterns.exclude }, 'Excluded file found');
          return false;
        }
      }
    }

    // Commit message filtering
    const messagePatterns = this.config.metadata?.messagePatterns as {
      include?: string[];
      exclude?: string[];
    };
    
    if (messagePatterns) {
      const messages = payload.commits.map(commit => commit.message);
      
      if (messagePatterns.include && messagePatterns.include.length > 0) {
        const hasIncludedMessage = messages.some(message => 
          messagePatterns.include!.some(pattern => this.matchesPattern(message, pattern))
        );
        if (!hasIncludedMessage) {
          logger.debug({ messages, includePatterns: messagePatterns.include }, 'No included message patterns found');
          return false;
        }
      }
      
      if (messagePatterns.exclude && messagePatterns.exclude.length > 0) {
        const hasExcludedMessage = messages.some(message => 
          messagePatterns.exclude!.some(pattern => this.matchesPattern(message, pattern))
        );
        if (hasExcludedMessage) {
          logger.debug({ messages, excludePatterns: messagePatterns.exclude }, 'Excluded message pattern found');
          return false;
        }
      }
    }

    // Size-based filtering
    const maxCommits = this.config.metadata?.maxCommits as number;
    if (maxCommits && payload.commits.length > maxCommits) {
      logger.debug({ 
        commitCount: payload.commits.length,
        maxCommits 
      }, 'Push exceeds maximum commits');
      return false;
    }

    return true;
  }

  private extractBranchName(ref: string): string {
    // Extract branch name from refs/heads/branch-name
    return ref.replace('refs/heads/', '');
  }

  private getAllChangedFiles(payload: CommitEventPayload): string[] {
    const files = new Set<string>();
    
    payload.commits.forEach(commit => {
      commit.added.forEach(file => files.add(file));
      commit.modified.forEach(file => files.add(file));
      commit.removed.forEach(file => files.add(file));
    });
    
    return Array.from(files);
  }

  private matchesPattern(text: string, pattern: string): boolean {
    // Support glob-like patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(text);
    }
    
    // Simple substring match
    return text.toLowerCase().includes(pattern.toLowerCase());
  }

  // Helper method to create commit-specific trigger configs
  static createConfig(options: {
    id: string;
    name: string;
    description: string;
    actions: string[];
    targetBranches?: string[];
    skipBranches?: string[];
    filePatterns?: {
      include?: string[];
      exclude?: string[];
    };
    messagePatterns?: {
      include?: string[];
      exclude?: string[];
    };
    authorConditions?: {
      include?: string[];
      exclude?: string[];
    };
    maxCommits?: number;
    includeBranchDeletions?: boolean;
    includeEmptyPushes?: boolean;
    enabled?: boolean;
    cooldownMs?: number;
  }): TriggerConfig {
    const conditions: any[] = [];

    // Add basic push event condition
    conditions.push({
      field: 'type',
      operator: 'equals' as const,
      value: 'push'
    });

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
        skipBranches: options.skipBranches,
        filePatterns: options.filePatterns,
        messagePatterns: options.messagePatterns,
        authorConditions: options.authorConditions,
        maxCommits: options.maxCommits,
        includeBranchDeletions: options.includeBranchDeletions,
        includeEmptyPushes: options.includeEmptyPushes
      }
    };
  }

  // Extract useful information for actions
  extractCommitInfo(event: TriggerEvent): {
    branchName: string;
    commitCount: number;
    commits: Array<{
      id: string;
      message: string;
      author: string;
      timestamp: string;
      filesChanged: number;
    }>;
    pusher: string;
    repository: string;
    isForced: boolean;
    isNewBranch: boolean;
    isDeleted: boolean;
  } | null {
    try {
      const payload = event.payload as CommitEventPayload;

      return {
        branchName: this.extractBranchName(payload.ref),
        commitCount: payload.commits.length,
        commits: payload.commits.map(commit => ({
          id: commit.id.substring(0, 7), // Short SHA
          message: commit.message.split('\n')[0], // First line only
          author: commit.author.username || commit.author.name,
          timestamp: commit.timestamp,
          filesChanged: commit.added.length + commit.modified.length + commit.removed.length
        })),
        pusher: payload.pusher.name,
        repository: payload.repository.fullName,
        isForced: payload.forced,
        isNewBranch: payload.created,
        isDeleted: payload.deleted
      };
    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Failed to extract commit info');
      return null;
    }
  }
}
