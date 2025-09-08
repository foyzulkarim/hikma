// Project Event Handlers
// Handle business logic when project events occur

import { eventBus } from '@/shared/events/event-bus';
import { logger } from '@/core/utils/logger';
import {
  ProjectCreatedEvent,
  ProjectUpdatedEvent,
  ProjectDeletedEvent,
  ProjectStatusChangedEvent,
  ProjectSyncStartedEvent,
  ProjectSyncCompletedEvent,
  ProjectMemberAddedEvent,
  ProjectMemberRemovedEvent,
  ProjectMemberRoleChangedEvent,
  ProjectSettingsUpdatedEvent,
  PROJECT_EVENTS
} from './project.events';
import { ASTProcessingHandler } from '@/knowledge/handlers/ast-processing.handler';
import * as fs from 'fs/promises';
import path from 'path';

export class ProjectEventHandlers {
  private astProcessingHandler: ASTProcessingHandler;

  constructor() {
    this.astProcessingHandler = new ASTProcessingHandler();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Project lifecycle events
    eventBus.on<ProjectCreatedEvent>(PROJECT_EVENTS.PROJECT_CREATED, this.handleProjectCreated.bind(this));
    eventBus.on<ProjectUpdatedEvent>(PROJECT_EVENTS.PROJECT_UPDATED, this.handleProjectUpdated.bind(this));
    eventBus.on<ProjectDeletedEvent>(PROJECT_EVENTS.PROJECT_DELETED, this.handleProjectDeleted.bind(this));
    eventBus.on<ProjectStatusChangedEvent>(PROJECT_EVENTS.PROJECT_STATUS_CHANGED, this.handleProjectStatusChanged.bind(this));

    // Project sync events
    eventBus.on<ProjectSyncStartedEvent>(PROJECT_EVENTS.PROJECT_SYNC_STARTED, this.handleProjectSyncStarted.bind(this));
    eventBus.on<ProjectSyncCompletedEvent>(PROJECT_EVENTS.PROJECT_SYNC_COMPLETED, this.handleProjectSyncCompleted.bind(this));

    // Project member events
    eventBus.on<ProjectMemberAddedEvent>(PROJECT_EVENTS.PROJECT_MEMBER_ADDED, this.handleProjectMemberAdded.bind(this));
    eventBus.on<ProjectMemberRemovedEvent>(PROJECT_EVENTS.PROJECT_MEMBER_REMOVED, this.handleProjectMemberRemoved.bind(this));
    eventBus.on<ProjectMemberRoleChangedEvent>(PROJECT_EVENTS.PROJECT_MEMBER_ROLE_CHANGED, this.handleProjectMemberRoleChanged.bind(this));

    // Project settings events
    eventBus.on<ProjectSettingsUpdatedEvent>(PROJECT_EVENTS.PROJECT_SETTINGS_UPDATED, this.handleProjectSettingsUpdated.bind(this));

    logger.info('Project event handlers initialized');
  }

