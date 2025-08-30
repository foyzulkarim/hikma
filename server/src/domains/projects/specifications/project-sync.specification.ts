import { BaseSpecification } from './project-access.specification';
import { ProjectEntity } from '../entities/project.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Context for project sync specifications
 */
export interface ProjectSyncContext {
  project: ProjectEntity;
  user: UserEntity;
  syncType: 'manual' | 'scheduled' | 'webhook';
  force?: boolean;
  lastSyncAt?: Date;
  repositoryUrl?: string;
  branch?: string;
}

/**
 * Specification: Project is in a syncable state
 */
export class ProjectIsSyncableSpecification extends BaseSpecification<ProjectSyncContext> {
  isSatisfiedBy(context: ProjectSyncContext): boolean {
    // Project must be active
    if (!context.project.isActive()) {
      return false;
    }

    // Project must have a valid repository configuration
    if (!context.project.hasValidRepository()) {
      return false;
    }

    // Project must be able to sync (internal validation)
    return context.project.canSync();
  }
}

/**
 * Specification: Repository URL is valid and accessible
 */
export class ValidRepositorySpecification extends BaseSpecification<ProjectSyncContext> {
  private gitUrlRegex = /^(https?:\/\/)|(git@[\w\.-]+:[\w\.-]+\/[\w\.-]+\.git)|(ssh:\/\/git@[\w\.-]+\/[\w\.-]+\.git)$/;
  private githubUrlRegex = /^https:\/\/github\.com\/[\w\.-]+\/[\w\.-]+(\.git)?$/;
  private gitlabUrlRegex = /^https:\/\/gitlab\.com\/[\w\.-]+\/[\w\.-]+(\.git)?$/;

  isSatisfiedBy(context: ProjectSyncContext): boolean {
    const repositoryInfo = context.project.getRepositoryInfo();
    const repoUrl = context.repositoryUrl || repositoryInfo.url;

    if (!repoUrl) {
      return false;
    }

    // Check if URL matches supported patterns
    return this.gitUrlRegex.test(repoUrl) || 
           this.githubUrlRegex.test(repoUrl) || 
           this.gitlabUrlRegex.test(repoUrl);
  }
}

/**
 * Specification: Sync cooldown period has passed
 */
export class SyncCooldownSpecification extends BaseSpecification<ProjectSyncContext> {
  private cooldownMinutes = 5; // Minimum 5 minutes between syncs

  isSatisfiedBy(context: ProjectSyncContext): boolean {
    // Force sync bypasses cooldown
    if (context.force) {
      return true;
    }

    // Scheduled syncs bypass cooldown
    if (context.syncType === 'scheduled') {
      return true;
    }

    // Check if enough time has passed since last sync
    const lastSync = context.lastSyncAt;
    if (!lastSync) {
      return true; // No previous sync
    }

    const now = new Date();
    const timeDiff = now.getTime() - lastSync.getTime();
    const cooldownMs = this.cooldownMinutes * 60 * 1000;

    return timeDiff >= cooldownMs;
  }
}

/**
 * Specification: User has permission to trigger sync
 */
export class CanTriggerSyncSpecification extends BaseSpecification<ProjectSyncContext> {
  isSatisfiedBy(context: ProjectSyncContext): boolean {
    // Admin can sync any project
    if (context.user.isAdmin()) {
      return true;
    }

    // Project owner can sync
    if (context.project.isOwner(context.user.id)) {
      return true;
    }

    // Project members can sync (depending on role)
    if (context.project.isMember(context.user.id)) {
      return true;
    }

    return false;
  }
}

/**
 * Specification: Branch is valid for the repository
 */
export class ValidBranchSpecification extends BaseSpecification<ProjectSyncContext> {
  private validBranchRegex = /^[a-zA-Z0-9._/-]+$/;
  private reservedBranches = ['HEAD', 'refs/heads/', 'refs/tags/'];

