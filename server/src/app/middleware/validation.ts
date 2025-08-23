import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from '@/core/errors/app-error';
import { logger } from '@/core/utils/logger';

// Validation target types
export type ValidationTarget = 'body' | 'params' | 'query' | 'headers';

// Validation options
export interface ValidationOptions {
  stripUnknown?: boolean;
  allowUnknown?: boolean;
  abortEarly?: boolean;
}

// Validation middleware factory
export function createValidationMiddleware(
  schema: ZodSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, allowUnknown = false } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const correlationId = request.correlationId;

    try {
      let dataToValidate: any;

      // Extract data based on target
      switch (target) {
        case 'body':
          dataToValidate = request.body;
          break;
        case 'params':
          dataToValidate = request.params;
          break;
        case 'query':
          dataToValidate = request.query;
          break;
        case 'headers':
          dataToValidate = request.headers;
          break;
        default:
          throw new Error(`Invalid validation target: ${target}`);
      }

      // Configure schema based on options
      let validationSchema = schema;
      
      if (stripUnknown && 'strict' in schema && typeof schema.strict === 'function') {
        validationSchema = schema.strict();
      }

      // Validate data
      const validatedData = validationSchema.parse(dataToValidate);

      // Replace the original data with validated data
      switch (target) {
        case 'body':
          request.body = validatedData;
          break;
        case 'params':
          request.params = validatedData;
          break;
        case 'query':
          request.query = validatedData;
          break;
        case 'headers':
          // Don't replace headers as it might break other middleware
          break;
      }

      logger.debug({
        target,
        correlationId,
        url: request.url,
        method: request.method,
      }, 'Request validation successful');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        target,
        correlationId,
        url: request.url,
        method: request.method,
      }, 'Request validation failed');

      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: 'received' in err ? err.received : undefined,
        }));

        throw new ValidationError(
          'Request validation failed',
          { target, errors: validationErrors },
          correlationId
        );
      }

      throw new ValidationError(
        'Request validation failed',
        { target, error: error instanceof Error ? error.message : 'Unknown error' },
        correlationId
      );
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  // ID validation
  id: z.string().cuid('Invalid ID format'),
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Search
  search: z.object({
    q: z.string().min(1).max(500),
    filters: z.record(z.any()).optional(),
    topK: z.coerce.number().int().min(1).max(50).default(10),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'Start date must be before end date',
      path: ['dateRange'],
    }
  ),

  // User schemas
  userCreate: z.object({
    email: z.string().email('Invalid email format'),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    password: z.string().min(8).max(128),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    role: z.enum(['ADMIN', 'USER', 'VIEWER']).default('USER'),
  }),

  userUpdate: z.object({
    email: z.string().email('Invalid email format').optional(),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens').optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional(),
    isActive: z.boolean().optional(),
  }),

  // Authentication schemas
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8).max(128),
  }),

  // Project schemas
  projectCreate: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
    settings: z.record(z.any()).default({}),
  }),

  projectUpdate: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
    settings: z.record(z.any()).optional(),
  }),

  // Data source schemas
  dataSourceCreate: z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['GIT', 'GITHUB', 'JIRA', 'SLACK', 'CONFLUENCE', 'FILE_UPLOAD']),
    config: z.record(z.any()),
  }),

  dataSourceUpdate: z.object({
    name: z.string().min(1).max(200).optional(),
    config: z.record(z.any()).optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'ERROR', 'DISABLED']).optional(),
  }),

  // Query schemas
  queryCreate: z.object({
    query: z.string().min(1).max(5000),
    projectId: z.string().cuid('Invalid project ID'),
    sessionId: z.string().optional(),
    metadata: z.record(z.any()).default({}),
  }),

  // Feedback schemas
  feedbackCreate: z.object({
    type: z.enum(['THUMBS_UP', 'THUMBS_DOWN', 'RATING', 'COMMENT']),
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
    metadata: z.record(z.any()).default({}),
  }),

  // API Key schemas
  apiKeyCreate: z.object({
    name: z.string().min(1).max(200),
    expiresAt: z.string().datetime().optional(),
  }),

  // Webhook schemas
  webhookCreate: z.object({
    name: z.string().min(1).max(200),
    url: z.string().url('Invalid webhook URL'),
    secret: z.string().min(1).max(500).optional(),
    events: z.array(z.string()).min(1, 'At least one event must be specified'),
  }),

  webhookUpdate: z.object({
    name: z.string().min(1).max(200).optional(),
    url: z.string().url('Invalid webhook URL').optional(),
    secret: z.string().min(1).max(500).optional(),
    events: z.array(z.string()).min(1, 'At least one event must be specified').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ERROR']).optional(),
  }),
};

