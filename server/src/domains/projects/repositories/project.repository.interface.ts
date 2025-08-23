import { ProjectEntity } from '../entities/project.entity';

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
  settings?: Record<string, any>;
}

export interface UpdateProjectData {
  name?: string;
  description?: string | null;
  settings?: Record<string, any>;
  status?: string;
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
  findAll(options?: FindProjectsOptions): Promise<ProjectListResult>;
  count(userId?: string): Promise<number>;
  exists(id: string, userId?: string): Promise<boolean>;

  // Member operations
  addMember(projectId: string, userId: string, role: string): Promise<void>;
  removeMember(projectId: string, userId: string): Promise<void>;
  updateMemberRole(projectId: string, userId: string, role: string): Promise<void>;
  getMembers(projectId: string): Promise<Array<{
    id: string;
    userId: string;
    role: string;
    createdAt: Date;
  }>>;

  // Validation operations
  isSlugAvailable(slug: string, excludeId?: string): Promise<boolean>;
  canUserAccess(projectId: string, userId: string): Promise<boolean>;
  canUserModify(projectId: string, userId: string): Promise<boolean>;
}
