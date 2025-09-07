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

export type SyncErrorCode = 
  | 'ACCESS_DENIED'
  | 'SYNC_IN_PROGRESS' 
  | 'SYNC_NOT_CAPABLE'
  | 'CLONE_FAILED'
  | 'PROCESSING_FAILED'
  | 'VALIDATION_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorDetails {
  phase: 'validation' | 'cloning' | 'processing' | 'qdrant_sync';
  operation?: string;
  context?: Record<string, any>;
}

export interface ProjectSyncResult {
  status: 'success' | 'error' | 'in_progress';
  message: string;
  syncId?: string;
  documentsProcessed?: number;
  tempPath?: string;
  cleanupRequired?: boolean;
  errorCode?: SyncErrorCode;
  details?: ErrorDetails;
}

export interface SyncOptions {
  useTemporaryClone?: boolean;
  force?: boolean;
  branch?: string;
}

export interface SyncStrategy {
  useTemporaryClone: boolean;
  targetBranch?: string;
  repositoryPath?: string;
  source: 'url' | 'path' | 'none';
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

  /**
   * Generate standardized error response with enhanced context
   */
  private createErrorResponse(
    projectId: string,
    userId: string,
    error: Error | unknown,
    correlationId: string,
    phase: ErrorDetails['phase'],
    syncId?: string,
    operation?: string,
    context?: Record<string, any>
  ): ProjectSyncResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Determine error code based on error type and phase
    let errorCode: SyncErrorCode;
    if (error instanceof ValidationError) {
      errorCode = phase === 'validation' && errorMessage.includes('access denied') 
        ? 'ACCESS_DENIED' 
        : errorMessage.includes('sync capability') 
          ? 'SYNC_NOT_CAPABLE'
          : errorMessage.includes('sync in progress')
            ? 'SYNC_IN_PROGRESS'
            : 'VALIDATION_ERROR';
    } else if (error instanceof ExternalServiceError) {
      errorCode = phase === 'cloning' ? 'CLONE_FAILED' : 'EXTERNAL_SERVICE_ERROR';
    } else {
      errorCode = phase === 'processing' ? 'PROCESSING_FAILED' : 'UNKNOWN_ERROR';
    }
    
    logger.error({
      projectId,
      userId,
      error: errorMessage,
      stack: errorStack,
      phase,
      operation,
      errorCode,
      context,
      correlationId
    }, `ProjectSyncService error in ${phase} phase`);

