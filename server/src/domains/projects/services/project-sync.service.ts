import { ProjectEntity } from '../entities/project.entity';
import { IProjectRepository } from '../repositories/project.repository.interface';
import { eventBus } from '@/shared/events/event-bus';
import { PROJECT_EVENTS, ProjectSyncStartedEvent, ProjectSyncCompletedEvent } from '../events/project.events';
import { GhCliService } from '@/shared/services/gh-cli.service';
import { GitService } from '@/shared/services/git.service';
import { TempDirectoryManager } from '@/shared/utils/temp-directory.util';
import { logger } from '@/core/utils/logger';
import { ValidationError, ExternalServiceError } from '@/core/errors/app-error';
import { ASTProcessingHandler, ASTProcessingEvent } from '@/knowledge/handlers/ast-processing.handler';
import { chunkSyncService } from '@/knowledge/services/chunk-sync.service';
import { PrismaClient } from '@prisma/client';
import { Neo4jChunkService, Neo4jChunkNode, ChunkRelationshipType } from '@/knowledge/services/neo4j-chunk.service';
import { EmbeddingService } from '@/knowledge/services/embedding.service';
import { CodeChunk as EmbeddingCodeChunk } from '@/core/types/embeddings';
import { MethodMetricsService } from '@/shared/services/method-metrics.service';
import { ChunkTransformer } from '../utils/chunk-transformer.util';

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

export interface SetupResult {
  project: ProjectEntity;
  syncId: string;
  strategy: SyncStrategy;
  repositoryInfo: any;
  correlationId: string;
}

export interface CloneResult {
  success: boolean;
  repositoryPath?: string;
  tempPath?: string;
  cleanupRequired?: boolean;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  language: string;
  metadata: {
    nodeType: string;
    nodeName?: string;
    startLine: number;
    endLine: number;
    signature?: string;
  };
  projectId: string;
}

export interface PostgresSaveResult {
  success: boolean;
  savedChunks: number;
  errors: string[];
}

export interface Neo4jSaveResult {
  success: boolean;
  savedNodes: number;
  savedRelationships: number;
  errors: string[];
}

export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  success: boolean;
  error?: string;
}

export interface QdrantSaveResult {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

export interface FinalizeResult {
  status: 'success' | 'in_progress';
  message: string;
  syncId: string;
  tempPath?: string;
  cleanupRequired?: boolean;
}

export class ProjectSyncService {
  private ghCliService: GhCliService;
  private gitService: GitService;
  private tempManager: TempDirectoryManager;
  private astProcessingHandler: ASTProcessingHandler;
  private prisma: PrismaClient;
  private neo4jChunkService: Neo4jChunkService;
  private embeddingService: EmbeddingService;
  private metricsService: MethodMetricsService;

  constructor(
    private projectRepository: IProjectRepository,
    metricsService?: MethodMetricsService
  ) {
    this.ghCliService = new GhCliService();
    this.gitService = new GitService();
    this.tempManager = TempDirectoryManager.getInstance();
    this.astProcessingHandler = new ASTProcessingHandler();
    this.prisma = new PrismaClient();
    this.neo4jChunkService = new Neo4jChunkService();
    this.embeddingService = new EmbeddingService();
    this.metricsService = metricsService || new MethodMetricsService();
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

  private async setupSync(
    id: string,
    userId: string,
    options: SyncOptions,
    correlationId: string
  ): Promise<SetupResult> {
    // Execute validation phase
    const validationResult = await this.executeValidationPhase(id, userId, correlationId);
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.earlyReturn!.message, correlationId);
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

    // Determine sync strategy
    const strategy = this.determineSyncStrategy(options, repositoryInfo);
    
    logger.info({
      projectId: id,
      syncId,
      strategy,
      correlationId
    }, 'Sync strategy determined');

    return {
      project,
      syncId,
      strategy,
      repositoryInfo,
      correlationId
    };
  }

  private async cloneRepository(
    setupResult: SetupResult,
    correlationId: string
  ): Promise<CloneResult> {
    const { project, syncId, strategy } = setupResult;

    // If no temporary cloning required or not using URL source, use existing path
    if (!strategy.useTemporaryClone || strategy.source !== 'url') {
      const repositoryInfo = project.getRepositoryInfo();
      return {
        success: true,
        repositoryPath: strategy.repositoryPath || repositoryInfo?.path || '',
        cleanupRequired: false
      };
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
      throw new ExternalServiceError(
        `Failed to clone repository: ${cloneResult.error}`,
        correlationId
      );
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
      repositoryPath: cloneResult.tempDir!,
      tempPath: cloneResult.tempDir, 
      cleanupRequired: true 
    };
  }

