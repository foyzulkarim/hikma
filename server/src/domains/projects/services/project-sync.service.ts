import { ProjectEntity } from '../entities/project.entity';
import { IProjectRepository } from '../repositories/project.repository.interface';
import { eventBus } from '@/shared/events/event-bus';
import { PROJECT_EVENTS, ProjectSyncStartedEvent, ProjectSyncCompletedEvent } from '../events/project.events';
import { GhCliService } from '@/shared/services/gh-cli.service';
import { GitService } from '@/shared/services/git.service';
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
  private gitService: GitService;
  private tempManager: TempDirectoryManager;

  constructor(private projectRepository: IProjectRepository) {
    this.ghCliService = new GhCliService();
    this.gitService = new GitService();
    this.tempManager = TempDirectoryManager.getInstance();
  }

  async syncProject(id: string, userId: string, options: SyncOptions = {}): Promise<ProjectSyncResult> {
    const correlationId = `sync-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('ProjectSyncService.syncProject started', {
      projectId: id,
      userId,
      options,
      correlationId
    });

    try {
      // Verify project exists and user has access
      logger.info('Verifying project access and existence', {
        projectId: id,
        userId,
        correlationId
      });
      
      const project = await this.projectRepository.findById(id, userId);
      if (!project) {
        logger.warn('Project not found or access denied', {
          projectId: id,
          userId,
          correlationId
        });
        throw new ValidationError('Project not found or access denied');
      }

      logger.info('Project access verified successfully', {
        projectId: id,
        projectName: project.name,
        userId,
        correlationId
      });

      // Check if project can be synced
      logger.info('Checking project sync capability', {
        projectId: id,
        projectName: project.name,
        userId,
        correlationId
      });
      
      if (!project.canSync()) {
        logger.warn('Project cannot be synced', {
          projectId: id,
          projectName: project.name,
          userId,
          correlationId,
          reason: 'Project sync capability check failed'
        });
        
        return {
          status: 'error',
          message: 'Project cannot be synced. Check project status and repository configuration.'
        };
      }

      logger.info('Project sync capability confirmed', {
        projectId: id,
        projectName: project.name,
        userId,
        correlationId
      });

      // Generate sync ID
      const syncId = `sync_${id}_${Date.now()}`;
      const repositoryInfo = project.getRepositoryInfo();
      
      logger.info('Generated sync ID and retrieved repository info', {
        projectId: id,
        syncId,
        repositoryInfo: {
          url: repositoryInfo?.url,
          branch: repositoryInfo?.branch,
          path: repositoryInfo?.path,
          hasUrl: !!repositoryInfo?.url,
          hasPath: !!repositoryInfo?.path
        },
        correlationId
      });

      let tempPath: string | undefined;
      let cleanupRequired = false;

      // Determine if we should use temporary cloning
      const shouldUseTemporaryClone = options.useTemporaryClone || 
        (repositoryInfo?.url && !repositoryInfo?.path);
        
      logger.info('Temporary cloning decision made', {
        projectId: id,
        syncId,
        shouldUseTemporaryClone,
        useTemporaryCloneOption: options.useTemporaryClone,
        hasRepositoryUrl: !!repositoryInfo?.url,
        hasRepositoryPath: !!repositoryInfo?.path,
        correlationId
      });

      if (shouldUseTemporaryClone && repositoryInfo?.url) {
        const targetBranch = options.branch || repositoryInfo.branch;
        
        logger.info('Starting temporary repository clone', {
          projectId: id,
          syncId,
          repositoryUrl: repositoryInfo.url,
          branch: targetBranch,
          correlationId
        });

        tempPath = await this.cloneToTemporaryDirectory(
          repositoryInfo.url,
          targetBranch,
          correlationId
        );
        cleanupRequired = true;

        logger.info('Repository cloned to temporary directory successfully', {
          projectId: id,
          syncId,
          tempPath,
          repositoryUrl: repositoryInfo.url,
          branch: targetBranch,
          correlationId
        });
      } else {
        logger.info('Skipping temporary clone', {
          projectId: id,
          syncId,
          reason: shouldUseTemporaryClone ? 'No repository URL available' : 'Using existing repository path',
          repositoryPath: repositoryInfo?.path,
          correlationId
        });
      }

      // Prepare and emit domain event
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
           useTemporaryClone: Boolean(shouldUseTemporaryClone)
         }
      };
      
      logger.info('Emitting PROJECT_SYNC_STARTED event', {
        projectId: id,
        syncId,
        eventType: PROJECT_EVENTS.PROJECT_SYNC_STARTED,
        eventData: {
          projectId: event.projectId,
          userId: event.userId,
          syncId: event.syncId,
          repositoryUrl: event.repositoryUrl,
          branch: event.branch,
          useTemporaryClone: event.metadata?.useTemporaryClone
        },
        correlationId
      });
      
      eventBus.emit(PROJECT_EVENTS.PROJECT_SYNC_STARTED, event);
      
      const duration = Date.now() - startTime;
      
      logger.info('ProjectSyncService.syncProject completed successfully', {
        projectId: id,
        syncId,
        status: 'in_progress',
        tempPath,
        cleanupRequired,
        duration,
        correlationId
      });

      // Return immediate response (actual sync happens asynchronously)
      return {
        status: 'in_progress',
        message: 'Project sync started successfully',
        syncId,
        tempPath,
        cleanupRequired
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('ProjectSyncService.syncProject failed', {
        projectId: id,
        userId,
        options,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId
      });

      return {
        status: 'error',
        message: `Failed to start sync: ${errorMessage}`,
        syncId: `sync_${id}_${Date.now()}`
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

  private async cloneToTemporaryDirectory(repositoryUrl: string, branch?: string, correlationId?: string): Promise<string> {
    const cloneCorrelationId = correlationId || `clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Starting repository clone to temporary directory', {
      repositoryUrl,
      branch,
      correlationId: cloneCorrelationId
    });
    
    try {
      // Create temporary directory
      logger.info('Creating temporary directory for repository clone', {
        repositoryUrl,
        branch,
        correlationId: cloneCorrelationId
      });
      
      const tempDir = await this.tempManager.createTempDirectory({
        prefix: 'hikma/hikma-sync',
        autoCleanup: false, // We'll handle cleanup manually
      });
      
      logger.info('Temporary directory created successfully', {
        tempDir,
        repositoryUrl,
        correlationId: cloneCorrelationId
      });

      // Clone repository using GitService
      logger.info('Starting repository clone operation', {
        repositoryUrl,
        tempDir,
        branch,
        correlationId: cloneCorrelationId
      });
      
      await this.gitService.cloneRepository({
        repositoryUrl,
        targetDirectory: tempDir,
        branch,
        depth: 1
      }, cloneCorrelationId);
      
      const duration = Date.now() - startTime;
      
      logger.info('Repository cloned successfully to temporary directory', {
        repositoryUrl,
        tempDir,
        branch,
        duration,
        correlationId: cloneCorrelationId
      });

      return tempDir;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to clone repository to temporary directory', {
        repositoryUrl,
        branch,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: cloneCorrelationId
      });
      throw error;
    }
  }

  async cleanupTemporaryDirectory(tempPath: string, correlationId?: string): Promise<void> {
    const cleanupCorrelationId = correlationId || `cleanup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('Starting temporary directory cleanup', {
      tempPath,
      correlationId: cleanupCorrelationId
    });
    
    try {
      await this.tempManager.removeTempDirectory(tempPath);
      
      const duration = Date.now() - startTime;
      
      logger.info('Temporary directory cleaned up successfully', {
        tempPath,
        duration,
        correlationId: cleanupCorrelationId
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to cleanup temporary directory', {
        tempPath,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: cleanupCorrelationId
      });
      // Don't throw error for cleanup failures, just log them
    }
  }
}