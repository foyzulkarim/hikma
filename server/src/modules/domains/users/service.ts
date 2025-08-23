import { PasswordUtils, SecureRandomUtils } from '@/core/utils/crypto';
import { logger } from '@/core/utils/logger';
import { IUserRepository } from './repository';
import { AuthService } from './auth/service';
import { IUserEventEmitter, UserEvent } from './events';
import { UserModuleConfig } from './config';
import { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  ChangePasswordData, 
  ResetPasswordData,
  UserResponse,
  AuthResponse,  
  FindUserOptions,
  UserListResponse
} from './types';
import { 
  UserNotFoundError, 
  InvalidCredentialsError, 
  PasswordValidationError,
  InvalidTokenError 
} from './errors';

export class UserService {
  constructor(
    private repository: IUserRepository,
    private authService: AuthService,
    private eventEmitter: IUserEventEmitter,
    private config: UserModuleConfig
  ) {}

  async registerUser(data: {
    email: string;
    password: string;
    name: string;
    organization?: string;
  }, correlationId?: string): Promise<AuthResponse> {
    try {
      // Validate password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(data.password);
      if (!passwordValidation.isValid) {
        throw new PasswordValidationError(passwordValidation.errors, correlationId);
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hash(data.password);

      // Parse name
      const nameParts = data.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || undefined;

      // Generate username from email
      const username = data.email.split('@')[0];

      const createData: CreateUserData = {
        email: data.email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
      };

      // Create user
      const user = await this.repository.create(createData);

      // Generate authentication tokens
      const userContext = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      };

      const tokens = await this.authService.generateTokens(userContext);

      // Emit user created event
      this.eventEmitter.emit(UserEvent.CREATED, {
        userId: user.id,
        timestamp: new Date(),
        correlationId,
        metadata: {
          email: user.email,
          username: user.username,
          role: user.role,
        },
      });

      logger.info({ userId: user.id, email: user.email, correlationId }, 'User registered successfully');

      return {
        user: this.sanitizeUser(user),
        tokens,
      };
    } catch (error) {
      logger.error({ error, email: data.email, correlationId }, 'User registration failed');
      throw error;
    }
  }

