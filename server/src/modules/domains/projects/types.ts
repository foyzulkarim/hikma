import { JsonValue } from '@prisma/client/runtime/library';
import { ProjectStatus, MemberRole } from '@prisma/client';

// Core domain interfaces
export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  settings: JsonValue; // Prisma Json type
  createdAt: Date;
  updatedAt: Date;
  // Relationships (when included)
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
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
  status?: ProjectStatus;
}

// Re-export Prisma enums for module independence
export type { ProjectStatus, MemberRole } from '@prisma/client';

export interface ProjectSettings {
  repositoryUrl?: string;
  repositoryPath?: string;
  branch?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  enableAutoSync?: boolean;
  syncInterval?: number;
  followSymlinks?: boolean;
}

// Repository query options
export interface FindOptions {
  limit?: number;
  offset?: number;
  status?: ProjectStatus;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// Response DTOs
export interface ProjectListResponse {
  projects: Project[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ProjectSyncResponse {
  status: string;
  message: string;
  syncId?: string;
}

// Sanitized project for API responses
export interface ProjectResponse {
  id: string;
  name: string;
  description?: string | null;
  repositoryUrl?: string;
  repositoryPath?: string;
  settings: Record<string, any>;
  status: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  stats?: any;
}
