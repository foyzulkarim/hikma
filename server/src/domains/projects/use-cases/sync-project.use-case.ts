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

    logger.info('SyncProjectUseCase.execute started', {
      projectId: request.projectId,
      userId: request.userId,
      force: request.force,
      correlationId
    });

    try {
      // Validate input
      logger.info('Validating sync project request', {
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      });

      this.validateRequest(request);

      logger.info('Request validation completed successfully', {
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      });

      // Get project to verify access and get details
      logger.info('Retrieving project for sync validation', {
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      });

      const project = await this.projectService.getProject(request.projectId, request.userId);

      if (!project) {
        logger.warn('Project not found or access denied', {
          projectId: request.projectId,
          userId: request.userId,
          correlationId
        });
        throw new Error('Project not found or access denied');
      }

      logger.info('Project retrieved successfully', {
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      });

      // Check if project can be synced
      logger.info('Checking project sync capability', {
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      });

      if (!project.canSync()) {
        logger.warn('Project cannot be synced', {
          projectId: project.id,
          projectName: project.name,
          userId: request.userId,
          correlationId,
          reason: 'Project sync capability check failed'
        });

        return {
          status: 'error',
          message: 'Project cannot be synced. Please check project status and repository configuration.',
          project: {
            id: project.id,
            name: project.name
          }
        };
      }

      logger.info('Project sync capability confirmed', {
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      });

      // Perform sync
      logger.info('Initiating project sync service', {
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId
      });

      const syncResult = await this.syncService.syncProject(request.projectId, request.userId);

      const duration = Date.now() - startTime;

      logger.info('SyncProjectUseCase.execute completed successfully', {
        projectId: project.id,
        projectName: project.name,
        userId: request.userId,
        correlationId,
        syncStatus: syncResult.status,
        syncId: syncResult.syncId,
        duration
      });

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

      logger.error('SyncProjectUseCase.execute failed', {
        projectId: request.projectId,
        userId: request.userId,
        correlationId,
        error: errorMessage,
        stack: errorStack,
        duration
      });

      return {
        status: 'error',
        message: errorMessage
      };
    }
  }

  protected validateRequest(request: SyncProjectRequest): void {
    const correlationId = `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.debug('Starting request validation', {
      projectId: request.projectId,
      userId: request.userId,
      correlationId
    });

    try {
      // Call base validation
      super.validateRequest(request);

      logger.debug('Base validation completed', {
        projectId: request.projectId,
        userId: request.userId,
        correlationId
      });

      // Validate project ID
      this.validateRequiredString(request.projectId, 'Project ID');

      logger.debug('Project ID validation completed', {
        projectId: request.projectId,
        correlationId
      });

      // Validate user ID
      this.validateRequiredString(request.userId, 'User ID');

      logger.debug('User ID validation completed', {
        userId: request.userId,
        correlationId
      });
    } catch (error) {
      logger.error('Request validation failed', {
        projectId: request.projectId,
        userId: request.userId,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}
