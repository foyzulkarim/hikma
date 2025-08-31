// Response Schemas
// Extracted from project.routes.ts for better organization

import { 
  projectResponseSchema, 
  projectDetailResponseSchema, 
  projectMemberSchema, 
  syncResultSchema, 
  deleteResultSchema 
} from './project.schemas';

// Success Response Schemas
export const projectListResponseSchema = {
  type: 'object',
  properties: {
    projects: {
      type: 'array',
      items: projectResponseSchema
    },
    metadata: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' }
      }
    }
  }
} as const;

export const projectDetailResponseWrapperSchema = {
  type: 'object',
  properties: {
    project: projectDetailResponseSchema
  }
} as const;

export const projectCreateResponseSchema = {
  type: 'object',
  properties: {
    project: projectDetailResponseSchema
  }
} as const;

export const projectUpdateResponseSchema = {
  type: 'object',
  properties: {
    project: projectResponseSchema
  }
} as const;

export const projectMembersResponseSchema = {
  type: 'object',
  properties: {
    members: {
      type: 'array',
      items: projectMemberSchema
    }
  }
} as const;

export const syncResponseSchema = syncResultSchema;

export const deleteResponseSchema = deleteResultSchema;

// Error Response Schemas
export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' }
  }
} as const;

export const syncErrorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    message: { type: 'string' }
  }
} as const;

// Common HTTP Response Schemas
export const httpResponseSchemas = {
  200: {},  // Will be filled by specific endpoints
  201: {},  // Will be filled by specific endpoints
  400: errorResponseSchema,
  401: errorResponseSchema,
  404: errorResponseSchema,
  500: errorResponseSchema
} as const;