  private async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        projectName: event.projectName,
        slug: event.slug
      }, 'Project created event received');

      // TODO: Add business logic for project creation
      // Examples:
      // - Send welcome email to project owner
      // - Initialize default project settings
      // - Create default project structure
      // - Trigger initial sync if repository URL provided
      // - Update user analytics
      // - Send notifications to relevant stakeholders

      if (event.repositoryUrl && event.metadata?.source === 'api') {
        logger.info({ projectId: event.projectId }, 'Project created with repository - consider triggering initial sync');
      }

    } catch (error) {
      logger.error({ error, event }, 'Error handling project created event');
    }
  }

  private async handleProjectUpdated(event: ProjectUpdatedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        changes: Object.keys(event.changes)
      }, 'Project updated event received');

      // TODO: Add business logic for project updates
      // Examples:
      // - Invalidate caches
      // - Update search indices
      // - Notify project members of changes
      // - Update analytics
      // - Trigger workflows based on changes

      // Handle specific change types
      if (event.changes.status) {
        logger.info({
          projectId: event.projectId,
          oldStatus: event.changes.status.old,
          newStatus: event.changes.status.new
        }, 'Project status changed as part of update');
      }

    } catch (error) {
      logger.error({ error, event }, 'Error handling project updated event');
    }
  }

  private async handleProjectDeleted(event: ProjectDeletedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        projectName: event.projectName,
        memberCount: event.metadata?.memberCount
      }, 'Project deleted event received');

      // TODO: Add business logic for project deletion
      // Examples:
      // - Clean up related resources
      // - Send notifications to former members
      // - Archive project data
      // - Update user analytics
      // - Cancel scheduled tasks
      // - Clean up external integrations

    } catch (error) {
      logger.error({ error, event }, 'Error handling project deleted event');
    }
  }

  private async handleProjectStatusChanged(event: ProjectStatusChangedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        automatic: event.metadata?.automatic
      }, 'Project status changed event received');

      // TODO: Add business logic for status changes
      // Examples:
      // - Enable/disable scheduled syncs
      // - Update project visibility
      // - Notify project members
      // - Trigger cleanup for inactive projects
      // - Update metrics and analytics

    } catch (error) {
      logger.error({ error, event }, 'Error handling project status changed event');
    }
  }

  private async handleProjectSyncStarted(event: ProjectSyncStartedEvent): Promise<void> {
    const correlationId = `sync-started-${event.syncId}`;
    
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        syncId: event.syncId,
        repositoryUrl: event.repositoryUrl,
        force: event.metadata?.force,
        tempPath: event.metadata?.tempPath,
        correlationId
      }, 'Project sync started event received - initiating AST processing');

      // If we have a temporary clone file_path, process files with AST parsing
      if (event.metadata?.tempPath) {
        await this.processRepositoryWithAST(event, correlationId);
      } else {
        logger.warn({
          projectId: event.projectId,
          syncId: event.syncId,
          correlationId
        }, 'No tempPath available for AST processing - skipping code analysis');
      }

    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        event, 
        correlationId 
      }, 'Error handling project sync started event');
    }
  }

  private async handleProjectSyncCompleted(event: ProjectSyncCompletedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        syncId: event.syncId,
        status: event.status,
        documentsProcessed: event.documentsProcessed,
        duration: event.duration
      }, 'Project sync completed event received');

      // TODO: Add business logic for sync completion
      // Examples:
      // - Update project last sync timestamp
      // - Send completion notifications
      // - Update search indices
      // - Generate sync reports
      // - Update project analytics
      // - Schedule next sync if auto-sync enabled
      // - Handle sync errors and retries

      if (event.status === 'error' && event.metadata?.errors) {
        logger.warn({
          projectId: event.projectId,
          syncId: event.syncId,
          errors: event.metadata.errors
        }, 'Project sync completed with errors');
      }

    } catch (error) {
      logger.error({ error, event }, 'Error handling project sync completed event');
    }
  }

  private async handleProjectMemberAdded(event: ProjectMemberAddedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        memberId: event.memberId,
        memberEmail: event.memberEmail,
        role: event.role,
        source: event.metadata?.source
      }, 'Project member added event received');

      // TODO: Add business logic for member addition
      // Examples:
      // - Send welcome email to new member
      // - Update project member count
      // - Grant access permissions
      // - Send notifications to project admins
      // - Update analytics
      // - Trigger onboarding workflows

    } catch (error) {
      logger.error({ error, event }, 'Error handling project member added event');
    }
  }

  private async handleProjectMemberRemoved(event: ProjectMemberRemovedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        memberId: event.memberId,
        memberEmail: event.memberEmail,
        previousRole: event.previousRole,
        reason: event.metadata?.reason
      }, 'Project member removed event received');

      // TODO: Add business logic for member removal
      // Examples:
      // - Revoke access permissions
      // - Update project member count
      // - Send farewell notifications
      // - Archive member contributions
      // - Update analytics
      // - Clean up member-specific resources

    } catch (error) {
      logger.error({ error, event }, 'Error handling project member removed event');
    }
  }

  private async handleProjectMemberRoleChanged(event: ProjectMemberRoleChangedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        memberId: event.memberId,
        memberEmail: event.memberEmail,
        oldRole: event.oldRole,
        newRole: event.newRole
      }, 'Project member role changed event received');

      // TODO: Add business logic for role changes
      // Examples:
      // - Update access permissions
      // - Send role change notifications
      // - Update member capabilities
      // - Log security events
      // - Update analytics
      // - Trigger role-specific workflows

    } catch (error) {
      logger.error({ error, event }, 'Error handling project member role changed event');
    }
  }

  private async handleProjectSettingsUpdated(event: ProjectSettingsUpdatedEvent): Promise<void> {
    try {
      logger.info({
        projectId: event.projectId,
        userId: event.userId,
        changes: Object.keys(event.changes),
        triggeredSync: event.metadata?.triggeredSync
      }, 'Project settings updated event received');

      // TODO: Add business logic for settings updates
      // Examples:
      // - Validate new settings
      // - Update sync schedules
      // - Trigger immediate sync if repository changed
      // - Update project capabilities
      // - Notify project members of important changes
      // - Update search and indexing configurations

      // Handle repository URL changes
      if (event.changes.repositoryUrl) {
        logger.info({
          projectId: event.projectId,
          oldUrl: event.changes.repositoryUrl.old,
          newUrl: event.changes.repositoryUrl.new
        }, 'Project repository URL changed - consider triggering sync');
      }

      // Handle auto-sync setting changes
      if (event.changes.enableAutoSync) {
        logger.info({
          projectId: event.projectId,
          oldValue: event.changes.enableAutoSync.old,
          newValue: event.changes.enableAutoSync.new
        }, 'Project auto-sync setting changed');
      }

    } catch (error) {
      logger.error({ error, event }, 'Error handling project settings updated event');
    }
  }

  /**
   * Process repository files with AST parsing
   */
  private async processRepositoryWithAST(event: ProjectSyncStartedEvent, correlationId: string): Promise<void> {
    const tempPath = event.metadata?.tempPath;
    if (!tempPath) {
      throw new Error('tempPath is required for AST processing');
    }

    logger.info({
      projectId: event.projectId,
      syncId: event.syncId,
      tempPath,
      correlationId
    }, 'Starting AST processing for repository files');

    try {
      // Get all code files from the repository
      const codeFiles = await this.getCodeFiles(tempPath);
      
      logger.info({
        projectId: event.projectId,
        syncId: event.syncId,
        totalFiles: codeFiles.length,
        correlationId
      }, 'Found code files for AST processing');

      let processedFiles = 0;
      let failedFiles = 0;

      // Process each code file with AST parsing
      for (const filePath of codeFiles) {
        try {
          await this.processFileWithAST(filePath, tempPath, event, correlationId);
          processedFiles++;
          
          logger.debug({
            projectId: event.projectId,
            filePath: filePath.replace(tempPath, ''),
            processedFiles,
            totalFiles: codeFiles.length,
            correlationId
          }, 'Successfully processed file with AST');
          
        } catch (fileError) {
          failedFiles++;
          logger.error({
            projectId: event.projectId,
            filePath: filePath.replace(tempPath, ''),
            error: fileError instanceof Error ? fileError.message : 'Unknown error',
            correlationId
          }, 'Failed to process file with AST');
        }
      }

      logger.info({
        projectId: event.projectId,
        syncId: event.syncId,
        processedFiles,
        failedFiles,
        totalFiles: codeFiles.length,
        correlationId
      }, 'Completed AST processing for repository');

    } catch (error) {
      logger.error({
        projectId: event.projectId,
        syncId: event.syncId,
        tempPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        correlationId
      }, 'Failed to process repository with AST');
      throw error;
    }
  }

  /**
   * Get all code files from the repository directory
   */
  private async getCodeFiles(repositoryPath: string): Promise<string[]> {
    const codeFiles: string[] = [];
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.cc', '.cxx', '.c++', '.c', '.h', '.cs'];
    
    const traverseDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common directories that shouldn't be parsed
            if (!this.shouldSkipDirectory(entry.name)) {
              await traverseDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              codeFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        logger.warn({
          dirPath,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Failed to read directory during code file discovery');
      }
    };

    await traverseDirectory(repositoryPath);
    return codeFiles;
  }

  /**
   * Process a single file with AST parsing
   */
  private async processFileWithAST(
    filePath: string, 
    repositoryPath: string, 
    event: ProjectSyncStartedEvent, 
    correlationId: string
  ): Promise<void> {
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Get relative path from repository root
      const relativePath = path.relative(repositoryPath, filePath);
      
      // Determine file language from extension
      const language = this.getLanguageFromPath(filePath);
      
      // Process with AST handler
      const result = await this.astProcessingHandler.handleASTProcessing({
        projectId: event.projectId,
        filePath: relativePath,
        content,
        language,
        sourceId: event.syncId, // Using syncId as sourceId
        sourceType: 'git'
      });

      if (!result.success) {
        logger.warn({
          projectId: event.projectId,
          filePath: relativePath,
          error: result.error,
          correlationId
        }, 'AST processing returned unsuccessful result');
      }

    } catch (error) {
      logger.error({
        projectId: event.projectId,
        filePath: filePath.replace(repositoryPath, ''),
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      }, 'Error processing file with AST');
      throw error;
    }
  }

  /**
   * Check if directory should be skipped during traversal
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules', '.git', '.svn', '.hg', '.bzr',
      'dist', 'build', 'target', 'bin', 'obj',
      '.next', '.nuxt', 'out', 'coverage',
      '__pycache__', '.pytest_cache', '.tox',
      'vendor', '.bundle', '.cache', '.temp', '.tmp'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Get programming language from file path
   */
  private getLanguageFromPath(filePath: string): string {
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
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c++': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.cs': 'csharp'
    };
    
    return languageMap[ext] || 'unknown';
  }
}

// Export singleton instance
export const projectEventHandlers = new ProjectEventHandlers();