// Convenience validation middleware functions
export const validateBody = (schema: ZodSchema, options?: ValidationOptions) =>
  createValidationMiddleware(schema, 'body', options);

export const validateParams = (schema: ZodSchema, options?: ValidationOptions) =>
  createValidationMiddleware(schema, 'params', options);

export const validateQuery = (schema: ZodSchema, options?: ValidationOptions) =>
  createValidationMiddleware(schema, 'query', options);

export const validateHeaders = (schema: ZodSchema, options?: ValidationOptions) =>
  createValidationMiddleware(schema, 'headers', options);

// Common validation middleware instances
export const validatePagination = validateQuery(commonSchemas.pagination);
export const validateSearch = validateQuery(commonSchemas.search);
export const validateDateRange = validateQuery(commonSchemas.dateRange);
export const validateId = validateParams(z.object({ id: commonSchemas.id }));
export const validateUuid = validateParams(z.object({ id: commonSchemas.uuid }));

// File upload validation
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
} = {}) => {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [], required = true } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const correlationId = request.correlationId;

    try {
      const files = request.files();
      const fileArray: any[] = [];

      for await (const file of files) {
        fileArray.push(file);
      }

      if (required && fileArray.length === 0) {
        throw new ValidationError(
          'File upload is required',
          { field: 'file' },
          correlationId
        );
      }

      for (const file of fileArray) {
        // Check file size
        if (file.file.bytesRead > maxSize) {
          throw new ValidationError(
            `File size exceeds maximum allowed size of ${maxSize} bytes`,
            { 
              field: 'file',
              filename: file.filename,
              size: file.file.bytesRead,
              maxSize,
            },
            correlationId
          );
        }

        // Check file type
        if (allowedTypes.length > 0) {
          const fileExtension = file.filename.toLowerCase().split('.').pop();
          if (!fileExtension || !allowedTypes.includes(`.${fileExtension}`)) {
            throw new ValidationError(
              `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
              {
                field: 'file',
                filename: file.filename,
                extension: fileExtension,
                allowedTypes,
              },
              correlationId
            );
          }
        }
      }

      logger.debug({
        fileCount: fileArray.length,
        correlationId,
      }, 'File upload validation successful');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      }, 'File upload validation failed');

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError(
        'File upload validation failed',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        correlationId
      );
    }
  };
};

// Custom validation helpers
export class ValidationHelpers {
  static createEnumSchema<T extends readonly [string, ...string[]]>(values: T) {
    return z.enum(values);
  }

  static createOptionalStringSchema(minLength = 1, maxLength = 1000) {
    return z.string().min(minLength).max(maxLength).optional();
  }

  static createRequiredStringSchema(minLength = 1, maxLength = 1000) {
    return z.string().min(minLength).max(maxLength);
  }

  static createNumberSchema(min?: number, max?: number) {
    let schema = z.number();
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema;
  }

  static createArraySchema<T>(itemSchema: ZodSchema<T>, minItems = 0, maxItems?: number) {
    let schema = z.array(itemSchema).min(minItems);
    if (maxItems !== undefined) schema = schema.max(maxItems);
    return schema;
  }

  static createDateSchema(future = false, past = false): z.ZodType<string> {
    let schema: z.ZodType<string> = z.string().datetime();
    
    if (future) {
      schema = schema.refine(
        (date) => new Date(date) > new Date(),
        { message: 'Date must be in the future' }
      );
    }
    
    if (past) {
      schema = schema.refine(
        (date) => new Date(date) < new Date(),
        { message: 'Date must be in the past' }
      );
    }
    
    return schema;
  }
}

// Export validateRequest as an alias for validateBody for backward compatibility
export const validateRequest = validateBody;

// Export is already handled by the class declaration above

