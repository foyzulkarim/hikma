import { ProjectEntity, ProjectSyncInfo } from '../entities/project.entity';

export interface FindProjectsOptions {
  limit?: number;
  offset?: number;
  status?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProjectData {
  name: string;
  description?: string | null;
  slug: string;
  userId: string;
  repositoryUrl?: string;
  settings?: Record<string, any>;
}

export interface UpdateProjectData {
  name?: string;
  description?: string | null;
  settings?: Record<string, any>;
  status?: string;
  syncInfo?: Partial<ProjectSyncInfo>;
}

export interface ProjectListResult {
  projects: ProjectEntity[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface IProjectRepository {
  // Core CRUD operations
  create(data: CreateProjectData): Promise<ProjectEntity>;
  findById(id: string, userId?: string): Promise<ProjectEntity | null>;
  findBySlug(slug: string, userId: string): Promise<ProjectEntity | null>;
  update(id: string, data: UpdateProjectData, userId: string): Promise<ProjectEntity>;
  delete(id: string, userId: string): Promise<void>;

  // Query operations
  findByUserId(userId: string, options?: FindProjectsOptions): Promise<ProjectListResult>;

  count(userId?: string): Promise<number>;
  exists(id: string, userId?: string): Promise<boolean>;

  // Validation operations
  isSlugAvailable(slug: string, excludeId?: string): Promise<boolean>;
  
  // Access control
  canUserAccess(projectId: string, userId: string): Promise<boolean>;
  canUserModify(projectId: string, userId: string): Promise<boolean>;

  // Sync status management
  updateSyncStatus(projectId: string, syncInfo: Partial<ProjectSyncInfo>): Promise<ProjectEntity>;
}
