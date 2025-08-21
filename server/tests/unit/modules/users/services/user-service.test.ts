import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { UserService } from '@/modules/users/services/user-service.js';
import { PasswordUtils, JWTUtils } from '@/core/utils/crypto.js';
import { logger } from '@/core/utils/logger.js';
import { AuthenticationError, ConflictError, NotFoundError } from '@/core/errors/app-error.js';
import { appConfig } from '@/config/app.js';

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

// Mock crypto utilities
vi.mock('@/core/utils/crypto.js', () => ({
  PasswordUtils: {
    hashPassword: vi.fn((password) => Promise.resolve(`hashed-${password}`)),
    verifyPassword: vi.fn((password, hash) => Promise.resolve(`hashed-${password}` === hash)),
  },
  JWTUtils: {
    generateToken: vi.fn((payload, expiresIn) => Promise.resolve(`mock-token-${JSON.stringify(payload)}-${expiresIn}`)),
    verifyToken: vi.fn((token) => {
      if (token.includes('invalid')) throw new Error('Invalid token');
      if (token.includes('expired')) throw new Error('Expired token');
      if (token.includes('refresh')) return Promise.resolve({ userId: 'user123', type: 'refresh' });
      if (token.includes('reset')) return Promise.resolve({ userId: 'user123', type: 'reset' });
      return Promise.resolve({ userId: 'user123', email: 'test@example.com', role: 'user' });
    }),
  },
}));

// Mock logger
vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock appConfig for JWT expiry
vi.mock('@/config/app.js', () => ({
  appConfig: {
    security: {
      jwtExpiresIn: '1h',
      jwtRefreshExpiresIn: '7d',
      jwtExpiresInSeconds: 3600,
    },
  },
}));

describe('UserService', () => {
  let userService: UserService;
  let prisma: PrismaClient;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    password: 'hashed-password',
    name: 'Test User',
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    userService = new UserService();
    prisma = new PrismaClient(); // Re-initialize mock Prisma for each test
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);
      (prisma.user.create as vi.Mock).mockResolvedValue(mockUser);

      const result = await userService.registerUser({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
      expect(PasswordUtils.hashPassword).toHaveBeenCalledWith('password123');
      expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          password: 'hashed-password',
          name: 'New User',
        }),
      }));
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userId: mockUser.id }), 'User registered successfully');
    });

    it('should throw ConflictError if user already exists', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);

      await expect(userService.registerUser({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })).rejects.toThrow(ConflictError);
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('loginUser', () => {
    it('should log in a user successfully', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as vi.Mock).mockResolvedValue(mockUser);

      const result = await userService.loginUser('test@example.com', 'password');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(PasswordUtils.verifyPassword).toHaveBeenCalledWith('password', 'hashed-password');
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userId: mockUser.id }), 'User logged in successfully');
    });

    it('should throw AuthenticationError for invalid email', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(userService.loginUser('nonexistent@example.com', 'password')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for invalid password', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);
      (PasswordUtils.verifyPassword as vi.Mock).mockResolvedValue(false);

      await expect(userService.loginUser('test@example.com', 'wrong-password')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if user is inactive', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      await expect(userService.loginUser('test@example.com', 'password')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('refreshAuthToken', () => {
    it('should refresh tokens successfully', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);

      const result = await userService.refreshAuthToken('mock-token-refresh');

      expect(JWTUtils.verifyToken).toHaveBeenCalledWith('mock-token-refresh');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user123' } });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw AuthenticationError for invalid refresh token', async () => {
      await expect(userService.refreshAuthToken('invalid-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if user not found or inactive', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(userService.refreshAuthToken('mock-token-refresh')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);

      const user = await userService.getUserById('user123');
      expect(user).toEqual(mockUser);
    });

    it('should throw NotFoundError if user not found', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(userService.getUserById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as vi.Mock).mockResolvedValue(mockUser);

      await userService.changePassword('user123', 'password', 'new-password');

      expect(PasswordUtils.verifyPassword).toHaveBeenCalledWith('password', 'hashed-password');
      expect(PasswordUtils.hashPassword).toHaveBeenCalledWith('new-password');
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user123' },
        data: expect.objectContaining({ password: 'hashed-new-password' }),
      }));
      expect(logger.info).toHaveBeenCalledWith({ userId: 'user123' }, 'Password changed successfully');
    });

    it('should throw NotFoundError if user not found', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(userService.changePassword('nonexistent', 'password', 'new-password')).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError for incorrect current password', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);
      (PasswordUtils.verifyPassword as vi.Mock).mockResolvedValue(false);

      await expect(userService.changePassword('user123', 'wrong-password', 'new-password')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token if user exists', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);

      const token = await userService.forgotPassword('test@example.com');
      expect(token).toBeDefined();
      expect(JWTUtils.generateToken).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user123', type: 'reset' }), '1h');
      expect(logger.info).toHaveBeenCalledWith({ userId: 'user123' }, 'Password reset token generated');
    });

    it('should return null and warn if user does not exist', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);

      const token = await userService.forgotPassword('nonexistent@example.com');
      expect(token).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith({ email: 'nonexistent@example.com' }, 'Forgot password request for non-existent user');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as vi.Mock).mockResolvedValue(mockUser);

      await userService.resetPassword('mock-token-reset', 'new-password');

      expect(JWTUtils.verifyToken).toHaveBeenCalledWith('mock-token-reset');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user123' } });
      expect(PasswordUtils.hashPassword).toHaveBeenCalledWith('new-password');
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user123' },
        data: expect.objectContaining({ password: 'hashed-new-password' }),
      }));
      expect(logger.info).toHaveBeenCalledWith({ userId: 'user123' }, 'Password reset successfully');
    });

    it('should throw AuthenticationError for invalid or expired token', async () => {
      await expect(userService.resetPassword('invalid-token', 'new-password')).rejects.toThrow(AuthenticationError);
      await expect(userService.resetPassword('expired-token', 'new-password')).rejects.toThrow(AuthenticationError);
      await expect(userService.resetPassword('mock-token-wrong-type', 'new-password')).rejects.toThrow(AuthenticationError);
    });

    it('should throw NotFoundError if user not found', async () => {
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(userService.resetPassword('mock-token-reset', 'new-password')).rejects.toThrow(NotFoundError);
    });
  });
});


