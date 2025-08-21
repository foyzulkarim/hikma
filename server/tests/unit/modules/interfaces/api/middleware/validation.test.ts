import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { createValidationMiddleware, commonSchemas, ValidationHelpers } from '@/modules/interfaces/api/middleware/validation.js';
import { ValidationError } from '@/core/errors/app-error.js';
import { logger } from '@/core/utils/logger.js';

// Mock logger
vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('createValidationMiddleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      id: 'req-123',
      url: '/test',
      method: 'POST',
      correlationId: 'mock-correlation-id',
      body: {},
      params: {},
      query: {},
      headers: {},
    };
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    vi.clearAllMocks();
  });

  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(18),
  });

  it('should validate request body and replace it with validated data', async () => {
    mockRequest.body = { name: 'Test', age: 25 };
    const middleware = createValidationMiddleware(testSchema, 'body');

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.body).toEqual({ name: 'Test', age: 25 });
    expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ target: 'body' }), 'Request validation successful');
  });

  it('should throw ValidationError for invalid request body', async () => {
    mockRequest.body = { name: '', age: 17 };
    const middleware = createValidationMiddleware(testSchema, 'body');

    await expect(middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)).rejects.toThrow(ValidationError);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ target: 'body' }), 'Request validation failed');
  });

  it('should validate request params and replace it with validated data', async () => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    mockRequest.params = { id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' };
    const middleware = createValidationMiddleware(paramsSchema, 'params');

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.params).toEqual({ id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' });
  });

  it('should validate request query and replace it with validated data', async () => {
    const querySchema = z.object({ limit: z.coerce.number().min(1) });
    mockRequest.query = { limit: '10' };
    const middleware = createValidationMiddleware(querySchema, 'query');

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.query).toEqual({ limit: 10 });
  });

  it('should validate request headers but not replace them', async () => {
    const headersSchema = z.object({ 'x-api-key': z.string() });
    mockRequest.headers = { 'x-api-key': 'some-key' };
    const originalHeaders = { ...mockRequest.headers };
    const middleware = createValidationMiddleware(headersSchema, 'headers');

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.headers).toEqual(originalHeaders); // Headers should not be replaced
  });

  it('should handle unknown fields based on stripUnknown option (default true)', async () => {
    mockRequest.body = { name: 'Test', age: 25, extraField: 'should be stripped' };
    const middleware = createValidationMiddleware(testSchema, 'body');

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.body).toEqual({ name: 'Test', age: 25 });
  });

  it('should not strip unknown fields if stripUnknown is false', async () => {
    mockRequest.body = { name: 'Test', age: 25, extraField: 'should remain' };
    const middleware = createValidationMiddleware(testSchema, 'body', { stripUnknown: false });

    await expect(middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)).rejects.toThrow(ValidationError); // strict() will throw if unknown fields are present
  });

  it('should allow unknown fields if allowUnknown is true (and stripUnknown is false)', async () => {
    const lenientSchema = z.object({ name: z.string() }).passthrough(); // passthrough allows unknown keys
    mockRequest.body = { name: 'Test', extraField: 'should remain' };
    const middleware = createValidationMiddleware(lenientSchema, 'body', { stripUnknown: false, allowUnknown: true });

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.body).toEqual({ name: 'Test', extraField: 'should remain' });
  });
});

