import { UserEntity } from '../entities/user.entity';

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  role?: string;
}

export interface FindUsersOptions {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  role?: string;
  search?: string; // Search in username, email, firstName, lastName
  sortBy?: 'username' | 'email' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface UserListResult {
  users: UserEntity[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface IUserRepository {
  // Core CRUD operations
  create(data: CreateUserData): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  update(id: string, data: UpdateUserData): Promise<UserEntity>;
  delete(id: string): Promise<void>;

  // Query operations
  findAll(options?: FindUsersOptions): Promise<UserListResult>;
  search(query: string, options?: FindUsersOptions): Promise<UserListResult>;
  count(options?: { isActive?: boolean; role?: string }): Promise<number>;
  exists(id: string): Promise<boolean>;

  // Validation operations
  isEmailAvailable(email: string, excludeId?: string): Promise<boolean>;
  isUsernameAvailable(username: string, excludeId?: string): Promise<boolean>;

  // Authentication operations
  findByCredentials(emailOrUsername: string): Promise<UserEntity | null>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;
  updateLastLogin(id: string): Promise<void>;

  // Login attempt tracking
  incrementLoginAttempts(email: string): Promise<void>;
  resetLoginAttempts(email: string): Promise<void>;

  // Admin operations
  activate(id: string): Promise<UserEntity>;
  deactivate(id: string): Promise<UserEntity>;
  changeRole(id: string, role: string): Promise<UserEntity>;
}
