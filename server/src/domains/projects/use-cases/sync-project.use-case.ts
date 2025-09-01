import { ProjectService } from '../services/project.service';
import { ProjectSyncService, ProjectSyncResult } from '../services/project-sync.service';
import { BaseUseCase, BaseRequest, BaseResponse } from './base.use-case';
import { logger } from '@/core/utils/logger';

export interface SyncProjectRequest extends BaseRequest {
  projectId: string;
  force?: boolean; // Force sync even if recently synced
}

export interface SyncProjectResponse extends BaseResponse {
  status: 'success' | 'error' | 'in_progress';
  syncId?: string;
  project?: {
    id: string;
    name: string;
    lastSyncAt?: string;
  };
}

export class SyncProjectUseCase extends BaseUseCase<SyncProjectRequest, SyncProjectResponse> {
  constructor(
    private projectService: ProjectService,
    private syncService: ProjectSyncService
  ) {
    super();
  }

  async execute(request: SyncProjectRequest): Promise<SyncProjectResponse> {
    const correlationId = `use-case-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({
      projectId: request.projectId,
      userId: request.userId,
      force: request.force,
      correlationId
    }, 'SyncProjectUseCase.execute started');

    try {
      // Validate input
      logger.info({
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      }, 'Validating sync project request');

      this.validateRequest(request);

      logger.info({
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      }, 'Request validation completed successfully');

      // Get project to verify access and get details
      logger.info({
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      }, 'Retrieving project for sync validation');

      const project = await this.projectService.getProject(request.projectId, request.userId);

      if (!project) {
        logger.warn({
          projectId: request.projectId,
          userId: request.userId,
          correlationId
        }, 'Project not found or access denied');
        throw new Error('Project not found or access denied');
      }

      logger.info({
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      }, 'Project retrieved successfully');

      // Check if project can be synced
      logger.info({
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      }, 'Checking project sync capability');

      if (!project.canSync()) {
        logger.warn({
          projectId: project.id,
          projectName: project.name,
          userId: request.userId,
          correlationId,
          reason: 'Project sync capability check failed'
        }, 'Project cannot be synced');

        return {
          status: 'error',
          message: 'Project cannot be synced. Please check project status and repository configuration.',
          project: {
            id: project.id,
            name: project.name
          }
        };
      }

      logger.info({
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      }, 'Project sync capability confirmed');

      // Perform sync
      logger.info({
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      }, 'Initiating project sync service');

      const syncResult = await this.syncService.syncProject(request.projectId, request.userId);

      const duration = Date.now() - startTime;

      logger.info({
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId,
        syncStatus: syncResult.status,
        syncId: syncResult.syncId,
        duration
      }, 'SyncProjectUseCase.execute completed successfully');

      return {
        status: syncResult.status,
        message: syncResult.message,
        syncId: syncResult.syncId,
        project: {
          id: project.id,
          name: project.name
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during sync';
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error({
        projectId: request.projectId,
        userId: request.userId,
        correlationId,
        error: errorMessage,
        stack: errorStack,
        duration
      }, 'SyncProjectUseCase.execute failed');

      return {
        status: 'error',
        message: errorMessage
      };
    }
  }

  protected validateRequest(request: SyncProjectRequest): void {
    const correlationId = `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.debug({
      projectId: request.projectId,
      userId: request.userId,
      correlationId
    }, 'Starting request validation');

    try {
      // Call base validation
      super.validateRequest(request);

      logger.debug({
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      }, 'Base validation completed');

      // Validate project ID
      this.validateRequiredString(request.projectId, 'Project ID');

      logger.debug({
        projectId: request.projectId,
        correlationId
      }, 'Project ID validation completed');

      // Validate user ID
      this.validateRequiredString(request.userId, 'User ID');

      logger.debug({
        userId: request.userId,
        correlationId
      }, 'User ID validation completed');
    } catch (error) {
      logger.error({
        projectId: request.projectId,
        userId: request.userId,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Request validation failed');
      throw error;
    }
  }
}
