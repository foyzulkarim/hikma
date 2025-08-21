import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, createAuthMiddleware, UserContext } from '@/modules/interfaces/api/middleware/auth.js';
import { JWTUtils, ApiKeyUtils } from '@/core/utils/crypto.js';
import { prisma } from '@/config/database.js';
import { cacheService } from '@/config/redis.js';
import { logger, CorrelationIdManager } from '@/core/utils/logger.js';
import { AuthenticationError, AuthorizationError, TokenExpiredError, InvalidTokenError } from '@/core/errors/app-error.js';

// Mock external dependencies
vi.mock('@/core/utils/crypto.js', () => ({
  JWTUtils: {
    verifyToken: vi.fn(),
    generateToken: vi.fn(),
  },
  ApiKeyUtils: {
    validateApiKeyFormat: vi.fn(),
    hashApiKey: vi.fn(),
  },
}));

vi.mock('@/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/config/redis.js', () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  CorrelationIdManager: {
    generate: vi.fn(() => 'mock-correlation-id'),
  },
}));

describe('AuthService', () => {
  const mockUser: UserContext = {
    id: 'user123',
    email: 'test@example.com',
    username: 'testuser',
    role: 'USER',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateJWT', () => {
    it('should authenticate JWT and return user from cache', async () => {
      (cacheService.get as vi.Mock).mockResolvedValue(mockUser);
      (JWTUtils.verifyToken as vi.Mock).mockReturnValue({ userId: mockUser.id });

      const result = await AuthService.authenticateJWT('mock-jwt-token');
      expect(result).toEqual(mockUser);
      expect(cacheService.get).toHaveBeenCalledWith(`jwt_user:${mockUser.id}`);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should authenticate JWT and fetch user from DB if not in cache', async () => {
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (JWTUtils.verifyToken as vi.Mock).mockReturnValue({ userId: mockUser.id });
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.authenticateJWT('mock-jwt-token');
      expect(result).toEqual(mockUser);
      expect(cacheService.get).toHaveBeenCalledWith(`jwt_user:${mockUser.id}`);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUser.id }, select: expect.any(Object) });
      expect(cacheService.set).toHaveBeenCalledWith(`jwt_user:${mockUser.id}`, mockUser, expect.any(Number));
    });

    it('should throw AuthenticationError if user not found', async () => {
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (JWTUtils.verifyToken as vi.Mock).mockReturnValue({ userId: 'nonexistent' });
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(AuthService.authenticateJWT('mock-jwt-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if user is inactive', async () => {
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (JWTUtils.verifyToken as vi.Mock).mockReturnValue({ userId: mockUser.id });
      (prisma.user.findUnique as vi.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      await expect(AuthService.authenticateJWT('mock-jwt-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw TokenExpiredError for expired token', async () => {
      (JWTUtils.verifyToken as vi.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(AuthService.authenticateJWT('expired-jwt-token')).rejects.toThrow(TokenExpiredError);
    });

    it('should throw InvalidTokenError for invalid token', async () => {
      (JWTUtils.verifyToken as vi.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(AuthService.authenticateJWT('invalid-jwt-token')).rejects.toThrow(InvalidTokenError);
    });
  });

  describe('authenticateApiKey', () => {
    const mockApiKeyRecord = {
      id: 'apikey123',
      keyHash: 'hashed-api-key',
      isActive: true,
      expiresAt: null,
      user: mockUser,
    };

    it('should authenticate API key and return user from cache', async () => {
      (ApiKeyUtils.validateApiKeyFormat as vi.Mock).mockReturnValue(true);
      (ApiKeyUtils.hashApiKey as vi.Mock).mockReturnValue('hashed-api-key');
      (cacheService.get as vi.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.authenticateApiKey('valid-api-key');
      expect(result).toEqual(mockUser);
      expect(cacheService.get).toHaveBeenCalledWith('api_key:hashed-api-key');
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    });

    it('should authenticate API key and fetch user from DB if not in cache', async () => {
      (ApiKeyUtils.validateApiKeyFormat as vi.Mock).mockReturnValue(true);
      (ApiKeyUtils.hashApiKey as vi.Mock).mockReturnValue('hashed-api-key');
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (prisma.apiKey.findUnique as vi.Mock).mockResolvedValue(mockApiKeyRecord);

      const result = await AuthService.authenticateApiKey('valid-api-key');
      expect(result).toEqual(mockUser);
      expect(cacheService.get).toHaveBeenCalledWith('api_key:hashed-api-key');
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({ where: { keyHash: 'hashed-api-key' }, include: { user: expect.any(Object) } });
      expect(prisma.apiKey.update).toHaveBeenCalledWith({ where: { id: mockApiKeyRecord.id }, data: { lastUsedAt: expect.any(Date) } });
      expect(cacheService.set).toHaveBeenCalledWith('api_key:hashed-api-key', mockUser, expect.any(Number));
    });

    it('should throw InvalidTokenError for invalid API key format', async () => {
      (ApiKeyUtils.validateApiKeyFormat as vi.Mock).mockReturnValue(false);

      await expect(AuthService.authenticateApiKey('invalid-format')).rejects.toThrow(InvalidTokenError);
    });

    it('should throw AuthenticationError if API key not found', async () => {
      (ApiKeyUtils.validateApiKeyFormat as vi.Mock).mockReturnValue(true);
      (ApiKeyUtils.hashApiKey as vi.Mock).mockReturnValue('nonexistent-hash');
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (prisma.apiKey.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(AuthService.authenticateApiKey('nonexistent-key')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if API key is inactive', async () => {
      (ApiKeyUtils.validateApiKeyFormat as vi.Mock).mockReturnValue(true);
      (ApiKeyUtils.hashApiKey as vi.Mock).mockReturnValue('hashed-api-key');
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (prisma.apiKey.findUnique as vi.Mock).mockResolvedValue({ ...mockApiKeyRecord, isActive: false });

      await expect(AuthService.authenticateApiKey('inactive-key')).rejects.toThrow(AuthenticationError);
    });

    it('should throw TokenExpiredError if API key has expired', async () => {
      (ApiKeyUtils.validateApiKeyFormat as vi.Mock).mockReturnValue(true);
      (ApiKeyUtils.hashApiKey as vi.Mock).mockReturnValue('hashed-api-key');
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (prisma.apiKey.findUnique as vi.Mock).mockResolvedValue({ ...mockApiKeyRecord, expiresAt: new Date(Date.now() - 1000) });

      await expect(AuthService.authenticateApiKey('expired-key')).rejects.toThrow(TokenExpiredError);
    });

    it('should throw AuthenticationError if user linked to API key is inactive', async () => {
      (ApiKeyUtils.validateApiKeyFormat as vi.Mock).mockReturnValue(true);
      (ApiKeyUtils.hashApiKey as vi.Mock).mockReturnValue('hashed-api-key');
      (cacheService.get as vi.Mock).mockResolvedValue(null);
      (prisma.apiKey.findUnique as vi.Mock).mockResolvedValue({ ...mockApiKeyRecord, user: { ...mockUser, isActive: false } });

      await expect(AuthService.authenticateApiKey('inactive-user-key')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete user cache', async () => {
      await AuthService.invalidateUserCache(mockUser.id);
      expect(cacheService.del).toHaveBeenCalledWith(`jwt_user:${mockUser.id}`);
      expect(logger.debug).toHaveBeenCalledWith({ userId: mockUser.id }, 'User cache invalidated');
    });
  });

  describe('invalidateApiKeyCache', () => {
    it('should delete API key cache', async () => {
      const keyHash = 'test-key-hash';
      await AuthService.invalidateApiKeyCache(keyHash);
      expect(cacheService.del).toHaveBeenCalledWith(`api_key:${keyHash}`);
      expect(logger.debug).toHaveBeenCalledWith({ keyHash }, 'API key cache invalidated');
    });
  });
});

describe('createAuthMiddleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let next: vi.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
      id: 'req-123',
      correlationId: 'mock-correlation-id',
    };
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
    (CorrelationIdManager.generate as vi.Mock).mockReturnValue('mock-correlation-id');
  });

  it('should authenticate with JWT token from Authorization header', async () => {
    mockRequest.headers = { authorization: 'Bearer valid-jwt-token' };
    (AuthService.authenticateJWT as vi.Mock).mockResolvedValue({ id: 'user1', role: 'USER' });

    const middleware = createAuthMiddleware();
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next);

    expect(AuthService.authenticateJWT).toHaveBeenCalledWith('valid-jwt-token', 'mock-correlation-id');
    expect(mockRequest.user).toEqual({ id: 'user1', role: 'USER' });
    expect(mockRequest.authMethod).toBe('jwt');
    expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user1' }), 'Request authenticated successfully');
  });

  it('should authenticate with JWT token from cookies', async () => {
    mockRequest.cookies = { token: 'valid-jwt-cookie-token' };
    (AuthService.authenticateJWT as vi.Mock).mockResolvedValue({ id: 'user2', role: 'USER' });

    const middleware = createAuthMiddleware();
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next);

    expect(AuthService.authenticateJWT).toHaveBeenCalledWith('valid-jwt-cookie-token', 'mock-correlation-id');
    expect(mockRequest.user).toEqual({ id: 'user2', role: 'USER' });
    expect(mockRequest.authMethod).toBe('jwt');
  });

  it('should authenticate with API key from x-api-key header', async () => {
    mockRequest.headers = { 'x-api-key': 'valid-api-key' };
    (AuthService.authenticateApiKey as vi.Mock).mockResolvedValue({ id: 'user3', role: 'USER' });

    const middleware = createAuthMiddleware();
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next);

    expect(AuthService.authenticateApiKey).toHaveBeenCalledWith('valid-api-key', 'mock-correlation-id');
    expect(mockRequest.user).toEqual({ id: 'user3', role: 'USER' });
    expect(mockRequest.authMethod).toBe('api-key');
  });

  it('should prioritize JWT over API key if both present', async () => {
    mockRequest.headers = { authorization: 'Bearer jwt-token', 'x-api-key': 'api-key' };
    (AuthService.authenticateJWT as vi.Mock).mockResolvedValue({ id: 'user4', role: 'USER' });

    const middleware = createAuthMiddleware();
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next);

    expect(AuthService.authenticateJWT).toHaveBeenCalledWith('jwt-token', 'mock-correlation-id');
    expect(AuthService.authenticateApiKey).not.toHaveBeenCalled();
    expect(mockRequest.user).toEqual({ id: 'user4', role: 'USER' });
    expect(mockRequest.authMethod).toBe('jwt');
  });

  it('should throw AuthenticationError if required and no token provided', async () => {
    const middleware = createAuthMiddleware({ required: true });
    await expect(middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next)).rejects.toThrow(AuthenticationError);
    expect(mockRequest.user).toBeUndefined();
  });

  it('should not throw if not required and no token provided', async () => {
    const middleware = createAuthMiddleware({ required: false });
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next);
    expect(mockRequest.user).toBeUndefined();
  });

  it('should throw AuthorizationError if user role is not allowed', async () => {
    mockRequest.headers = { authorization: 'Bearer valid-jwt-token' };
    (AuthService.authenticateJWT as vi.Mock).mockResolvedValue({ id: 'user5', role: 'USER' });

    const middleware = createAuthMiddleware({ required: true, roles: ['ADMIN'] });
    await expect(middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next)).rejects.toThrow(AuthorizationError);
  });

  it('should allow if user role is allowed', async () => {
    mockRequest.headers = { authorization: 'Bearer valid-jwt-token' };
    (AuthService.authenticateJWT as vi.Mock).mockResolvedValue({ id: 'user6', role: 'ADMIN' });

    const middleware = createAuthMiddleware({ required: true, roles: ['ADMIN'] });
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next);

    expect(mockRequest.user).toEqual({ id: 'user6', role: 'ADMIN' });
  });

  it('should handle JWT expiration gracefully if API key is allowed', async () => {
    mockRequest.headers = { authorization: 'Bearer expired-jwt-token', 'x-api-key': 'valid-api-key' };
    (AuthService.authenticateJWT as vi.Mock).mockImplementation(() => {
      throw new TokenExpiredError('JWT expired');
    });
    (AuthService.authenticateApiKey as vi.Mock).mockResolvedValue({ id: 'user7', role: 'USER' });

    const middleware = createAuthMiddleware({ allowApiKey: true });
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next);

    expect(AuthService.authenticateJWT).toHaveBeenCalled();
    expect(AuthService.authenticateApiKey).toHaveBeenCalled();
    expect(mockRequest.user).toEqual({ id: 'user7', role: 'USER' });
  });

  it('should throw JWT error if API key is not allowed and JWT fails', async () => {
    mockRequest.headers = { authorization: 'Bearer expired-jwt-token' };
    (AuthService.authenticateJWT as vi.Mock).mockImplementation(() => {
      throw new TokenExpiredError('JWT expired');
    });

    const middleware = createAuthMiddleware({ allowApiKey: false });
    await expect(middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next)).rejects.toThrow(TokenExpiredError);
    expect(AuthService.authenticateApiKey).not.toHaveBeenCalled();
  });

  it('should throw AuthenticationError if both JWT and API key fail', async () => {
    mockRequest.headers = { authorization: 'Bearer invalid-jwt', 'x-api-key': 'invalid-api-key' };
    (AuthService.authenticateJWT as vi.Mock).mockImplementation(() => {
      throw new InvalidTokenError('Invalid JWT');
    });
    (AuthService.authenticateApiKey as vi.Mock).mockImplementation(() => {
      throw new AuthenticationError('Invalid API Key');
    });

    const middleware = createAuthMiddleware({ allowApiKey: true });
    await expect(middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, next)).rejects.toThrow(AuthenticationError);
  });
});


