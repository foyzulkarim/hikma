// Project API Schemas
// Extracted from project.routes.ts for better organization and reusability

export const projectResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string' }
  }
} as const;

export const projectDetailResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string' },
    repositoryUrl: { type: 'string' },
    settings: { type: 'object' }
  }
} as const;

export const projectSettingsSchema = {
  type: 'object',
  properties: {
    includePatterns: { type: 'array', items: { type: 'string' } },
    excludePatterns: { type: 'array', items: { type: 'string' } },
    maxFileSize: { type: 'number', minimum: 0 },
    enableAutoSync: { type: 'boolean' },
    syncInterval: { type: 'number', minimum: 60 },
    followSymlinks: { type: 'boolean' }
  }
} as const;

export const createProjectBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    repositoryUrl: { type: 'string', format: 'uri' },
    repositoryPath: { type: 'string' },
    branch: { type: 'string', default: 'main' },
    settings: projectSettingsSchema
  },
  required: ['name']
} as const;

export const updateProjectBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    settings: { type: 'object' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }
  }
} as const;

export const projectMemberSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string' }
  }
} as const;

export const syncResultSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    message: { type: 'string' },
    syncedFiles: { type: 'number' }
  }
} as const;

export const deleteResultSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    deletedProject: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    }
  }
} as const;