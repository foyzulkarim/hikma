import { ProjectService } from '../services/project.service';
import { BaseUseCase, BaseRequest, BaseResponse } from './base.use-case';

export interface DeleteProjectRequest extends BaseRequest {
  projectId: string;
  confirmation?: string; // Optional confirmation string
}

export interface DeleteProjectResponse extends BaseResponse {
  deletedProject?: {
    id: string;
    name: string;
    slug: string;
  };
}

export class DeleteProjectUseCase extends BaseUseCase<DeleteProjectRequest, DeleteProjectResponse> {
  constructor(private projectService: ProjectService) {
    super();
  }

  async execute(request: DeleteProjectRequest): Promise<DeleteProjectResponse> {
    // Validate input
    this.validateRequest(request);

    try {
      // Get project details before deletion
      const project = await this.projectService.getProject(request.projectId, request.userId);
      
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Verify user is owner
      if (!project.isOwner(request.userId)) {
        throw new Error('Only project owners can delete projects');
      }

      // Optional: Check confirmation if project name is provided
      if (request.confirmation && request.confirmation !== project.name) {
        throw new Error('Project name confirmation does not match');
      }

      // Store project info for response
      const projectInfo = {
        id: project.id,
        name: project.name,
        slug: project.slug
      };

      // Delete project
      await this.projectService.deleteProject(request.projectId, request.userId);

      return {
        success: true,
        message: `Project "${project.name}" has been successfully deleted`,
        deletedProject: projectInfo
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred during deletion'
      };
    }
  }

  protected validateRequest(request: DeleteProjectRequest): void {
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
