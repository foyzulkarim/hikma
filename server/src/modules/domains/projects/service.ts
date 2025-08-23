import { Project, ProjectStatus, MemberRole } from '@prisma/client';
import { logger } from '@/core/utils/logger';
import { NotFoundError, ConflictError, ValidationError } from '@/core/errors/app-error';
import type { ExtractedDocument } from '@/core/types/connectors';
import { IProjectRepository } from './repository';
import { IProjectEventEmitter, ProjectEvent, ProjectCreatedPayload } from './events';
import { ProjectModuleConfig } from './config';
import { CreateProjectData, UpdateProjectData, FindOptions } from './types';

export class ProjectService {
  constructor(
    private repository: IProjectRepository,
    private eventEmitter: IProjectEventEmitter,
    private knowledgeService: any, // Existing dependency
    private config: ProjectModuleConfig
  ) {}
  /**
   * Creates a new project.
   * @param data - Project creation data.
   */
  async createProject(data: CreateProjectData, correlationId?: string): Promise<Project> {
    try {
      // Create project via repository
      const project = await this.repository.create(data);

      // Emit domain event
      this.eventEmitter.emit(ProjectEvent.CREATED, {
        projectId: project.id,
        userId: data.userId,
        timestamp: new Date(),
        correlationId,
        projectName: project.name,
        settings: data.settings || {},
      } as ProjectCreatedPayload);

      logger.info({ projectId: project.id, userId: data.userId, correlationId }, 'Project created successfully');
      return project;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ConflictError(error.message, undefined, correlationId);
      }
      throw error;
    }
  }

  /**
   * Retrieves all projects for a user.
   */
  async getProjectsForUser(userId: string, options: FindOptions = {}, correlationId?: string): Promise<Project[]> {
    logger.debug({ userId, options, correlationId }, 'Fetching projects for user');
    return await this.repository.findByUserId(userId, options);
  }

  /**
   * Retrieves a project by ID for a specific user.
   */
  async getProjectById(projectId: string, userId: string, correlationId?: string): Promise<Project | null> {
    logger.debug({ projectId, userId, correlationId }, 'Fetching project by ID');
    return await this.repository.findById(projectId, userId);
  }

  /**
   * Updates a project.
   */
  async updateProject(
    projectId: string,
    userId: string,
    updateData: UpdateProjectData,
    correlationId?: string
  ): Promise<Project> {
    try {
      const updatedProject = await this.repository.update(projectId, updateData, userId);

      // Emit domain event
      this.eventEmitter.emit(ProjectEvent.UPDATED, {
        projectId,
        userId,
        timestamp: new Date(),
        correlationId,
      });

      logger.info({ projectId, userId, correlationId }, 'Project updated successfully');
      return updatedProject;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found or insufficient permissions')) {
        throw new NotFoundError(error.message, undefined, correlationId);
      }
      throw error;
    }
  }

  /**
   * Deletes a project.
   */
  async deleteProject(projectId: string, userId: string, correlationId?: string): Promise<void> {
    try {
      await this.repository.delete(projectId, userId);

      // Emit domain event
      this.eventEmitter.emit(ProjectEvent.DELETED, {
        projectId,
        userId,
        timestamp: new Date(),
        correlationId,
      });

      logger.info({ projectId, userId, correlationId }, 'Project deleted successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found or insufficient permissions')) {
        throw new NotFoundError(error.message, undefined, correlationId);
      }
      throw error;
    }
  }

  /**
   * Syncs a project (placeholder for sync functionality).
   */
  async syncProject(projectId: string, userId: string, correlationId?: string): Promise<{ status: string; message: string }> {
    // Check if user has access to the project
    const project = await this.getProjectById(projectId, userId, correlationId);
    if (!project) {
      throw new NotFoundError('Project not found', undefined, correlationId);
    }

    // Extract repository configuration from project settings
    const settings = project.settings as Record<string, any>;
    const repositoryPath = settings?.repositoryPath as string;
    const repositoryUrl = settings?.repositoryUrl as string;
    
    if (!repositoryPath && !repositoryUrl) {
      throw new ValidationError('Project does not have repository configuration', undefined, correlationId);
    }

    logger.info({ projectId, userId, repositoryPath, repositoryUrl, correlationId }, 'Starting project sync with embedding');

    // Emit sync started event
    this.eventEmitter.emit(ProjectEvent.SYNC_STARTED, {
      projectId,
      userId,
      timestamp: new Date(),
      correlationId,
    });

    // Start the embedding process asynchronously
    this.performEmbeddingProcess(projectId, project, correlationId).catch(error => {
      logger.error({ projectId, error: error.message, correlationId }, 'Embedding process failed');
      this.handleSyncCompletion(projectId, false, error.message, correlationId);
    });

    // Update project status to indicate syncing has started
    await this.repository.update(projectId, { status: ProjectStatus.ACTIVE }, userId);
    
    return {
      status: 'success',
      message: 'Project sync and embedding process initiated successfully',
    };
  }

  /**
   * Performs the actual embedding process for a project
   */
  private async performEmbeddingProcess(projectId: string, project: any, correlationId?: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info({ projectId }, 'Starting embedding process');

      // Step 1: Initialize Git Connector
      const gitConnector = await this.initializeGitConnector(project);
      
      // Step 2: Connect to repository
      await gitConnector.connect();
      logger.info({ projectId }, 'Git connector connected successfully');

      // Step 3: Perform full sync to extract documents
      const syncResult = await gitConnector.sync('FULL_SYNC' as any);
      logger.info({ 
        projectId, 
        documentsProcessed: syncResult.documentsProcessed,
        documentsAdded: syncResult.documentsAdded 
      }, 'Git sync completed');

      // Step 4: Get extracted documents
      const documents = await gitConnector.getDocuments({
        includeContent: true,
        includeMetadata: true
      });

      logger.info({ projectId, documentCount: documents.length }, 'Documents extracted from repository');

      // Step 5: Initialize Knowledge Service
      const knowledgeService = await this.initializeKnowledgeService();
      
      // Step 6: Process documents for embedding
      await this.processDocumentsForEmbedding(projectId, documents, knowledgeService);

      // Step 7: Cleanup
      await gitConnector.disconnect();

      const duration = Date.now() - startTime;
      logger.info({ projectId, duration, documentCount: documents.length }, 'Embedding process completed successfully');

      // Mark sync as completed
      await this.handleSyncCompletion(projectId, true);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        projectId, 
        duration, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Embedding process failed');
      
      await this.handleSyncCompletion(projectId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Initialize Git Connector with project configuration
   */
  private async initializeGitConnector(project: any): Promise<any> {
    const { GitConnector } = await import('@/modules/ingestion/connectors/git-connector');
    
    const gitConfig = {
      id: `git-${project.id}`,
      name: `Git Connector for ${project.name}`,
      type: 'GIT' as any,
      enabled: true,
      settings: {
        repositoryPath: project.settings?.repositoryPath,
        repositoryUrl: project.settings?.repositoryUrl,
        branch: project.settings?.branch || 'main',
        includePatterns: project.settings?.includePatterns || ['**/*.{js,ts,jsx,tsx,py,java,cpp,c,h,cs,php,rb,go,rs,swift,kt,scala,clj,hs,ml,fs,elm,dart,lua,r,m,mm,pl,sh,bash,zsh,fish,ps1,bat,cmd,sql,html,css,scss,sass,less,xml,json,yaml,yml,toml,ini,cfg,conf,md,rst,txt,tex,org,adoc}'],
        excludePatterns: project.settings?.excludePatterns || ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**', '**/*.min.js', '**/*.bundle.js'],
        maxFileSize: project.settings?.maxFileSize || 1024 * 1024, // 1MB
        followSymlinks: project.settings?.followSymlinks || false,
      }
    };

    return new GitConnector(gitConfig);
  }

  /**
   * Initialize Knowledge Service for embedding
   */
  private async initializeKnowledgeService(): Promise<any> {
    const { KnowledgeService } = await import('@/modules/knowledge/services');
    const knowledgeService = new KnowledgeService();
    await knowledgeService.initialize();
    return knowledgeService;
  }

  /**
   * Process extracted documents for embedding
   */
  private async processDocumentsForEmbedding(
    projectId: string, 
    documents: any[], 
    knowledgeService: any
  ): Promise<void> {
    const batchSize = 10; // Process documents in batches
    const documentProcessor = knowledgeService.getDocumentProcessor();
    const vectorStore = knowledgeService.getVectorStore();

    logger.info({ projectId, totalDocuments: documents.length }, 'Starting document processing for embedding');

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      logger.info({ 
        projectId, 
        batchStart: i + 1, 
        batchEnd: Math.min(i + batchSize, documents.length),
        totalDocuments: documents.length 
      }, 'Processing document batch');

      for (const document of batch) {
        try {
          // Create chunk metadata
          const chunkMetadata = {
            documentType: document.type,
            sourceType: 'GIT',
            sourceId: document.id,
            projectId: projectId,
            title: document.title,
            path: document.metadata?.path,
            language: document.metadata?.language,
            author: document.metadata?.author,
            createdAt: document.createdAt.toISOString(),
            updatedAt: document.updatedAt.toISOString(),
            tags: document.metadata?.tags || [],
          };

          // Process document: chunk + embed + store
          const result = await documentProcessor.processDocument(
            document.id,
            document.content,
            chunkMetadata
          );

          // Store vectors in vector database
          if (result.vectors.length > 0) {
            await vectorStore.upsert(result.vectors, projectId); // Use projectId as namespace
          }

          logger.debug({ 
            projectId, 
            documentId: document.id, 
            chunksCreated: result.chunks.length,
            vectorsStored: result.vectors.length 
          }, 'Document processed successfully');

        } catch (error) {
          logger.error({ 
            projectId, 
            documentId: document.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }, 'Failed to process document');
          // Continue with other documents even if one fails
        }
      }

      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info({ projectId, totalDocuments: documents.length }, 'Document processing completed');
  }

  /**
   * Handles sync completion.
   */
  async handleSyncCompletion(projectId: string, success: boolean, error?: string, correlationId?: string): Promise<void> {
    const updateData: UpdateProjectData = {
      status: success ? ProjectStatus.ACTIVE : ProjectStatus.INACTIVE, // We don't have ERROR status
    };

    // We need to get a user ID for the repository update - for now, we'll use the first owner
    // In a real implementation, this should be passed or stored with the sync job
    const project = await this.repository.findById(projectId);
    if (project && project.members) {
      const owner = project.members.find(m => m.role === 'OWNER');
      if (owner) {
        await this.repository.update(projectId, updateData, owner.userId);
      }
    }

    // Emit completion event
    const event = success ? ProjectEvent.SYNC_COMPLETED : ProjectEvent.SYNC_FAILED;
    this.eventEmitter.emit(event, {
      projectId,
      userId: '', // This should be properly tracked
      timestamp: new Date(),
      correlationId,
    });

    logger.info({ projectId, success, error, correlationId }, 'Project sync completed');
  }
}
