// Export API routes
export { userRoutes } from './api/user.routes';

// Export entities
export { UserEntity } from './entities/user.entity';
export type { UserRole } from './entities/user.entity';

// Export repository interfaces and implementations
export { UserRepository } from './repositories/user.repository';
export type { 
  IUserRepository,
  CreateUserData,
  UpdateUserData,
  FindUsersOptions,
  UserListResult
} from './repositories/user.repository.interface';

// Export services
export { UserService } from './services/user.service';

// Export use cases
export { AuthenticateUserUseCase } from './use-cases/authenticate-user.use-case';
export { CreateUserUseCase } from './use-cases/create-user.use-case';
export { ManagePermissionsUseCase } from './use-cases/manage-permissions.use-case';

export type { 
  AuthenticateUserRequest,
  AuthenticateUserResponse 
} from './use-cases/authenticate-user.use-case';

export type { 
  CreateUserRequest,
  CreateUserResponse 
} from './use-cases/create-user.use-case';

export type { 
  ManagePermissionsRequest,
  ManagePermissionsResponse 
} from './use-cases/manage-permissions.use-case';

// Export auth functionality
export { AuthService } from './auth/service';
export { createRequireAuth, createOptionalAuth, createAuthMiddleware } from './auth/middleware';
export type { UserContext, AuthMethod, TokenPair, LoginAttempt } from './auth/types';
