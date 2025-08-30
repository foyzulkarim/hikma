import { ProjectEntity } from '../entities/project.entity';
import { IProjectRepository } from '../repositories/project.repository.interface';
import { eventBus } from '@/shared/events/event-bus';
import { PROJECT_EVENTS, ProjectSyncStartedEvent, ProjectSyncCompletedEvent } from '../events/project.events';
import { GhCliService } from '@/shared/services/gh-cli.service';
import { TempDirectoryManager } from '@/shared/utils/temp-directory.util';
import { logger } from '@/core/utils/logger';
import { ValidationError, ExternalServiceError } from '@/core/errors/app-error';

export interface ProjectSyncResult {
  status: 'success' | 'error' | 'in_progress';
  message: string;
  syncId?: string;
  documentsProcessed?: number;
  tempPath?: string;
  cleanupRequired?: boolean;
}

export interface SyncOptions {
  useTemporaryClone?: boolean;
  force?: boolean;
  branch?: string;
}

export class ProjectSyncService {
  private ghCliService: GhCliService;
  private tempManager: TempDirectoryManager;

  constructor(private projectRepository: IProjectRepository) {
    this.ghCliService = new GhCliService();
    this.tempManager = TempDirectoryManager.getInstance();
  }

  async syncProject(id: string, userId: string, options: SyncOptions = {}): Promise<ProjectSyncResult> {
    // Verify project exists and user has access
    const project = await this.projectRepository.findById(id, userId);
    if (!project) {
      throw new ValidationError('Project not found or access denied');
    }

    // Check if project can be synced
    if (!project.canSync()) {
      return {
        status: 'error',
        message: 'Project cannot be synced. Check project status and repository configuration.'
      };
    }

    // Generate sync ID
    const syncId = `sync_${id}_${Date.now()}`;
    const repositoryInfo = project.getRepositoryInfo();

    try {
      let tempPath: string | undefined;
      let cleanupRequired = false;

      // Determine if we should use temporary cloning
      const shouldUseTemporaryClone = options.useTemporaryClone || 
        (repositoryInfo?.url && !repositoryInfo?.path);

      if (shouldUseTemporaryClone && repositoryInfo?.url) {
        logger.info(`Starting temporary clone for project ${id}`, {
          syncId,
          repositoryUrl: repositoryInfo.url,
          branch: options.branch || repositoryInfo.branch
        });

        tempPath = await this.cloneToTemporaryDirectory(
          repositoryInfo.url,
          options.branch || repositoryInfo.branch
        );
        cleanupRequired = true;

        logger.info(`Repository cloned to temporary directory: ${tempPath}`, { syncId });
      }

      // Emit domain event
      const event: ProjectSyncStartedEvent = {
        projectId: id,
        userId,
        syncId,
        repositoryUrl: repositoryInfo?.url,
        branch: options.branch || repositoryInfo?.branch,
        timestamp: new Date().toISOString(),
        metadata: {
           force: options.force || false,
           lastSyncAt: undefined,
           tempPath,
           useTemporaryClone: shouldUseTemporaryClone
         }
      };
      eventBus.emit(PROJECT_EVENTS.PROJECT_SYNC_STARTED, event);

      // Return immediate response (actual sync happens asynchronously)
      return {
        status: 'in_progress',
        message: 'Project sync started successfully',
        syncId,
        tempPath,
        cleanupRequired
      };
    } catch (error) {
      logger.error(`Failed to start sync for project ${id}`, {
        syncId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        status: 'error',
        message: `Failed to start sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
        syncId
      };
    }
  }

  async getSyncStatus(syncId: string, userId: string): Promise<ProjectSyncResult> {
    // This would typically query a sync status store or job queue
    // For now, return a placeholder implementation
    return {
      status: 'in_progress',
      message: 'Sync status check not yet implemented',
      syncId
    };
  }

  async cancelSync(syncId: string, userId: string): Promise<void> {
    // This would typically cancel a running sync job
    // Emit sync cancelled event
    eventBus.emit('sync-job-cancelled', {
      jobId: syncId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  private async cloneToTemporaryDirectory(repositoryUrl: string, branch?: string): Promise<string> {
    try {
      // Check if GitHub CLI is available
      const isAvailable = await this.ghCliService.isAvailable();
      if (!isAvailable) {
        throw new ExternalServiceError('GitHub CLI is not available. Please install gh CLI.');
      }

      // Check if repository exists
      const repoExists = await this.ghCliService.checkRepositoryExists(repositoryUrl);
      if (!repoExists) {
        throw new ValidationError(`Repository ${repositoryUrl} does not exist or is not accessible.`);
      }

      // Create temporary directory
      const tempDir = await this.tempManager.createTempDirectory('repo-sync');
      
      // Clone repository to temporary directory
      await this.ghCliService.cloneRepository(repositoryUrl, tempDir, branch);
      
      logger.info('Repository cloned successfully to temporary directory', {
        repositoryUrl,
        tempDir,
        branch
      });

      return tempDir;
    } catch (error) {
      logger.error('Failed to clone repository to temporary directory', {
        repositoryUrl,
        branch,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async cleanupTemporaryDirectory(tempPath: string): Promise<void> {
    try {
      await this.tempManager.removeTempDirectory(tempPath);
      logger.info('Temporary directory cleaned up successfully', { tempPath });
    } catch (error) {
      logger.error('Failed to cleanup temporary directory', {
        tempPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw error for cleanup failures, just log them
    }
  }
}