    return {
      status: 'error',
      message: `Failed to sync project: ${errorMessage}`,
      syncId: syncId || `sync_${projectId}_${Date.now()}`,
      errorCode,
      details: {
        phase,
        operation,
        context
      }
    };
  }

  /**
   * Validate project access and existence
   */
  private async validateProjectAccess(
    projectId: string,
    userId: string,
    correlationId: string
  ): Promise<{isValid: boolean, project?: ProjectEntity, errorResponse?: ProjectSyncResult}> {
    logger.info({
      projectId,
      userId,
      correlationId
    }, 'Verifying project access and existence');
    
    const project = await this.projectRepository.findById(projectId, userId);
    if (!project) {
      logger.warn({
        projectId,
        userId,
        correlationId
      }, 'Project not found or access denied');
      
      return {
        isValid: false,
        errorResponse: this.createErrorResponse(
          projectId,
          userId,
          new ValidationError('Project not found or access denied'),
          correlationId,
          'validation',
          undefined,
          'project_access_check',
          { projectId, userId }
        )
      };
    }

    logger.info({
      projectId,
      projectName: project.name,
      userId,
      correlationId
    }, 'Project access verified successfully');

    return { isValid: true, project };
  }

  /**
   * Check sync status and handle early returns for in-progress or valid existing syncs
   */
  private async checkSyncStatus(
    project: ProjectEntity,
    correlationId: string
  ): Promise<{canProceed: boolean, earlyReturn?: ProjectSyncResult}> {
    if (project.isSyncInProgress()) {
      const syncInfo = project.getSyncInfo();
      logger.info({
        projectId: project.id,
        existingSyncId: syncInfo.syncId,
        syncStatus: syncInfo.syncStatus,
        correlationId
      }, 'Sync already in progress for project');
      
      return {
        canProceed: false,
        earlyReturn: {
          status: 'in_progress',
          message: 'Sync is already in progress for this project',
          syncId: syncInfo.syncId,
          tempPath: syncInfo.tempPath
        }
      };
    }

    if (project.hasValidTempClone()) {
      const syncInfo = project.getSyncInfo();
      logger.info({
        projectId: project.id,
        tempPath: syncInfo.tempPath,
        lastSyncAt: syncInfo.lastSyncAt,
        correlationId
      }, 'Valid temporary clone already exists');
      
      return {
        canProceed: false,
        earlyReturn: {
          status: 'success',
          message: 'Project already synced with valid temporary clone',
          syncId: syncInfo.syncId,
          tempPath: syncInfo.tempPath
        }
      };
    }

    return { canProceed: true };
  }

  /**
   * Validate project sync capability
   */
  private async validateSyncCapability(
    project: ProjectEntity,
    userId: string,
    correlationId: string
  ): Promise<{isCapable: boolean, errorResponse?: ProjectSyncResult}> {
    logger.info({
      projectId: project.id,
      projectName: project.name,
      correlationId
    }, 'Checking project sync capability');
    
    if (!project.canSync()) {
      logger.warn({
        projectId: project.id,
        projectName: project.name,
        correlationId,
        reason: 'Project sync capability check failed'
      }, 'Project cannot be synced');
      
      return {
        isCapable: false,
        errorResponse: this.createErrorResponse(
          project.id!,
          userId,
          new ValidationError('Project sync capability check failed'),
          correlationId,
          'validation',
          undefined,
          'sync_capability_check',
          { projectName: project.name }
        )
      };
    }

    logger.info({
      projectId: project.id,
      projectName: project.name,
      correlationId
    }, 'Project sync capability confirmed');

    return { isCapable: true };
  }

  /**
   * Execute validation phase with all validation checks
   */
  private async executeValidationPhase(
    projectId: string,
    userId: string,
    correlationId: string
  ): Promise<{isValid: boolean, project?: ProjectEntity, earlyReturn?: ProjectSyncResult}> {
    const accessResult = await this.validateProjectAccess(projectId, userId, correlationId);
    if (!accessResult.isValid) {
      return { isValid: false, earlyReturn: accessResult.errorResponse };
    }

    const syncStatusResult = await this.checkSyncStatus(accessResult.project!, correlationId);
    if (!syncStatusResult.canProceed) {
      return { isValid: false, earlyReturn: syncStatusResult.earlyReturn };
    }

    const capabilityResult = await this.validateSyncCapability(accessResult.project!, userId, correlationId);
    if (!capabilityResult.isCapable) {
      return { isValid: false, earlyReturn: capabilityResult.errorResponse };
    }

    return { isValid: true, project: accessResult.project };
  }

  /**
   * Determine repository path for processing
   */
  private determineRepositoryPath(
    tempPath: string | undefined,
    repositoryInfo: any | null
  ): {path: string | null, source: 'temp' | 'existing' | 'none'} {
    if (tempPath) {
      return { path: tempPath, source: 'temp' };
    }
    
    if (repositoryInfo?.path) {
      return { path: repositoryInfo.path, source: 'existing' };
    }
    
    return { path: null, source: 'none' };
  }

  /**
   * Execute repository processing phase
   */
  private async executeProcessingPhase(
    projectId: string,
    repositoryPath: string,
    correlationId: string
  ): Promise<{success: boolean, errorResponse?: ProjectSyncResult}> {
    const processResult = await this.processRepositoryFiles(projectId, repositoryPath, correlationId);
    
    if (!processResult.success) {
      return {
        success: false,
        errorResponse: {
          status: 'error',
          message: `Failed to process repository files: ${processResult.error}`,
          errorCode: 'PROCESSING_FAILED',
          details: {
            phase: 'processing',
            operation: 'ast_processing',
            context: { repositoryPath }
          }
        }
      };
    }

    return { success: true };
  }

  /**
   * Determine sync strategy based on options and repository info
   */
  private determineSyncStrategy(
    options: SyncOptions,
    repositoryInfo: any | null
  ): SyncStrategy {
    const useTemporaryClone = options.useTemporaryClone || 
      (repositoryInfo?.url && !repositoryInfo?.path);
    
    if (useTemporaryClone && repositoryInfo?.url) {
      return {
        useTemporaryClone: true,
        targetBranch: options.branch || repositoryInfo.branch,
        source: 'url'
      };
    }
    
    if (repositoryInfo?.path) {
      return {
        useTemporaryClone: false,
        repositoryPath: repositoryInfo.path,
        source: 'path'
      };
    }
    
    return {
      useTemporaryClone: false,
      source: 'none'
    };
  }

  /**
   * Execute clone phase if temporary cloning is required
   */
  private async executeClonePhase(
    project: ProjectEntity,
    strategy: SyncStrategy,
    syncId: string,
    correlationId: string
  ): Promise<{success: boolean, tempPath?: string, cleanupRequired?: boolean, errorResponse?: ProjectSyncResult}> {
    if (!strategy.useTemporaryClone || strategy.source !== 'url') {
      return { success: true };
    }

    const repositoryInfo = project.getRepositoryInfo();
    
    logger.info({
      projectId: project.id,
      syncId,
      repositoryUrl: repositoryInfo?.url,
      branch: strategy.targetBranch,
      correlationId
    }, 'Starting temporary repository clone');

    const cloneResult = await this.cloneToTemporaryDirectory(
      repositoryInfo?.url!,
      strategy.targetBranch,
      correlationId
    );
    
    if (!cloneResult.success) {
      return {
        success: false,
        errorResponse: {
          status: 'error',
          message: `Failed to clone repository: ${cloneResult.error}`,
          syncId,
          errorCode: 'CLONE_FAILED',
          details: {
            phase: 'cloning',
            operation: 'repository_clone',
            context: { repositoryUrl: repositoryInfo?.url, branch: strategy.targetBranch }
          }
        }
      };
    }
    
    // Update sync status with tempPath
    await this.projectRepository.updateSyncStatus(project.id!, {
      tempPath: cloneResult.tempDir
    });

    logger.info({
      projectId: project.id,
      syncId,
      tempPath: cloneResult.tempDir,
      repositoryUrl: repositoryInfo?.url,
      branch: strategy.targetBranch,
      correlationId
    }, 'Repository cloned to temporary directory successfully');

    return { 
      success: true, 
      tempPath: cloneResult.tempDir, 
      cleanupRequired: true 
    };
  }

  /**
   * Execute Qdrant sync phase
   */
  private async executeQdrantSyncPhase(
    projectId: string,
    correlationId: string
  ): Promise<{success: boolean, warnings?: string[]}> {
    logger.info({ projectId, correlationId }, 'Starting automatic Qdrant sync');
    
    try {
      const syncResult = await chunkSyncService.syncChunksToQdrant({
        projectId,
        skipExisting: false,
        batchSize: 10
      });
      
      logger.info({
        projectId,
        syncResult: {
          processed: syncResult.processed,
          successful: syncResult.successful,
          failed: syncResult.failed,
          duration: syncResult.duration
        },
        correlationId
      }, 'Qdrant sync completed successfully');
      
      const warnings: string[] = [];
      if (syncResult.failed > 0) {
        const warningMessage = `${syncResult.failed} chunks failed to sync to Qdrant`;
        warnings.push(warningMessage);
        
        logger.warn({
          projectId,
          failedCount: syncResult.failed,
          errors: syncResult.errors,
          correlationId
        }, 'Some chunks failed to sync to Qdrant');
      }
      
      return { success: true, warnings };
    } catch (qdrantError) {
      logger.error({
        projectId,
        error: qdrantError instanceof Error ? qdrantError.message : 'Unknown error',
        correlationId
      }, 'Qdrant sync failed - continuing with sync process');
      
      // Don't fail the entire sync process for Qdrant failures
      return { success: true, warnings: ['Qdrant sync failed but sync process continued'] };
    }
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
      // Phase 1: Validation
      const validationResult = await this.executeValidationPhase(id, userId, correlationId);
      if (!validationResult.isValid) {
        return validationResult.earlyReturn!;
      }

      const project = validationResult.project!;

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

      // Phase 1.5: Strategy Determination
      const strategy = this.determineSyncStrategy(options, repositoryInfo);
      
      logger.info({
        projectId: id,
        syncId,
        strategy,
        correlationId
      }, 'Sync strategy determined');

      // Phase 2: Clone (if needed)
      const cloneResult = await this.executeClonePhase(project, strategy, syncId, correlationId);
      if (!cloneResult.success) {
        return cloneResult.errorResponse!;
      }

      const tempPath = cloneResult.tempPath;
      const cleanupRequired = cloneResult.cleanupRequired || false;

      // Phase 2: Repository Processing
      const repositoryPathInfo = this.determineRepositoryPath(tempPath, repositoryInfo);
      if (repositoryPathInfo.path) {
        logger.info({ 
          projectId: id, 
          repositoryPath: repositoryPathInfo.path,
          source: repositoryPathInfo.source,
          correlationId 
        }, 'Starting repository processing');
        
        const processingResult = await this.executeProcessingPhase(id, repositoryPathInfo.path, correlationId);
        if (!processingResult.success) {
          return processingResult.errorResponse!;
        }
      } else {
        logger.warn({ projectId: id, correlationId }, 'No repository path available for processing');
      }

      // Phase 4: Qdrant Sync
      await this.executeQdrantSyncPhase(id, correlationId);

      // Phase 5: Event Emission
      const event: ProjectSyncStartedEvent = {
        projectId: id,
        userId,
        syncId,
        repositoryUrl: repositoryInfo?.url,
        branch: strategy.targetBranch || repositoryInfo?.branch,
        timestamp: new Date().toISOString(),
        metadata: {
           force: options.force || false,
           lastSyncAt: undefined,
           tempPath,
           useTemporaryClone: strategy.useTemporaryClone
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
    } catch (unexpectedError) {
      // Safety net for truly unexpected runtime exceptions
      logger.error({
        projectId: id,
        userId,
        correlationId,
        error: unexpectedError instanceof Error ? unexpectedError.message : 'Unknown error',
        stack: unexpectedError instanceof Error ? unexpectedError.stack : undefined
      }, 'Unexpected error in syncProject - system-level exception caught');
      
      return this.createErrorResponse(
        id,
        userId,
        unexpectedError instanceof Error ? unexpectedError : new Error('Unexpected system error'),
        correlationId,
        'validation',
        undefined,
        'unexpected_error'
      );
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

  private async cloneToTemporaryDirectory(repositoryUrl: string, branch?: string, correlationId?: string): Promise<{ success: boolean; tempDir?: string; error?: string }> {
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
        return { success: false, error: `Temporary directory ${tempDir} is not accessible` };
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

      return { success: true, tempDir };
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
      return { success: false, error: errorMessage };
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
  private async processRepositoryFiles(projectId: string, repositoryPath: string, correlationId: string): Promise<{ success: boolean; error?: string }> {
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
        const fileResult = await this.processSingleFile(filePath, repositoryPath, projectId, correlationId);
        
        if (fileResult.success) {
          processedFiles++;
          
          logger.debug({
            projectId,
            filePath: filePath.replace(repositoryPath, ''),
            processedFiles,
            totalFiles: codeFiles.length,
            correlationId
          }, 'Successfully processed file');
        } else {
          failedFiles++;
          logger.error({
            projectId,
            filePath: filePath.replace(repositoryPath, ''),
            error: fileResult.error,
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
      
      return { success: true };

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
      return { success: false, error: errorMessage };
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
  ): Promise<{ success: boolean; error?: string }> {
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
      
      return { success: true };
      
    } catch (error) {
      logger.error({
        projectId,
        filePath: filePath.replace(repositoryPath, ''),
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      }, 'Failed to process file content');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
