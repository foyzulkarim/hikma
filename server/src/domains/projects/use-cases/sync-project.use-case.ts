import { ProjectService, ProjectSyncResult } from '../services/project.service';

export interface SyncProjectRequest {
  projectId: string;
  userId: string;
  force?: boolean; // Force sync even if recently synced
}

export interface SyncProjectResponse {
  status: 'success' | 'error' | 'in_progress';
  message: string;
  syncId?: string;
  project?: {
    id: string;
    name: string;
    lastSyncAt?: string;
  };
}

export class SyncProjectUseCase {
  constructor(private projectService: ProjectService) {}

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
      const syncResult = await this.projectService.syncProject(request.projectId, request.userId);

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

  private validateRequest(request: SyncProjectRequest): void {
    if (!request.projectId) {
      throw new Error('Project ID is required');
    }

    if (!request.userId) {
      throw new Error('User ID is required');
    }

    // Validate UUID format for projectId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(request.projectId)) {
      throw new Error('Invalid project ID format');
    }
  }
}
