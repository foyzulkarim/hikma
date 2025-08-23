  // Core domain interfaces
export interface User {
  id: string;
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Computed properties
  fullName?: string;
  displayName?: string;
}

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  password?: string;
  isActive?: boolean;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

// User roles and permissions
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER'
}

// Repository query options
export interface FindUserOptions {
  limit?: number;
  offset?: number;
  role?: UserRole;
  isActive?: boolean;
  emailVerified?: boolean;
  sortBy?: 'email' | 'username' | 'createdAt' | 'updatedAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean;
}

// Response DTOs
export interface UserListResponse {
  users: UserResponse[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

// Password reset and email verification
export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}