  async loginUser(email: string, password: string, metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }, correlationId?: string): Promise<AuthResponse> {
    try {
      const { user, tokens } = await this.authService.authenticateWithPassword(
        email, 
        password, 
        metadata, 
        correlationId
      );

      return {
        user: this.sanitizeUserContext(user),
        tokens,
      };
    } catch (error) {
      logger.error({ error, email, correlationId }, 'User login failed');
      throw error;
    }
  }

  async refreshAuthToken(refreshToken: string, correlationId?: string): Promise<AuthResponse> {
    try {
      const tokens = await this.authService.refreshToken(refreshToken, correlationId);
      
      // Get user from token
      const userContext = await this.authService.authenticateWithJWT(tokens.accessToken, correlationId);

      return {
        user: this.sanitizeUserContext(userContext),
        tokens,
      };
    } catch (error) {
      logger.error({ error, correlationId }, 'Token refresh failed');
      throw error;
    }
  }

  async getUserById(userId: string, correlationId?: string): Promise<User> {
    try {
      const user = await this.repository.findById(userId);
      if (!user) {
        throw new UserNotFoundError(userId, correlationId);
      }
      return user;
    } catch (error) {
      logger.error({ error, userId, correlationId }, 'Failed to get user by ID');
      throw error;
    }
  }

  async updateUser(userId: string, data: UpdateUserData, correlationId?: string): Promise<User> {
    try {
      const existingUser = await this.repository.findById(userId);
      if (!existingUser) {
        throw new UserNotFoundError(userId, correlationId);
      }

      const updatedUser = await this.repository.update(userId, data);

      // Emit user updated event
      this.eventEmitter.emit(UserEvent.UPDATED, {
        userId,
        timestamp: new Date(),
        correlationId,
        metadata: data,
      });

      // Invalidate auth cache
      await this.authService.invalidateUserCache(userId);

      logger.info({ userId, correlationId }, 'User updated successfully');

      return updatedUser;
    } catch (error) {
      logger.error({ error, userId, data, correlationId }, 'Failed to update user');
      throw error;
    }
  }

  async changePassword(userId: string, data: ChangePasswordData, correlationId?: string): Promise<void> {
    try {
      const user = await this.repository.findById(userId);
      if (!user) {
        throw new UserNotFoundError(userId, correlationId);
      }

      // Verify current password
      const isValidPassword = await PasswordUtils.verify(data.currentPassword, user.password);
      if (!isValidPassword) {
        throw new InvalidCredentialsError(correlationId);
      }

      // Validate new password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(data.newPassword);
      if (!passwordValidation.isValid) {
        throw new PasswordValidationError(passwordValidation.errors, correlationId);
      }

      // Hash new password
      const hashedPassword = await PasswordUtils.hash(data.newPassword);

      // Update password
      await this.repository.update(userId, { password: hashedPassword });

      // Emit password changed event
      this.eventEmitter.emit(UserEvent.PASSWORD_CHANGED, {
        userId,
        timestamp: new Date(),
        correlationId,
        metadata: { method: 'self' },
      });

      // Invalidate auth cache
      await this.authService.invalidateUserCache(userId);

      logger.info({ userId, correlationId }, 'Password changed successfully');
    } catch (error) {
      logger.error({ error, userId, correlationId }, 'Failed to change password');
      throw error;
    }
  }

  async forgotPassword(email: string, correlationId?: string): Promise<string> {
    try {
      const user = await this.repository.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists, but log for security monitoring
        logger.warn({ email, correlationId }, 'Password reset requested for non-existent user');
        return 'reset-token-placeholder'; // Return placeholder to prevent user enumeration
      }

      // Generate reset token
      const resetToken = SecureRandomUtils.generateAlphanumericCode(32);
      const expiresAt = new Date(Date.now() + this.config.tokenExpiryHours * 60 * 60 * 1000);

      // Store reset token
      await this.repository.createPasswordResetToken(user.id, resetToken, expiresAt);

      // Emit password reset requested event
      this.eventEmitter.emit(UserEvent.PASSWORD_RESET_REQUESTED, {
        userId: user.id,
        timestamp: new Date(),
        correlationId,
        metadata: { email },
      });

      logger.info({ userId: user.id, email, correlationId }, 'Password reset requested');

      return resetToken;
    } catch (error) {
      logger.error({ error, email, correlationId }, 'Failed to process forgot password request');
      throw error;
    }
  }

  async resetPassword(data: ResetPasswordData, correlationId?: string): Promise<void> {
    try {
      // Find reset token
      const resetToken = await this.repository.findPasswordResetToken(data.token);
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        throw new InvalidTokenError('password reset', correlationId);
      }

      // Validate new password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(data.newPassword);
      if (!passwordValidation.isValid) {
        throw new PasswordValidationError(passwordValidation.errors, correlationId);
      }

      // Hash new password
      const hashedPassword = await PasswordUtils.hash(data.newPassword);

      // Update password and mark token as used
      await this.repository.update(resetToken.userId, { password: hashedPassword });
      await this.repository.markPasswordResetTokenUsed(resetToken.id);

      // Emit password reset completed event
      this.eventEmitter.emit(UserEvent.PASSWORD_RESET_COMPLETED, {
        userId: resetToken.userId,
        timestamp: new Date(),
        correlationId,
        metadata: { method: 'reset' },
      });

      // Invalidate auth cache
      await this.authService.invalidateUserCache(resetToken.userId);

      logger.info({ userId: resetToken.userId, correlationId }, 'Password reset completed');
    } catch (error) {
      logger.error({ error, correlationId }, 'Failed to reset password');
      throw error;
    }
  }

  async getUsers(options: FindUserOptions = {}, correlationId?: string): Promise<UserListResponse> {
    try {
      const [users, total] = await Promise.all([
        this.repository.findMany(options),
        this.repository.count(options)
      ]);

      const { limit = 20, offset = 0 } = options;

      return {
        users: users.map(user => this.sanitizeUser(user)),
        metadata: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      logger.error({ error, options, correlationId }, 'Failed to get users');
      throw error;
    }
  }

  private sanitizeUser(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private sanitizeUserContext(userContext: any): UserResponse {
    return {
      id: userContext.id,
      email: userContext.email,
      username: userContext.username,
      firstName: userContext.firstName,
      lastName: userContext.lastName,
      fullName: userContext.fullName,
      role: userContext.role,
      isActive: userContext.isActive,
      createdAt: userContext.createdAt,
      updatedAt: userContext.updatedAt,
    };
  }
}
