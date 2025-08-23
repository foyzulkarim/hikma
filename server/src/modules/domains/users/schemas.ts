import { z } from 'zod';
import { userConfig } from './config';

// Base schemas
export const UserIdSchema = z.string().cuid('Invalid user ID format');

export const EmailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email cannot exceed 255 characters');

export const UsernameSchema = z.string()
  .min(userConfig.usernameMinLength, `Username must be at least ${userConfig.usernameMinLength} characters`)
  .max(userConfig.usernameMaxLength, `Username cannot exceed ${userConfig.usernameMaxLength} characters`)
  .regex(userConfig.usernamePattern, 'Username can only contain letters, numbers, underscores, and hyphens');

export const PasswordSchema = z.string()
  .min(userConfig.passwordMinLength, `Password must be at least ${userConfig.passwordMinLength} characters`)
  .max(userConfig.passwordMaxLength, `Password cannot exceed ${userConfig.passwordMaxLength} characters`);

// Request schemas
export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(1).max(100),
  organization: z.string().optional(),
});

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: PasswordSchema,
});

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  newPassword: PasswordSchema,
});

export const UpdateUserRequestSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: EmailSchema.optional(),
  username: UsernameSchema.optional(),
});

// Query schemas
export const UserListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['email', 'username', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Parameter schemas
export const UserParamsSchema = z.object({
  userId: UserIdSchema
});