describe('commonSchemas', () => {
  it('should validate id schema (cuid)', () => {
    const validId = 'clx9x0y1z000001qwe123abc';
    expect(() => commonSchemas.id.parse(validId)).not.toThrow();
    expect(() => commonSchemas.id.parse('invalid-id')).toThrow(ZodError);
  });

  it('should validate uuid schema', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
    expect(() => commonSchemas.uuid.parse(validUuid)).not.toThrow();
    expect(() => commonSchemas.uuid.parse('invalid-uuid')).toThrow(ZodError);
  });

  it('should validate pagination schema', () => {
    expect(commonSchemas.pagination.parse({})).toEqual({ page: 1, limit: 20, sortOrder: 'desc' });
    expect(commonSchemas.pagination.parse({ page: '2', limit: '50', sortBy: 'name', sortOrder: 'asc' })).toEqual({ page: 2, limit: 50, sortBy: 'name', sortOrder: 'asc' });
    expect(() => commonSchemas.pagination.parse({ page: 0 })).toThrow(ZodError);
  });

  it('should validate search schema', () => {
    expect(commonSchemas.search.parse({ q: 'test' })).toEqual({ q: 'test', topK: 10 });
    expect(commonSchemas.search.parse({ q: 'test', filters: { type: 'code' }, topK: '5' })).toEqual({ q: 'test', filters: { type: 'code' }, topK: 5 });
    expect(() => commonSchemas.search.parse({ q: '' })).toThrow(ZodError);
  });

  it('should validate dateRange schema', () => {
    expect(commonSchemas.dateRange.parse({})).toEqual({});
    expect(commonSchemas.dateRange.parse({ startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-02T00:00:00Z' })).toEqual({ startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-02T00:00:00Z' });
    expect(() => commonSchemas.dateRange.parse({ startDate: '2023-01-02T00:00:00Z', endDate: '2023-01-01T00:00:00Z' })).toThrow(ZodError);
  });

  it('should validate userCreate schema', () => {
    const validUser = { email: 'test@example.com', username: 'testuser', password: 'password123' };
    expect(() => commonSchemas.userCreate.parse(validUser)).not.toThrow();
    expect(commonSchemas.userCreate.parse(validUser).role).toBe('USER'); // Default role
    expect(() => commonSchemas.userCreate.parse({ ...validUser, email: 'invalid' })).toThrow(ZodError);
  });

  it('should validate userUpdate schema', () => {
    const validUpdate = { username: 'newusername', isActive: true };
    expect(() => commonSchemas.userUpdate.parse(validUpdate)).not.toThrow();
    expect(() => commonSchemas.userUpdate.parse({ email: 'invalid' })).toThrow(ZodError);
  });

  it('should validate login schema', () => {
    const validLogin = { email: 'test@example.com', password: 'password123' };
    expect(() => commonSchemas.login.parse(validLogin)).not.toThrow();
    expect(() => commonSchemas.login.parse({ email: 'test@example.com', password: '' })).toThrow(ZodError);
  });

  it('should validate changePassword schema', () => {
    const validChange = { currentPassword: 'oldpassword', newPassword: 'newpassword123' };
    expect(() => commonSchemas.changePassword.parse(validChange)).not.toThrow();
  });

  it('should validate projectCreate schema', () => {
    const validProject = { name: 'My Project', slug: 'my-project' };
    expect(() => commonSchemas.projectCreate.parse(validProject)).not.toThrow();
    expect(commonSchemas.projectCreate.parse(validProject).settings).toEqual({});
    expect(() => commonSchemas.projectCreate.parse({ name: 'Invalid Project', slug: 'Invalid Project' })).toThrow(ZodError);
  });

  it('should validate projectUpdate schema', () => {
    const validUpdate = { name: 'Updated Name', status: 'ARCHIVED' };
    expect(() => commonSchemas.projectUpdate.parse(validUpdate)).not.toThrow();
  });

  it('should validate dataSourceCreate schema', () => {
    const validDataSource = { name: 'Git Source', type: 'GIT', config: { url: 'http://example.com' } };
    expect(() => commonSchemas.dataSourceCreate.parse(validDataSource)).not.toThrow();
  });

  it('should validate dataSourceUpdate schema', () => {
    const validUpdate = { config: { branch: 'main' }, status: 'ACTIVE' };
    expect(() => commonSchemas.dataSourceUpdate.parse(validUpdate)).not.toThrow();
  });

  it('should validate queryCreate schema', () => {
    const validQuery = { query: 'What is this code?', projectId: 'clx9x0y1z000001qwe123abc' };
    expect(() => commonSchemas.queryCreate.parse(validQuery)).not.toThrow();
  });

  it('should validate feedbackCreate schema', () => {
    const validFeedback = { type: 'THUMBS_UP' };
    expect(() => commonSchemas.feedbackCreate.parse(validFeedback)).not.toThrow();
    expect(() => commonSchemas.feedbackCreate.parse({ type: 'RATING', rating: 3 })).not.toThrow();
  });

  it('should validate apiKeyCreate schema', () => {
    const validApiKey = { name: 'My API Key' };
    expect(() => commonSchemas.apiKeyCreate.parse(validApiKey)).not.toThrow();
  });

  it('should validate webhookCreate schema', () => {
    const validWebhook = { name: 'My Webhook', url: 'http://example.com/webhook', events: ['push'] };
    expect(() => commonSchemas.webhookCreate.parse(validWebhook)).not.toThrow();
  });

  it('should validate webhookUpdate schema', () => {
    const validUpdate = { url: 'http://new.com/webhook', status: 'INACTIVE' };
    expect(() => commonSchemas.webhookUpdate.parse(validUpdate)).not.toThrow();
  });
});

describe('ValidationHelpers', () => {
  it('createEnumSchema should create a valid enum schema', () => {
    const statusEnum = ValidationHelpers.createEnumSchema(['ACTIVE', 'INACTIVE']);
    expect(() => statusEnum.parse('ACTIVE')).not.toThrow();
    expect(() => statusEnum.parse('PENDING')).toThrow(ZodError);
  });

  it('createOptionalStringSchema should create an optional string schema', () => {
    const schema = ValidationHelpers.createOptionalStringSchema();
    expect(() => schema.parse(undefined)).not.toThrow();
    expect(() => schema.parse('hello')).not.toThrow();
    expect(() => schema.parse('')).toThrow(ZodError); // minLength 1
  });

  it('createRequiredStringSchema should create a required string schema', () => {
    const schema = ValidationHelpers.createRequiredStringSchema();
    expect(() => schema.parse('hello')).not.toThrow();
    expect(() => schema.parse(undefined)).toThrow(ZodError);
  });

  it('createNumberSchema should create a number schema with min/max', () => {
    const schema = ValidationHelpers.createNumberSchema(0, 100);
    expect(() => schema.parse(50)).not.toThrow();
    expect(() => schema.parse(-1)).toThrow(ZodError);
    expect(() => schema.parse(101)).toThrow(ZodError);
  });

  it('createArraySchema should create an array schema with min/max items', () => {
    const schema = ValidationHelpers.createArraySchema(z.string(), 1, 3);
    expect(() => schema.parse(['a'])).not.toThrow();
    expect(() => schema.parse(['a', 'b', 'c'])).not.toThrow();
    expect(() => schema.parse([])).toThrow(ZodError);
    expect(() => schema.parse(['a', 'b', 'c', 'd'])).toThrow(ZodError);
  });

  it('createDateSchema should create a date schema with future/past validation', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const now = new Date().toISOString();

    const futureSchema = ValidationHelpers.createDateSchema(true, false);
    expect(() => futureSchema.parse(futureDate)).not.toThrow();
    expect(() => futureSchema.parse(pastDate)).toThrow(ZodError);

    const pastSchema = ValidationHelpers.createDateSchema(false, true);
    expect(() => pastSchema.parse(pastDate)).not.toThrow();
    expect(() => pastSchema.parse(futureDate)).toThrow(ZodError);

    const anyDateSchema = ValidationHelpers.createDateSchema();
    expect(() => anyDateSchema.parse(now)).not.toThrow();
  });
});


