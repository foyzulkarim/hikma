import { PrismaClient } from '@prisma/client';
import { User, CreateUserData, UpdateUserData, FindUserOptions, PasswordResetToken, EmailVerificationToken, UserRole } from './types';
import { UserAlreadyExistsError, UserNotFoundError } from './errors';
import { logger } from '@/core/utils/logger';

export interface IUserRepository {
  // User CRUD operations
  create(data: CreateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findMany(options?: FindUserOptions): Promise<User[]>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
  count(options?: Partial<FindUserOptions>): Promise<number>;
  exists(id: string): Promise<boolean>;
  
  // Authentication related
  updateLastLogin(id: string): Promise<void>;
  incrementLoginAttempts(email: string): Promise<number>;
  resetLoginAttempts(email: string): Promise<void>;
  
  // Password reset tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  findPasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  markPasswordResetTokenUsed(tokenId: string): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<number>;
  
  // Email verification tokens
  createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<EmailVerificationToken>;
  findEmailVerificationToken(token: string): Promise<EmailVerificationToken | null>;
  markEmailVerificationTokenUsed(tokenId: string): Promise<void>;
  cleanupExpiredEmailVerificationTokens(): Promise<number>;
}

export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUserData): Promise<User> {
    try {
      // Check for existing user
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email },
            { username: data.username }
          ]
        }
      });

      if (existingUser) {
        if (existingUser.email === data.email) {
          throw new UserAlreadyExistsError('email', data.email);
        }
        if (existingUser.username === data.username) {
          throw new UserAlreadyExistsError('username', data.username);
        }
      }

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role || UserRole.USER,
          isActive: true,
        }
      });

      return this.mapToUser(user);
    } catch (error) {
      logger.error({ error, data: { ...data, password: '[REDACTED]' } }, 'Failed to create user');
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id }
      });
      return user ? this.mapToUser(user) : null;
    } catch (error) {
      logger.error({ error, id }, 'Failed to find user by ID');
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email }
      });
      return user ? this.mapToUser(user) : null;
    } catch (error) {
      logger.error({ error, email }, 'Failed to find user by email');
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username }
      });
      return user ? this.mapToUser(user) : null;
    } catch (error) {
      logger.error({ error, username }, 'Failed to find user by username');
      throw error;
    }
  }

  async findMany(options: FindUserOptions = {}): Promise<User[]> {
    try {
      const {
        limit = 20,
        offset = 0,
        role,
        isActive,
        emailVerified,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeInactive = false
      } = options;

      const where: any = {};
      
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive;
      if (emailVerified !== undefined) where.emailVerified = emailVerified;
      if (!includeInactive) where.isActive = true;

      const users = await this.prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder }
      });

      return users.map(user => this.mapToUser(user));
    } catch (error) {
      logger.error({ error, options }, 'Failed to find users');
      throw error;
    }
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data
      });
      return this.mapToUser(user);
    } catch (error) {
      logger.error({ error, id, data }, 'Failed to update user');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id }
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete user');
      throw error;
    }
  }

  async count(options: Partial<FindUserOptions> = {}): Promise<number> {
    try {
      const { role, isActive, emailVerified, includeInactive = false } = options;
      
      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive;
      if (emailVerified !== undefined) where.emailVerified = emailVerified;
      if (!includeInactive) where.isActive = true;

      return await this.prisma.user.count({ where });
    } catch (error) {
      logger.error({ error, options }, 'Failed to count users');
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true }
      });
      return !!user;
    } catch (error) {
      logger.error({ error, id }, 'Failed to check user existence');
      throw error;
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      // Note: lastLoginAt field doesn't exist in current User schema
      // This is a placeholder for when the field is added
      logger.debug({ id }, 'Last login update skipped - field not in schema');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update last login');
      throw error;
    }
  }

  async incrementLoginAttempts(email: string): Promise<number> {
    try {
      // This would require adding loginAttempts field to User model
      // For now, return 0 as placeholder
      return 0;
    } catch (error) {
      logger.error({ error, email }, 'Failed to increment login attempts');
      throw error;
    }
  }

  async resetLoginAttempts(email: string): Promise<void> {
    try {
      // This would require adding loginAttempts field to User model
      // For now, do nothing as placeholder
    } catch (error) {
      logger.error({ error, email }, 'Failed to reset login attempts');
      throw error;
    }
  }

  // Password reset token methods
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    try {
      // This would require creating PasswordResetToken model
      // For now, return placeholder
      return {
        id: 'placeholder',
        userId,
        token,
        expiresAt,
        used: false,
        createdAt: new Date()
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to create password reset token');
      throw error;
    }
  }

  async findPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    try {
      // This would require PasswordResetToken model
      // For now, return null as placeholder
      return null;
    } catch (error) {
      logger.error({ error, token }, 'Failed to find password reset token');
      throw error;
    }
  }

  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    try {
      // This would require PasswordResetToken model
      // For now, do nothing as placeholder
    } catch (error) {
      logger.error({ error, tokenId }, 'Failed to mark password reset token as used');
      throw error;
    }
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    try {
      // This would require PasswordResetToken model
      // For now, return 0 as placeholder
      return 0;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired password reset tokens');
      throw error;
    }
  }

  // Email verification token methods (similar placeholders)
  async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<EmailVerificationToken> {
    return {
      id: 'placeholder',
      userId,
      token,
      expiresAt,
      used: false,
      createdAt: new Date()
    };
  }

  async findEmailVerificationToken(token: string): Promise<EmailVerificationToken | null> {
    return null;
  }

  async markEmailVerificationTokenUsed(tokenId: string): Promise<void> {
    // Placeholder
  }

  async cleanupExpiredEmailVerificationTokens(): Promise<number> {
    return 0;
  }

  private mapToUser(prismaUser: any): User {
    return {
      ...prismaUser,
      fullName: prismaUser.firstName && prismaUser.lastName 
        ? `${prismaUser.firstName} ${prismaUser.lastName}` 
        : undefined,
      displayName: prismaUser.firstName || prismaUser.username,
    };
  }
}