  isSatisfiedBy(context: ProjectSyncContext): boolean {
    const repositoryInfo = context.project.getRepositoryInfo();
    const branch = context.branch || repositoryInfo.branch || 'main';

    // Check branch name format
    if (!this.validBranchRegex.test(branch)) {
      return false;
    }

    // Check for reserved branch names
    if (this.reservedBranches.some(reserved => branch.startsWith(reserved))) {
      return false;
    }

    // Branch name should not be too long
    if (branch.length > 250) {
      return false;
    }

    return true;
  }
}

/**
 * Specification: Project settings allow sync operation
 */
export class SyncSettingsValidSpecification extends BaseSpecification<ProjectSyncContext> {
  isSatisfiedBy(context: ProjectSyncContext): boolean {
    const settings = context.project.getTypedSettings();

    // Check if auto-sync is enabled for scheduled syncs
    if (context.syncType === 'scheduled' && !settings.enableAutoSync) {
      return false;
    }

    // Validate include/exclude patterns
    if (settings.includePatterns && settings.includePatterns.length > 0) {
      if (!this.areValidPatterns(settings.includePatterns)) {
        return false;
      }
    }

    if (settings.excludePatterns && settings.excludePatterns.length > 0) {
      if (!this.areValidPatterns(settings.excludePatterns)) {
        return false;
      }
    }

    // Validate max file size setting
    if (settings.maxFileSize && (settings.maxFileSize < 0 || settings.maxFileSize > 100 * 1024 * 1024)) {
      return false; // Max 100MB per file
    }

    return true;
  }

  private areValidPatterns(patterns: string[]): boolean {
    return patterns.every(pattern => {
      // Basic pattern validation - no empty patterns
      if (!pattern.trim()) {
        return false;
      }

      // Pattern should not be too long
      if (pattern.length > 500) {
        return false;
      }

      return true;
    });
  }
}

/**
 * Specification: No concurrent sync is running
 */
export class NoConcurrentSyncSpecification extends BaseSpecification<ProjectSyncContext> {
  constructor(private getCurrentSyncStatus: (projectId: string) => Promise<boolean>) {
    super();
  }

  async isSatisfiedByAsync(context: ProjectSyncContext): Promise<boolean> {
    // Force sync can override concurrent sync check
    if (context.force) {
      return true;
    }

    // Check if there's already a sync running for this project
    const isCurrentlysyncing = await this.getCurrentSyncStatus(context.project.id);
    return !isCurrentlysyncing;
  }

  // Synchronous version always returns true - async check should be used
  isSatisfiedBy(context: ProjectSyncContext): boolean {
    return true;
  }
}

/**
 * Specification: Sync frequency limits are respected
 */
export class SyncFrequencyLimitSpecification extends BaseSpecification<ProjectSyncContext> {
  private maxSyncsPerHour = 10;
  private maxSyncsPerDay = 50;

  constructor(
    private getSyncHistory: (projectId: string, hours: number) => Promise<number>
  ) {
    super();
  }

  async isSatisfiedByAsync(context: ProjectSyncContext): Promise<boolean> {
    // Admin and force syncs bypass frequency limits
    if (context.user.isAdmin() || context.force) {
      return true;
    }

    // Scheduled syncs bypass frequency limits
    if (context.syncType === 'scheduled') {
      return true;
    }

    // Check hourly limit
    const syncsInLastHour = await this.getSyncHistory(context.project.id, 1);
    if (syncsInLastHour >= this.maxSyncsPerHour) {
      return false;
    }

    // Check daily limit
    const syncsInLastDay = await this.getSyncHistory(context.project.id, 24);
    if (syncsInLastDay >= this.maxSyncsPerDay) {
      return false;
    }

    return true;
  }

  // Synchronous version always returns true - async check should be used
  isSatisfiedBy(context: ProjectSyncContext): boolean {
    return true;
  }
}

/**
 * Main specification service for project sync operations
 */