  private async processRepository(
    repositoryPath: string,
    projectId: string,
    correlationId: string
  ): Promise<CodeChunk[]> {
    const startTime = Date.now();
    
    logger.info({
      projectId,
      repositoryPath,
      correlationId
    }, 'Starting repository AST processing and chunk generation');

    try {
      // Get all code files from the repository
      const codeFiles = await this.getCodeFiles(repositoryPath);
      
      logger.info({
        projectId,
        repositoryPath,
        totalFiles: codeFiles.length,
        correlationId
      }, 'Found code files for processing');

      const chunks: CodeChunk[] = [];
      let processedFiles = 0;
      let failedFiles = 0;

      // Process each code file
      for (const filePath of codeFiles) {
        try {
          // Read file content
          const fs = await import('fs');
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = filePath.replace(repositoryPath, '').replace(/^\//, '');
          const language = await this.getLanguageFromPath(filePath);

          // For simplicity, create a single chunk per file for now
          // TODO: In the future, we could use the AST handler to get more granular chunks
          const chunkId = `${projectId}-${relativePath}-1-${content.split('\n').length}`;
          
          const chunk: CodeChunk = {
            id: chunkId,
            filePath: relativePath,
            content,
            language,
            metadata: {
              nodeType: 'file',
              nodeName: relativePath.split('/').pop() || '',
              startLine: 1,
              endLine: content.split('\n').length,
              signature: undefined
            },
            projectId
          };
          
          chunks.push(chunk);
          processedFiles++;
          
          logger.debug({
            projectId,
            filePath: relativePath,
            processedFiles,
            totalFiles: codeFiles.length,
            chunksExtracted: 1,
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
        totalChunks: chunks.length,
        duration,
        correlationId
      }, 'Repository AST processing completed');
      
      return chunks;

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
      
      throw new ExternalServiceError(
        `Failed to process repository: ${errorMessage}`,
        correlationId
      );
    }
  }

  private async saveChunksToPostgres(
    chunks: CodeChunk[],
    projectId: string,
    correlationId: string
  ): Promise<PostgresSaveResult> {
    const startTime = Date.now();
    
    logger.info({
      projectId,
      totalChunks: chunks.length,
      correlationId
    }, 'Starting PostgreSQL chunk save operation');

    try {
      // Group chunks by file path for efficient processing
      const chunksByFile = this.groupChunksByFile(chunks);
      
      // Get existing repository or create new one
      const repository = await this.ensureRepositoryExists(projectId);
      
      // Process all file chunks in batches
      const result = await this.processBatchChunkSave(chunksByFile, repository, correlationId);

      const duration = Date.now() - startTime;
      
      logger.info({
        projectId,
        totalChunks: chunks.length,
        savedChunks: result.saved,
        failedChunks: result.errors.length,
        duration,
        correlationId
      }, 'PostgreSQL chunk save operation completed');

      return {
        success: result.errors.length === 0 || result.saved > 0,
        savedChunks: result.saved,
        errors: result.errors
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error({
        projectId,
        totalChunks: chunks.length,
        error: errorMessage,
        duration,
        correlationId
      }, 'PostgreSQL chunk save operation failed');
      
      return {
        success: false,
        savedChunks: 0,
        errors: [errorMessage]
      };
    }
  }

  private async saveChunksToNeo4j(
    chunks: CodeChunk[],
    projectId: string,
    correlationId: string
  ): Promise<Neo4jSaveResult> {
    const startTime = Date.now();
    
    logger.info({
      projectId,
      totalChunks: chunks.length,
      correlationId
    }, 'Starting Neo4j chunk save operation');

    const errors: string[] = [];
    let savedNodes = 0;
    let savedRelationships = 0;

    try {
      // Use ChunkTransformer to convert CodeChunks to Neo4jChunkNodes
      const neo4jNodes: Neo4jChunkNode[] = ChunkTransformer.toNeo4jFormat(chunks, projectId);

      // Save nodes in batches
      const batchSize = 100;
      for (let i = 0; i < neo4jNodes.length; i += batchSize) {
        const batch = neo4jNodes.slice(i, i + batchSize);
        
        try {
          await this.neo4jChunkService.batchCreateChunkNodes(batch);
          savedNodes += batch.length;
          
          logger.debug({
            projectId,
            batchNumber: Math.floor(i / batchSize) + 1,
            batchSize: batch.length,
            totalBatches: Math.ceil(neo4jNodes.length / batchSize),
            correlationId
          }, 'Neo4j chunk batch saved successfully');
          
        } catch (batchError) {
          const errorMsg = `Failed to save Neo4j chunk batch ${Math.floor(i / batchSize) + 1}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error({
            projectId,
            batchNumber: Math.floor(i / batchSize) + 1,
            error: errorMsg,
            correlationId
          }, 'Failed to save Neo4j chunk batch');
        }
      }

      // TODO: Implement relationship extraction and creation
      // For now, we'll focus on saving the nodes
      // Relationships would be created based on code analysis:
      // - CALLS relationships between functions
      // - IMPORTS relationships for dependencies
      // - CONTAINS relationships for classes/methods
      
      const duration = Date.now() - startTime;
      
      logger.info({
        projectId,
        totalChunks: chunks.length,
        savedNodes,
        savedRelationships,
        failedOperations: errors.length,
        duration,
        correlationId
      }, 'Neo4j chunk save operation completed');

      return {
        success: errors.length === 0 || savedNodes > 0,
        savedNodes,
        savedRelationships,
        errors
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error({
        projectId,
        totalChunks: chunks.length,
        error: errorMessage,
        duration,
        correlationId
      }, 'Neo4j chunk save operation failed');
      
      errors.push(errorMessage);
      
      return {
        success: false,
        savedNodes,
        savedRelationships,
        errors
      };
    }
  }

  private async generateEmbeddings(
    chunks: CodeChunk[],
    correlationId: string
  ): Promise<EmbeddingResult[]> {
    const startTime = Date.now();
    
    logger.info({
      totalChunks: chunks.length,
      correlationId
    }, 'Starting embedding generation for code chunks');

    try {
      // Use ChunkTransformer to convert to EmbeddingService format
      const embeddingChunks: EmbeddingCodeChunk[] = ChunkTransformer.toEmbeddingFormat(chunks);
      logger.info({
        totalChunks: chunks.length,
        correlationId
      }, 'Converted chunks to embedding format');

      // Generate embeddings using the embedding service
      const embeddingMap = await this.embeddingService.embedChunks(embeddingChunks);

      // Convert results to our EmbeddingResult format
      const results: EmbeddingResult[] = chunks.map(chunk => {
        const embedding = embeddingMap.get(chunk.id);
        
        if (embedding) {
          return {
            chunkId: chunk.id,
            embedding,
            success: true
          };
        } else {
          return {
            chunkId: chunk.id,
            embedding: [],
            success: false,
            error: 'Failed to generate embedding'
          };
        }
      });

      const successfulEmbeddings = results.filter(r => r.success).length;
      const failedEmbeddings = results.filter(r => !r.success).length;
      const duration = Date.now() - startTime;

      logger.info({
        totalChunks: chunks.length,
        successfulEmbeddings,
        failedEmbeddings,
        duration,
        correlationId
      }, 'Completed embedding generation for code chunks');

      return results;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error({
        totalChunks: chunks.length,
        error: errorMessage,
        duration,
        correlationId
      }, 'Failed to generate embeddings for code chunks');

      // Return failed results for all chunks
      return chunks.map(chunk => ({
        chunkId: chunk.id,
        embedding: [],
        success: false,
        error: errorMessage
      }));
    }
  }

  private async saveChunksToQdrant(
    chunks: CodeChunk[],
    embeddings: EmbeddingResult[],
    projectId: string,
    correlationId: string
  ): Promise<QdrantSaveResult> {
    const startTime = Date.now();
    
    logger.info({
      projectId,
      totalChunks: chunks.length,
      totalEmbeddings: embeddings.length,
      correlationId
    }, 'Starting Qdrant chunk save operation');

    try {
      // Use the existing chunkSyncService to sync chunks to Qdrant
      // This service will automatically handle embedding generation and Qdrant operations
      const syncResult = await chunkSyncService.syncChunksToQdrant({
        projectId,
        skipExisting: false,
        batchSize: 10
      });
      
      const duration = Date.now() - startTime;
      
      logger.info({
        projectId,
        syncResult: {
          processed: syncResult.processed,
          successful: syncResult.successful,
          failed: syncResult.failed,
          duration: syncResult.duration
        },
        totalDuration: duration,
        correlationId
      }, 'Qdrant chunk save operation completed');
      
      const warnings: string[] = [];
      const errors: string[] = [];
      
      if (syncResult.failed > 0) {
        const warningMessage = `${syncResult.failed} chunks failed to sync to Qdrant`;
        warnings.push(warningMessage);
        
        if (syncResult.errors && Array.isArray(syncResult.errors)) {
          errors.push(...syncResult.errors.map(e => e.toString()));
        }
        
        logger.warn({
          projectId,
          failedCount: syncResult.failed,
          errors: syncResult.errors,
          correlationId
        }, 'Some chunks failed to sync to Qdrant');
      }
      
      return {
        success: syncResult.successful > 0,
        processed: syncResult.processed,
        successful: syncResult.successful,
        failed: syncResult.failed,
        errors,
        warnings
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error({
        projectId,
        totalChunks: chunks.length,
        error: errorMessage,
        duration,
        correlationId
      }, 'Qdrant chunk save operation failed');
      
      return {
        success: false,
        processed: 0,
        successful: 0,
        failed: chunks.length,
        errors: [errorMessage],
        warnings: []
      };
    }
  }

  private async finalizeSync(
    setupResult: SetupResult,
    cloneResult: CloneResult,
    options: SyncOptions,
    userId: string,
    correlationId: string,
    startTime: number
  ): Promise<FinalizeResult> {
    const { project, syncId } = setupResult;
    
    logger.info({
      projectId: project.id,
      syncId,
      correlationId
    }, 'Starting sync finalization phase');

    try {
      // Emit PROJECT_SYNC_STARTED event
      const repositoryInfo = project.getRepositoryInfo();
      const event: ProjectSyncStartedEvent = {
        projectId: project.id!,
        userId, // Use the actual userId parameter 
        syncId,
        repositoryUrl: repositoryInfo?.url,
        branch: setupResult.strategy.targetBranch || repositoryInfo?.branch,
        timestamp: new Date().toISOString(),
        metadata: {
           force: options.force || false,
           lastSyncAt: undefined,
           tempPath: cloneResult.tempPath,
           useTemporaryClone: setupResult.strategy.useTemporaryClone
         }
      };
      
      logger.info({
        projectId: project.id,
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
        projectId: project.id,
        syncId,
        status: 'in_progress',
        tempPath: cloneResult.tempPath,
        cleanupRequired: cloneResult.cleanupRequired,
        duration,
        correlationId
      }, 'ProjectSyncService.syncProject finalization completed successfully');

      // Return immediate response (actual sync happens asynchronously)
      return {
        status: 'in_progress',
        message: 'Project sync started successfully',
        syncId,
        tempPath: cloneResult.tempPath,
        cleanupRequired: cloneResult.cleanupRequired
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;
      
      logger.error({
        projectId: project.id,
        syncId,
        error: errorMessage,
        duration,
        correlationId
      }, 'Failed to finalize sync');
      
      throw new ExternalServiceError(
        `Failed to finalize sync: ${errorMessage}`,
        correlationId
      );
    }
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
    
    return await this.metricsService.trackMethodPerformance(
      'syncProject',
      async () => {
        logger.info({
          projectId: id,
          userId,
          options,
          correlationId
        }, 'ProjectSyncService.syncProject started');

        // Phase 1: Setup & Validation
        const setupResult = await this.setupSync(id, userId, options, correlationId);

        // Phase 2: Clone Repository  
        const cloneResult = await this.cloneRepository(setupResult, correlationId);
        
        // Phase 3: Parse Codebase
        const chunks = await this.processRepository(cloneResult.repositoryPath!, setupResult.project.id!, correlationId);
        
        // Phase 4: Save to Databases
        await this.saveChunksToPostgres(chunks, setupResult.project.id!, correlationId);
        await this.saveChunksToNeo4j(chunks, setupResult.project.id!, correlationId);
        
        // Phase 5: Generate Embeddings & Save to Qdrant
        const embeddings = await this.generateEmbeddings(chunks, correlationId);
        await this.saveChunksToQdrant(chunks, embeddings, setupResult.project.id!, correlationId);
        
        // Phase 6: Finalize
        const startTime = Date.now(); // For finalizeSync compatibility
        const finalResult = await this.finalizeSync(setupResult, cloneResult, options, userId, correlationId, startTime);
        
        return finalResult as ProjectSyncResult;
      },
      correlationId
    );
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
      const language = await this.getLanguageFromPath(filePath);
      
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
  private async getLanguageFromPath(filePath: string): Promise<string> {
    const path = await import('path');
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

  // Helper methods for PostgreSQL chunk save decomposition

  /**
   * Group chunks by file path for efficient processing
   * @param chunks - Array of CodeChunk objects
   * @returns Map with filePath as key, chunks array as value
   */
  private groupChunksByFile(chunks: CodeChunk[]): Map<string, CodeChunk[]> {
    const chunksByFile = new Map<string, CodeChunk[]>();
    for (const chunk of chunks) {
      if (!chunksByFile.has(chunk.filePath)) {
        chunksByFile.set(chunk.filePath, []);
      }
      chunksByFile.get(chunk.filePath)!.push(chunk);
    }
    return chunksByFile;
  }

  /**
   * Get existing repository or create new one
   * @param projectId - Project ID
   * @returns Repository entity
   */
  private async ensureRepositoryExists(projectId: string): Promise<any> {
    // Get or create repository record
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { dataSources: true }
    });

    if (!project || project.dataSources.length === 0) {
      throw new Error(`Project ${projectId} not found or has no data sources`);
    }

    const dataSourceId = project.dataSources[0].id;

    let repository = await this.prisma.repository.findFirst({
      where: { dataSourceId }
    });

    if (!repository) {
      repository = await this.prisma.repository.create({
        data: {
          dataSourceId,
          name: project.name,
          url: project.repositoryUrl || null
        }
      });
    }

    return repository;
  }

  /**
   * Process all file chunks in batches
   * @param chunksByFile - Grouped chunks by file path
   * @param repository - Repository entity
   * @param correlationId - Correlation ID for tracking
   * @returns Save result with success metrics
   */
  private async processBatchChunkSave(
    chunksByFile: Map<string, CodeChunk[]>, 
    repository: any, 
    correlationId: string
  ): Promise<{saved: number, errors: string[]}> {
    const errors: string[] = [];
    let savedChunks = 0;

    // Process each file and its chunks
    for (const [filePath, fileChunks] of chunksByFile) {
      try {
        // Create CodeFile record
        const codeFile = await this.createCodeFileRecord(filePath, repository, fileChunks[0].language);
        
        // Save all chunks for this file
        const result = await this.saveChunksForFile(fileChunks, codeFile, correlationId);
        savedChunks += result.saved;
        errors.push(...result.errors);

      } catch (fileError) {
        const errorMsg = `Failed to process file ${filePath}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.error({
          filePath,
          error: errorMsg,
          correlationId
        }, 'Failed to process file for PostgreSQL save');
      }
    }

    return { saved: savedChunks, errors };
  }

  /**
   * Find or create CodeFile record
   * @param filePath - File path
   * @param repository - Repository entity
   * @param language - Programming language
   * @returns CodeFile entity
   */
  private async createCodeFileRecord(filePath: string, repository: any, language: string): Promise<any> {
    // Find existing CodeFile record
    let codeFile = await this.prisma.codeFile.findFirst({
      where: {
        repositoryId: repository.id,
        filePath
      }
    });

    if (!codeFile) {
      codeFile = await this.prisma.codeFile.create({
        data: {
          repositoryId: repository.id,
          filePath,
          language,
          lastModified: new Date()
        }
      });
    }

    return codeFile;
  }

  /**
   * Save all chunks for a specific file
   * @param chunks - Chunks for one file
   * @param codeFile - CodeFile entity
   * @param correlationId - Correlation ID for tracking
   * @returns Save metrics (count saved, errors encountered)
   */
  private async saveChunksForFile(
    chunks: CodeChunk[], 
    codeFile: any, 
    correlationId: string
  ): Promise<{saved: number, errors: string[]}> {
    const errors: string[] = [];
    let saved = 0;

    // Create chunks for this file
    for (const chunk of chunks) {
      try {
        await this.prisma.codeChunk.create({
          data: {
            fileId: codeFile.id,
            startLine: chunk.metadata.startLine,
            endLine: chunk.metadata.endLine,
            codeContent: chunk.content,
            nodeType: chunk.metadata.nodeType,
            nodeName: chunk.metadata.nodeName || null,
            signature: chunk.metadata.signature || null,
            hasDocstring: false,
            hasErrorHandling: false,
            hasTests: false,
            isExported: false,
            isAsync: false,
            isGenerator: false,
            isStatic: false
          }
        });
        
        saved++;
        
      } catch (chunkError) {
        const errorMsg = `Failed to save chunk ${chunk.id}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.error({
          chunkId: chunk.id,
          filePath: chunk.filePath,
          error: errorMsg,
          correlationId
        }, 'Failed to save chunk to PostgreSQL');
      }
    }

    return { saved, errors };
  }
}
