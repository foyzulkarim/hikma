import { ProjectService } from '../services/project.service';
import { ProjectSyncService, ProjectSyncResult } from '../services/project-sync.service';
import { BaseUseCase, BaseRequest, BaseResponse } from './base.use-case';

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
    // Validate input
    this.validateRequest(request);

    try {
      // Get project to verify access and get details
      const project = await this.projectService.getProject(request.projectId, request.userId);
      
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Check if project can be synced
      if (!project.canSync()) {
        return {
          status: 'error',
          message: 'Project cannot be synced. Please check project status and repository configuration.',
          project: {
            id: project.id,
            name: project.name
          }
        };
      }

      // Perform sync
      const syncResult = await this.syncService.syncProject(request.projectId, request.userId);

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
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred during sync'
      };
    }
  }

  protected validateRequest(request: SyncProjectRequest): void {
    // Call base validation
    super.validateRequest(request);

    // Validate project ID
    this.validateRequiredString(request.projectId, 'Project ID');

    // Validate user ID
    this.validateRequiredString(request.userId, 'User ID');

    // Validate UUID format for projectId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(request.projectId)) {
      throw new Error('Invalid project ID format');
    }
  }
}
