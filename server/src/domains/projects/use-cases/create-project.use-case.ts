import { ProjectEntity } from '../entities/project.entity';
import { ProjectService } from '../services/project.service';
import { BaseUseCase, BaseRequest, BaseResponse } from './base.use-case';

export interface CreateProjectRequest extends BaseRequest {
  name: string;
  description?: string;
  repositoryUrl?: string;
  repositoryPath?: string;
  branch?: string;
  settings?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    enableAutoSync?: boolean;
    syncInterval?: number;
    followSymlinks?: boolean;
  };
}

export interface CreateProjectResponse extends BaseResponse {
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    repositoryUrl?: string;
    repositoryPath?: string;
    settings: Record<string, any>;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

export class CreateProjectUseCase extends BaseUseCase<CreateProjectRequest, CreateProjectResponse> {
  constructor(private projectService: ProjectService) {
    super();
  }

  async execute(request: CreateProjectRequest): Promise<CreateProjectResponse> {
    // Validate input
    this.validateRequest(request);

    // Generate unique slug from name
    const slug = await this.projectService.generateUniqueSlug(request.name);

    // Prepare project settings
    const settings = {
      repositoryUrl: request.repositoryUrl,
      repositoryPath: request.repositoryPath,
      branch: request.branch || 'main',
      includePatterns: request.settings?.includePatterns || ['**/*'],
      excludePatterns: request.settings?.excludePatterns || [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
      ],
      maxFileSize: request.settings?.maxFileSize || 1024 * 1024, // 1MB default
      enableAutoSync: request.settings?.enableAutoSync ?? true,
      syncInterval: request.settings?.syncInterval || 3600, // 1 hour default
      followSymlinks: request.settings?.followSymlinks ?? false
    };

    // Create project
    const project = await this.projectService.createProject({
      name: request.name,
      description: request.description,
      slug,
      userId: request.userId,
      repositoryUrl: request.repositoryUrl,
      settings
    });

    return {
      project: {
        ...project.toResponse(),
        slug: project.slug
      }
    };
  }

  protected validateRequest(request: CreateProjectRequest): void {
    // Call base validation
    super.validateRequest(request);

    // Validate project name
    this.validateRequiredString(request.name, 'Project name');
    this.validateStringLength(request.name, 'Project name', 1, 100);

    // Validate description if provided
    if (request.description) {
      this.validateStringLength(request.description, 'Project description', undefined, 500);
    }

    // Validate user ID
    this.validateRequiredString(request.userId, 'User ID');

    // Validate repository configuration
    if (!request.repositoryUrl && !request.repositoryPath) {
      throw new Error('Either repository URL or path must be provided');
    }

    if (request.repositoryUrl && request.repositoryPath) {
      throw new Error('Provide either repository URL or path, not both');
    }

    // Validate URL format if provided
    if (request.repositoryUrl) {
      this.validateRepositoryUrl(request.repositoryUrl);
    }

    // Validate settings
    if (request.settings) {
      if (request.settings.maxFileSize !== undefined) {
        this.validateNumber(request.settings.maxFileSize, 'Max file size', 0);
      }

      if (request.settings.syncInterval !== undefined) {
        this.validateNumber(request.settings.syncInterval, 'Sync interval', 60);
      }

      if (request.settings.includePatterns) {
        this.validateArray(request.settings.includePatterns, 'Include patterns', 1);
      }
    }
  }


}