export class ProjectSyncSpecificationService {
  private syncableSpec = new ProjectIsSyncableSpecification();
  private validRepoSpec = new ValidRepositorySpecification();
  private cooldownSpec = new SyncCooldownSpecification();
  private canTriggerSpec = new CanTriggerSyncSpecification();
  private validBranchSpec = new ValidBranchSpecification();
  private syncSettingsSpec = new SyncSettingsValidSpecification();

  constructor(
    private getCurrentSyncStatus: (projectId: string) => Promise<boolean>,
    private getSyncHistory: (projectId: string, hours: number) => Promise<number>
  ) {}

  /**
   * Check if a project can be synced
   */
  async canSyncProject(
    project: ProjectEntity,
    user: UserEntity,
    options: {
      syncType: 'manual' | 'scheduled' | 'webhook';
      force?: boolean;
      lastSyncAt?: Date;
      repositoryUrl?: string;
      branch?: string;
    }
  ): Promise<{ canSync: boolean; reason?: string }> {
    const context: ProjectSyncContext = {
      project,
      user,
      ...options
    };

    // Check basic syncability
    if (!this.syncableSpec.isSatisfiedBy(context)) {
      return { canSync: false, reason: 'Project is not in a syncable state' };
    }

    // Check repository validity
    if (!this.validRepoSpec.isSatisfiedBy(context)) {
      return { canSync: false, reason: 'Invalid or inaccessible repository URL' };
    }

    // Check user permissions
    if (!this.canTriggerSpec.isSatisfiedBy(context)) {
      return { canSync: false, reason: 'Insufficient permissions to trigger sync' };
    }

    // Check cooldown period
    if (!this.cooldownSpec.isSatisfiedBy(context)) {
      return { canSync: false, reason: 'Sync cooldown period has not passed' };
    }

    // Check branch validity
    if (!this.validBranchSpec.isSatisfiedBy(context)) {
      return { canSync: false, reason: 'Invalid branch specified' };
    }

    // Check sync settings
    if (!this.syncSettingsSpec.isSatisfiedBy(context)) {
      return { canSync: false, reason: 'Project sync settings are invalid' };
    }

    // Check for concurrent syncs
    const noConcurrentSpec = new NoConcurrentSyncSpecification(this.getCurrentSyncStatus);
    const noConcurrentSync = await noConcurrentSpec.isSatisfiedByAsync(context);
    if (!noConcurrentSync) {
      return { canSync: false, reason: 'Another sync is already in progress' };
    }

    // Check frequency limits
    const frequencySpec = new SyncFrequencyLimitSpecification(this.getSyncHistory);
    const withinFrequencyLimits = await frequencySpec.isSatisfiedByAsync(context);
    if (!withinFrequencyLimits) {
      return { canSync: false, reason: 'Sync frequency limit exceeded' };
    }

    return { canSync: true };
  }

  /**
   * Get sync recommendations for a project
   */
  getSyncRecommendations(
    project: ProjectEntity,
    lastSyncAt?: Date
  ): {
    shouldSync: boolean;
    reason: string;
    recommendedBranch?: string;
    estimatedDuration?: string;
  } {
    const repositoryInfo = project.getRepositoryInfo();
    const settings = project.getTypedSettings();

    // Check if project needs sync
    if (!lastSyncAt) {
      return {
        shouldSync: true,
        reason: 'Project has never been synced',
        recommendedBranch: repositoryInfo.branch || 'main',
        estimatedDuration: '2-5 minutes'
      };
    }

    // Check sync interval
    const syncInterval = settings.syncInterval || 24; // Default 24 hours
    const hoursSinceLastSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastSync >= syncInterval) {
      return {
        shouldSync: true,
        reason: `Last sync was ${Math.floor(hoursSinceLastSync)} hours ago`,
        recommendedBranch: repositoryInfo.branch || 'main',
        estimatedDuration: '1-3 minutes'
      };
    }

    return {
      shouldSync: false,
      reason: `Next sync recommended in ${Math.ceil(syncInterval - hoursSinceLastSync)} hours`
    };
  }
}