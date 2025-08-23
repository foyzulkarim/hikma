import { ProjectEntity } from '../entities/project.entity';
import { ProjectService } from '../services/project.service';

export interface CreateProjectRequest {
  name: string;
  description?: string;
  repositoryUrl?: string;
  repositoryPath?: string;
  branch?: string;
  userId: string;
  settings?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    enableAutoSync?: boolean;
    syncInterval?: number;
    followSymlinks?: boolean;
  };
}

export interface CreateProjectResponse {
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

export class CreateProjectUseCase {
  constructor(private projectService: ProjectService) {}

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
      settings
    });

    return {
      project: {
        ...project.toResponse(),
        slug: project.slug
      }
    };
  }

  private validateRequest(request: CreateProjectRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    if (request.name.length > 100) {
      throw new Error('Project name must be 100 characters or less');
    }

    if (request.description && request.description.length > 500) {
      throw new Error('Project description must be 500 characters or less');
    }

    if (!request.userId) {
      throw new Error('User ID is required');
    }

    // Validate repository configuration
    if (!request.repositoryUrl && !request.repositoryPath) {
      throw new Error('Either repository URL or path must be provided');
    }

    if (request.repositoryUrl && request.repositoryPath) {
      throw new Error('Provide either repository URL or path, not both');
    }

    // Validate URL format if provided
    if (request.repositoryUrl && !this.isValidRepositoryUrl(request.repositoryUrl)) {
      throw new Error('Invalid repository URL format');
    }

    // Validate settings
    if (request.settings) {
      if (request.settings.maxFileSize && request.settings.maxFileSize < 0) {
        throw new Error('Max file size must be positive');
      }

      if (request.settings.syncInterval && request.settings.syncInterval < 60) {
        throw new Error('Sync interval must be at least 60 seconds');
      }

      if (request.settings.includePatterns && request.settings.includePatterns.length === 0) {
        throw new Error('At least one include pattern is required');
      }
    }
  }

  private isValidRepositoryUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:', 'git:'].includes(parsedUrl.protocol);
    } catch {
      // Check for SSH format
      return /^git@[\w.-]+:[\w.-]+\/[\w.-]+\.git$/.test(url);
    }
  }
}
