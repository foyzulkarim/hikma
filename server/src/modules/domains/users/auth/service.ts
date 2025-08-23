import { JWTUtils, PasswordUtils } from '@/core/utils/crypto';
import { cacheService } from '@/config/redis';
import { logger } from '@/core/utils/logger';
import { IUserRepository } from '../repository';
import { IUserEventEmitter, UserEvent } from '../events';
import { UserContext, TokenPair, LoginAttempt } from './types';
import { InvalidCredentialsError, AccountDeactivatedError, UserNotFoundError } from '../errors';

export class AuthService {
  private static readonly JWT_CACHE_PREFIX = 'jwt_user:';
  private static readonly API_KEY_CACHE_PREFIX = 'api_key:';
  private static readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private userRepository: IUserRepository,
    private eventEmitter: IUserEventEmitter
  ) {}

  async authenticateWithPassword(
    email: string, 
    password: string, 
    metadata?: { ipAddress?: string; userAgent?: string },
    correlationId?: string
  ): Promise<{ user: UserContext; tokens: TokenPair }> {
    try {
      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        this.emitLoginEvent(email, false, 'User not found', metadata, correlationId);
        throw new InvalidCredentialsError(correlationId);
      }

      // Verify password
      const isValidPassword = await PasswordUtils.verify(password, user.password);
      if (!isValidPassword) {
        await this.userRepository.incrementLoginAttempts(email);
        this.emitLoginEvent(email, false, 'Invalid password', metadata, correlationId);
        throw new InvalidCredentialsError(correlationId);
      }

      // Check if user is active
      if (!user.isActive) {
        this.emitLoginEvent(email, false, 'Account deactivated', metadata, correlationId);
        throw new AccountDeactivatedError(user.id, correlationId);
      }

      // Reset login attempts on successful login
      await this.userRepository.resetLoginAttempts(email);
      await this.userRepository.updateLastLogin(user.id);

      const userContext: UserContext = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      };

      // Generate tokens
      const tokens = await this.generateTokens(userContext);

      // Cache user context
      const cacheKey = `${AuthService.JWT_CACHE_PREFIX}${user.id}`;
      await cacheService.set(cacheKey, userContext, AuthService.CACHE_TTL);

      this.emitLoginEvent(email, true, undefined, metadata, correlationId);

      logger.info({ userId: user.id, email, correlationId }, 'User authenticated successfully');

      return { user: userContext, tokens };
    } catch (error) {
      logger.error({ error, email, correlationId }, 'Authentication failed');
      throw error;
    }
  }

  async authenticateWithJWT(token: string, correlationId?: string): Promise<UserContext> {
    try {
      // Verify and decode JWT token
      const decoded = JWTUtils.verifyToken(token);
      
      // Check cache first
      const cacheKey = `${AuthService.JWT_CACHE_PREFIX}${decoded.userId}`;
      const cachedUser = await cacheService.get<UserContext>(cacheKey);
      
      if (cachedUser) {
        logger.debug({ userId: decoded.userId, correlationId }, 'User authenticated from cache');
        return cachedUser;
      }

      // Fetch user from database
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new UserNotFoundError(decoded.userId, correlationId);
      }

      if (!user.isActive) {
        throw new AccountDeactivatedError(user.id, correlationId);
      }

      const userContext: UserContext = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      };

      // Cache user context
      await cacheService.set(cacheKey, userContext, AuthService.CACHE_TTL);

      logger.debug({ userId: user.id, correlationId }, 'User authenticated via JWT');
      return userContext;
    } catch (error) {
      logger.error({ error, correlationId }, 'JWT authentication failed');
      throw error;
    }
  }

  async refreshToken(refreshToken: string, correlationId?: string): Promise<TokenPair> {
    try {
      const decoded = JWTUtils.verifyToken(refreshToken);
      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new UserNotFoundError(decoded.userId, correlationId);
      }

      const userContext: UserContext = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      };

      return await this.generateTokens(userContext);
    } catch (error) {
      logger.error({ error, correlationId }, 'Token refresh failed');
      throw error;
    }
  }

  async logout(userId: string, correlationId?: string): Promise<void> {
    try {
      // Invalidate cache
      const cacheKey = `${AuthService.JWT_CACHE_PREFIX}${userId}`;
      await cacheService.del(cacheKey);

      // Emit logout event
      this.eventEmitter.emit(UserEvent.LOGOUT, {
        userId,
        timestamp: new Date(),
        correlationId,
      });

      logger.info({ userId, correlationId }, 'User logged out successfully');
    } catch (error) {
      logger.error({ error, userId, correlationId }, 'Logout failed');
      throw error;
    }
  }

  async generateTokens(user: UserContext): Promise<TokenPair> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = JWTUtils.generateToken(payload);
    const refreshToken = JWTUtils.generateToken({ userId: user.id, email: user.email, role: user.role });

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  private emitLoginEvent(
    email: string,
    success: boolean,
    failureReason?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
    correlationId?: string
  ): void {
    this.eventEmitter.emit(UserEvent.LOGIN_SUCCESS, {
      userId: '', // Will be filled by event handler if needed
      timestamp: new Date(),
      correlationId,
      metadata: {
        email,
        success,
        failureReason,
        ...metadata,
      },
    });
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const cacheKey = `${AuthService.JWT_CACHE_PREFIX}${userId}`;
    await cacheService.del(cacheKey);
  }
}