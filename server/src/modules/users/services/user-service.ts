import { PrismaClient, User } from '@prisma/client';
import { PasswordUtils, JWTUtils } from '@/core/utils/crypto.js';
import { logger } from '@/core/utils/logger.js';
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '@/core/errors/app-error.js';
import { appConfig } from '@/config/app.js';

const prisma = new PrismaClient();

export class UserService {
  /**
   * Registers a new user.
   * @param email - User's email.
   * @param password - User's password.
   * @param name - User's name.
   * @param organization - User's organization (optional).
   * @returns The newly created user and authentication tokens.
   */
  async registerUser(data: {
    email: string;
    password: string;
    name: string;
    organization?: string;
  }): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const { email, password, name, organization } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hashPassword(password);

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        organization,
        role: 'user',
        isActive: true,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = await this.generateAuthTokens(newUser);

    logger.info({ userId: newUser.id, email: newUser.email }, 'User registered successfully');

    return { user: newUser, accessToken, refreshToken, expiresIn };
  }

  /**
   * Authenticates a user and generates tokens.
   * @param email - User's email.
   * @param password - User's password.
   * @returns The authenticated user and authentication tokens.
   */
  async loginUser(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await PasswordUtils.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = await this.generateAuthTokens(user);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

    return { user, accessToken, refreshToken, expiresIn };
  }

  /**
   * Refreshes access token using a refresh token.
   * @param refreshToken - The refresh token.
   * @returns New access token and refresh token.
   */
  async refreshAuthToken(refreshToken: string): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload = await JWTUtils.verifyToken(refreshToken);
    const userId = payload.userId;

    if (!userId) {
      throw new AuthenticationError('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    return this.generateAuthTokens(user);
  }

  /**
   * Retrieves a user by ID.
   * @param userId - The ID of the user.
   * @returns The user object.
   */
  async getUserById(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * Changes a user's password.
   * @param userId - The ID of the user.
   * @param currentPassword - The user's current password.
   * @param newPassword - The user's new password.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValidPassword = await PasswordUtils.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const hashedNewPassword = await PasswordUtils.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword, updatedAt: new Date() },
    });

    logger.info({ userId }, 'Password changed successfully');
  }

  /**
   * Initiates a password reset process.
   * @param email - The user's email.
   * @returns A reset token (for testing/development, in production this would be emailed).
   */
  async forgotPassword(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logger.warn({ email }, 'Forgot password request for non-existent user');
      return null; // Don't reveal if user exists
    }

    // In production, generate a secure, single-use token and send email
    const resetToken = await JWTUtils.generateToken({ userId: user.id, type: 'reset' }, '1h');

    logger.info({ userId: user.id }, 'Password reset token generated');
    return resetToken; // For testing/development only
  }

  /**
   * Resets a user's password using a reset token.
   * @param token - The reset token.
   * @param newPassword - The new password.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const payload = await JWTUtils.verifyToken(token);
    const userId = payload.userId;
    const tokenType = payload.type;

    if (!userId || tokenType !== 'reset') {
      throw new AuthenticationError('Invalid or expired reset token');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hashedNewPassword = await PasswordUtils.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword, updatedAt: new Date() },
    });

    logger.info({ userId }, 'Password reset successfully');
  }

  /**
   * Generates access and refresh tokens for a user.
   * @param user - The user object.
   * @returns Authentication tokens and expiry.
   */
  private async generateAuthTokens(user: User): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await JWTUtils.generateToken(payload, appConfig.security.jwtExpiresIn);
    const refreshToken = await JWTUtils.generateToken({ userId: user.id, type: 'refresh' }, appConfig.security.jwtRefreshExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn: appConfig.security.jwtExpiresInSeconds,
    };
  }
}

export const userService = new UserService();


