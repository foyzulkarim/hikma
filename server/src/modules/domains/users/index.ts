// Public API exports
export { userRoutes } from './api';
export { UserService } from './service';
export { UserRepository, type IUserRepository } from './repository';
export { AuthService } from './auth/service';
export { createAuthMiddleware, createRequireAuth, createOptionalAuth, createRequireRole } from './auth/middleware';
export * from './types';
export * from './errors';
export * from './events';
export * from './auth/types';
export * from './config';