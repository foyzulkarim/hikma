import { ProjectEntity } from '../entities/project.entity';
import { IProjectRepository } from '../repositories/project.repository.interface';
import { eventBus } from '@/shared/events/event-bus';
import { PROJECT_EVENTS, ProjectSyncStartedEvent, ProjectSyncCompletedEvent } from '../events/project.events';
import { GhCliService } from '@/shared/services/gh-cli.service';
import { GitService } from '@/shared/services/git.service';
import { TempDirectoryManager } from '@/shared/utils/temp-directory.util';
import { logger } from '@/core/utils/logger';
import { ValidationError, ExternalServiceError } from '@/core/errors/app-error';
import { ASTProcessingHandler } from '@/knowledge/handlers/ast-processing.handler';
import { chunkSyncService } from '@/knowledge/services/chunk-sync.service';

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
  private astProcessingHandler: ASTProcessingHandler;

  constructor(private projectRepository: IProjectRepository) {
    this.ghCliService = new GhCliService();
    this.gitService = new GitService();
    this.tempManager = TempDirectoryManager.getInstance();
    this.astProcessingHandler = new ASTProcessingHandler();
  }

  async syncProject(id: string, userId: string, options: SyncOptions = {}): Promise<ProjectSyncResult> {
    const correlationId = `sync-service-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();
    
    logger.info({
      projectId: id,
      userId,
      options,
      correlationId
    }, 'ProjectSyncService.syncProject started');

    try {
      // Verify project exists and user has access
      logger.info({
        projectId: id,
        userId,
        correlationId
      }, 'Verifying project access and existence');
      
      const project = await this.projectRepository.findById(id, userId);
      if (!project) {
        logger.warn({
          projectId: id,
          userId,
          correlationId
        }, 'Project not found or access denied');
        throw new ValidationError('Project not found or access denied');
      }

      logger.info({
        projectId: id,
        projectName: project.name,
        userId,
        correlationId
      }, 'Project access verified successfully');

      // Check if sync is already in progress
      if (project.isSyncInProgress()) {
        const syncInfo = project.getSyncInfo();
        logger.info({
          projectId: id,
          existingSyncId: syncInfo.syncId,
          syncStatus: syncInfo.syncStatus,
          correlationId
        }, 'Sync already in progress for project');
        
        return {
          status: 'in_progress',
          message: 'Sync is already in progress for this project',
          syncId: syncInfo.syncId,
          tempPath: syncInfo.tempPath
        };
      }

      // Check if we have a valid existing temporary clone
      if (project.hasValidTempClone()) {
        const syncInfo = project.getSyncInfo();
        logger.info({
          projectId: id,
          tempPath: syncInfo.tempPath,
          lastSyncAt: syncInfo.lastSyncAt,
          correlationId
        }, 'Valid temporary clone already exists');
        
        return {
          status: 'success',
          message: 'Project already synced with valid temporary clone',
          syncId: syncInfo.syncId,
          tempPath: syncInfo.tempPath
        };
      }

      // Check if project can be synced
      logger.info({
        projectId: id,
        projectName: project.name,
        userId,
        correlationId
      }, 'Checking project sync capability');
      
      if (!project.canSync()) {
        logger.warn({
          projectId: id,
          projectName: project.name,
          userId,
          correlationId,
          reason: 'Project sync capability check failed'
        }, 'Project cannot be synced');
        
        return {
          status: 'error',
          message: 'Project cannot be synced. Check project status and repository configuration.'
        };
      }

      logger.info({
        projectId: id,
        projectName: project.name,
        userId,
        correlationId
      }, 'Project sync capability confirmed');

      // Generate sync ID and update sync status to in_progress
      const syncId = `sync_${id}_${Date.now()}`;
      const repositoryInfo = project.getRepositoryInfo();
      
      // Update project sync status to in_progress
      await this.projectRepository.updateSyncStatus(id, {
        syncStatus: 'in_progress',
        syncId,
        lastSyncAt: new Date().toISOString()
      });
      
      logger.info({
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
      }, 'Generated sync ID, updated sync status to in_progress, and retrieved repository info');

      let tempPath: string | undefined;
      let cleanupRequired = false;

      // Determine if we should use temporary cloning
      const shouldUseTemporaryClone = options.useTemporaryClone || 
        (repositoryInfo?.url && !repositoryInfo?.path);
        
      logger.info({
        projectId: id,
        syncId,
        shouldUseTemporaryClone,
        useTemporaryCloneOption: options.useTemporaryClone,
        hasRepositoryUrl: !!repositoryInfo?.url,
        hasRepositoryPath: !!repositoryInfo?.path,
        correlationId
      }, 'Temporary cloning decision made');

      if (shouldUseTemporaryClone && repositoryInfo?.url) {
        const targetBranch = options.branch || repositoryInfo.branch;
        
        logger.info({
          projectId: id,
          syncId,
          repositoryUrl: repositoryInfo.url,
          branch: targetBranch,
          correlationId
        }, 'Starting temporary repository clone');

        tempPath = await this.cloneToTemporaryDirectory(
          repositoryInfo.url,
          targetBranch,
          correlationId
        );
        cleanupRequired = true;

        // Update sync status with tempPath
        await this.projectRepository.updateSyncStatus(id, {
          tempPath
        });

        logger.info({
          projectId: id,
          syncId,
          tempPath,
          repositoryUrl: repositoryInfo.url,
          branch: targetBranch,
          correlationId
        }, 'Repository cloned to temporary directory successfully');
      } else {
        logger.info({
          projectId: id,
          syncId,
          reason: shouldUseTemporaryClone ? 'No repository URL available' : 'Using existing repository path',
          repositoryPath: repositoryInfo?.path,
          correlationId
        }, 'Skipping temporary clone');
      }

      // DIRECT AST PROCESSING: Parse code files and generate embeddings
      // This replaces the complex event-driven approach with a simple direct call
      if (tempPath) {
        logger.info({ projectId: id, tempPath, correlationId }, 'Starting AST processing for cloned repository');
        await this.processRepositoryFiles(id, tempPath, correlationId);
      } else if (repositoryInfo?.path) {
        logger.info({ projectId: id, path: repositoryInfo.path, correlationId }, 'Starting AST processing for existing repository');
        await this.processRepositoryFiles(id, repositoryInfo.path, correlationId);
      } else {
        logger.warn({ projectId: id, correlationId }, 'No repository path available for AST processing');
      }

      // AUTOMATIC QDRANT SYNC: Sync processed chunks to Qdrant vector database
      logger.info({ projectId: id, correlationId }, 'Starting automatic Qdrant sync');
      try {
        const syncResult = await chunkSyncService.syncChunksToQdrant({
          projectId: id,
          skipExisting: false,
          batchSize: 10
        });
        
        logger.info({
          projectId: id,
          syncResult: {
            processed: syncResult.processed,
            successful: syncResult.successful,
            failed: syncResult.failed,
            duration: syncResult.duration
          },
          correlationId
        }, 'Qdrant sync completed successfully');
        
        if (syncResult.failed > 0) {
          logger.warn({
            projectId: id,
            failedCount: syncResult.failed,
            errors: syncResult.errors,
            correlationId
          }, 'Some chunks failed to sync to Qdrant');
        }
      } catch (qdrantError) {
        logger.error({
          projectId: id,
          error: qdrantError instanceof Error ? qdrantError.message : 'Unknown error',
          correlationId
        }, 'Qdrant sync failed - continuing with sync process');
        // Don't throw here - Qdrant sync failure shouldn't stop the entire sync process
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
      
      logger.info({
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
      }, 'Emitting PROJECT_SYNC_STARTED event');
      
      eventBus.emit(PROJECT_EVENTS.PROJECT_SYNC_STARTED, event);
      
      const duration = Date.now() - startTime;
      
      logger.info({
        projectId: id,
        syncId,
        status: 'in_progress',
        tempPath,
        cleanupRequired,
        duration,
        correlationId
      }, 'ProjectSyncService.syncProject completed successfully');

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
      
      // Update sync status to failed
        try {
          await this.projectRepository.updateSyncStatus(id, {
            syncStatus: 'failed',
            errorMessage
          });
      } catch (updateError) {
        logger.error({
          projectId: id,
          updateError: updateError instanceof Error ? updateError.message : 'Unknown error',
          correlationId
        }, 'Failed to update sync status to error');
      }
      
      logger.error({
        projectId: id,
        userId,
        options,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId
      }, 'ProjectSyncService.syncProject failed');

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
    const cloneCorrelationId = correlationId || `clone-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();
    
    logger.info({
      repositoryUrl,
      branch,
      correlationId: cloneCorrelationId
    }, 'Starting repository clone to temporary directory');
    
    try {
      // Create organized repository directory
      logger.info({
        repositoryUrl,
        branch,
        correlationId: cloneCorrelationId
      }, 'Creating organized repository directory');
      
      const tempDir = await this.createOrganizedRepoDirectory(repositoryUrl);
      
      logger.info({
        tempDir,
        repositoryUrl,
        correlationId: cloneCorrelationId
      }, 'Repository directory created successfully');

      // Verify directory exists before proceeding with clone
      const fs = await import('fs/promises');
      try {
        await fs.access(tempDir);
        logger.info({
          tempDir,
          correlationId: cloneCorrelationId
        }, 'Verified temporary directory exists');
      } catch (accessError) {
        logger.error({
          tempDir,
          error: accessError instanceof Error ? accessError.message : 'Unknown error',
          correlationId: cloneCorrelationId
        }, 'Temporary directory does not exist or is not accessible');
        throw new Error(`Temporary directory ${tempDir} is not accessible`);
      }

      // Clone repository using GitService
      logger.info({
        repositoryUrl,
        tempDir,
        branch,
        correlationId: cloneCorrelationId
      }, 'Starting repository clone operation');
      
      await this.gitService.cloneRepository({
        repositoryUrl,
        targetDirectory: tempDir,
        branch,
        depth: 1
      }, cloneCorrelationId);
      
      const duration = Date.now() - startTime;
      
      logger.info({
        repositoryUrl,
        tempDir,
        branch,
        duration,
        correlationId: cloneCorrelationId
      }, 'Repository cloned successfully to temporary directory');

      return tempDir;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error({
        repositoryUrl,
        branch,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: cloneCorrelationId
      }, 'Failed to clone repository to temporary directory');
      throw error;
    }
  }

  private async createOrganizedRepoDirectory(repositoryUrl: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    // Extract repo name from URL
    const repoName = this.extractRepoNameFromUrl(repositoryUrl);
    
    // Create organized path: ~/.hikma/repositories/{repo-name}
    const homeDir = os.homedir();
    const hikmaDir = path.join(homeDir, '.hikma', 'repositories');
    const repoDir = path.join(hikmaDir, repoName);

    // Create directories if they don't exist
    await fs.mkdir(hikmaDir, { recursive: true });
    
    // Clean existing directory if it exists
    try {
      await fs.rm(repoDir, { recursive: true, force: true });
      logger.info({ repoDir }, 'Cleaned existing repository directory');
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
    
    // Create fresh directory
    await fs.mkdir(repoDir, { recursive: true });
    
    logger.info({ 
      repositoryUrl, 
      repoName, 
      repoDir 
    }, 'Created organized repository directory');

    return repoDir;
  }

  private extractRepoNameFromUrl(repositoryUrl: string): string {
    // Extract repo name from various URL formats:
    // https://github.com/owner/repo.git -> repo
    // https://github.com/owner/repo -> repo
    // git@github.com:owner/repo.git -> repo
    
    const urlWithoutGit = repositoryUrl.replace(/\.git$/, '');
    const parts = urlWithoutGit.split('/');
    const repoName = parts[parts.length - 1];
    
    // Clean repo name (remove special characters, keep alphanumeric and hyphens)
    return repoName.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase();
  }

  async cleanupTemporaryDirectory(tempPath: string, correlationId?: string): Promise<void> {
    const cleanupCorrelationId = correlationId || `cleanup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();
    
    logger.info({
      tempPath,
      correlationId: cleanupCorrelationId
    }, 'Starting repository directory cleanup');
    
    try {
      const fs = await import('fs/promises');
      
      // Only cleanup if it's in our organized structure
      if (tempPath.includes('.hikma/repositories')) {
        await fs.rm(tempPath, { recursive: true, force: true });
      } else {
        // Fallback to temp manager for other paths
        await this.tempManager.removeTempDirectory(tempPath);
      }
      
      const duration = Date.now() - startTime;
      
      logger.info({
        tempPath,
        duration,
        correlationId: cleanupCorrelationId
      }, 'Repository directory cleaned up successfully');
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error({
        tempPath,
        error: errorMessage,
        stack: errorStack,
        duration,
        correlationId: cleanupCorrelationId
      }, 'Failed to cleanup repository directory');
      // Don't throw error for cleanup failures, just log them
    }
  }

  /**
   * Process repository files with AST parsing and embedding generation
   */
  private async processRepositoryFiles(projectId: string, repositoryPath: string, correlationId: string): Promise<void> {
    const startTime = Date.now();
    
    logger.info({
      projectId,
      repositoryPath,
      correlationId
    }, 'Starting repository AST processing and embedding generation');

    try {
      // Get all code files from the repository
      const codeFiles = await this.getCodeFiles(repositoryPath);
      
      logger.info({
        projectId,
        repositoryPath,
        totalFiles: codeFiles.length,
        correlationId
      }, 'Found code files for processing');

      let processedFiles = 0;
      let failedFiles = 0;

      // Process each code file
      for (const filePath of codeFiles) {
        try {
          await this.processSingleFile(filePath, repositoryPath, projectId, correlationId);
          processedFiles++;
          
          logger.debug({
            projectId,
            filePath: filePath.replace(repositoryPath, ''),
            processedFiles,
            totalFiles: codeFiles.length,
            correlationId
          }, 'Successfully processed file');
          
        } catch (fileError) {
          failedFiles++;
          logger.error({
            projectId,
            filePath: filePath.replace(repositoryPath, ''),
            error: fileError instanceof Error ? fileError.message : 'Unknown error',
            correlationId
          }, 'Failed to process file');
        }
      }

      const duration = Date.now() - startTime;
      
      logger.info({
        projectId,
        repositoryPath,
        totalFiles: codeFiles.length,
        processedFiles,
        failedFiles,
        duration,
        correlationId
      }, 'Repository AST processing completed');

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error({
        projectId,
        repositoryPath,
        error: errorMessage,
        duration,
        correlationId
      }, 'Repository AST processing failed');
      throw error;
    }
  }

  /**
   * Process a single file with AST parsing and embedding generation
   */
  private async processSingleFile(
    filePath: string, 
    repositoryPath: string, 
    projectId: string, 
    correlationId: string
  ): Promise<void> {
    try {
      // Read file content
      const fs = await import('fs/promises');
      const path = await import('path');
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Get relative path from repository root
      const relativePath = path.relative(repositoryPath, filePath);
      
      // Determine file language from extension
      const language = this.getLanguageFromPath(filePath);
      
      // Process with AST handler
      const result = await this.astProcessingHandler.handleASTProcessing({
        projectId,
        filePath: relativePath,
        content,
        language,
        sourceId: correlationId,
        sourceType: 'git'
      });
      
      if (!result.success) {
        logger.warn({
          projectId,
          filePath: relativePath,
          error: result.error,
          correlationId
        }, 'AST processing failed for file');
      }
      
    } catch (error) {
      logger.error({
        projectId,
        filePath: filePath.replace(repositoryPath, ''),
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      }, 'Failed to process file content');
      throw error;
    }
  }

  /**
   * Get all code files from a directory recursively
   */
  private async getCodeFiles(directoryPath: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const codeFiles: string[] = [];
    const codeExtensions = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.php', '.rb', '.swift', '.kt', '.scala', '.clj', '.hs', '.ml', '.fs', '.vb'
    ]);

    async function scanDirectory(currentPath: string): Promise<void> {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common non-code directories
            if (!['node_modules', '.git', 'dist', 'build', '.next', 'target', 'bin', 'obj'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (codeExtensions.has(ext)) {
              codeFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        logger.debug({ currentPath, error }, 'Failed to scan directory');
      }
    }

    await scanDirectory(directoryPath);
    return codeFiles;
  }

  /**
   * Get programming language from file path
   */
  private getLanguageFromPath(filePath: string): string {
    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript', 
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala'
    };
    
    return languageMap[ext] || 'text';
  }
}