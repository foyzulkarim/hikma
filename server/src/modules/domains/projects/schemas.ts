import { z } from 'zod';
import { projectConfig } from './config';

// Base schemas
export const ProjectIdSchema = z.string().cuid('Invalid project ID format');

export const SlugSchema = z.string()
  .min(1, 'Slug is required')
  .max(50, 'Slug cannot exceed 50 characters')
  .regex(projectConfig.slugPattern, 'Slug must contain only lowercase letters, numbers, and hyphens');

// Request schemas
export const CreateProjectRequestSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(projectConfig.maxProjectNameLength, `Project name cannot exceed ${projectConfig.maxProjectNameLength} characters`),
  description: z.string()
    .max(projectConfig.maxDescriptionLength, `Description cannot exceed ${projectConfig.maxDescriptionLength} characters`)
    .optional(),
  repositoryUrl: z.string().url('Invalid repository URL').optional(),
  repositoryPath: z.string().optional(),
  settings: z.object({
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
    enableAutoSync: z.boolean().optional(),
    syncInterval: z.number().optional(),
    followSymlinks: z.boolean().optional(),
  }).optional(),
});

export const UpdateProjectRequestSchema = CreateProjectRequestSchema.partial();

export const SyncProjectRequestSchema = z.object({
  force: z.boolean().optional(),
  incremental: z.boolean().optional(),
});

// Query schemas
export const ProjectListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Parameter schemas
export const ProjectParamsSchema = z.object({
  projectId: ProjectIdSchema
});