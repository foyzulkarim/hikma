// Query and Parameter Schemas
// Extracted from project.routes.ts for better organization

export const projectIdParamSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' }
  },
  required: ['id']
} as const;

export const projectListQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    offset: { type: 'number', minimum: 0, default: 0 },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'], default: 'updatedAt' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
  }
} as const;