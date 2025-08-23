import { UserRole } from './types';

export enum UserEvent {
  CREATED = 'user.created',
  UPDATED = 'user.updated',
  DELETED = 'user.deleted',
  ACTIVATED = 'user.activated',
  DEACTIVATED = 'user.deactivated',
  PASSWORD_CHANGED = 'user.password.changed',
  PASSWORD_RESET_REQUESTED = 'user.password.reset.requested',
  PASSWORD_RESET_COMPLETED = 'user.password.reset.completed',
  EMAIL_VERIFIED = 'user.email.verified',
  LOGIN_SUCCESS = 'user.login.success',
  LOGIN_FAILED = 'user.login.failed',
  LOGOUT = 'user.logout',
  ROLE_CHANGED = 'user.role.changed'
}

export interface UserEventPayload {
  userId: string;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface UserCreatedPayload extends UserEventPayload {
  email: string;
  username: string;
  role: UserRole;
}

export interface UserLoginPayload extends UserEventPayload {
  email: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
}

export interface UserPasswordChangedPayload extends UserEventPayload {
  method: 'self' | 'reset' | 'admin';
}

export interface IUserEventEmitter {
  emit(event: UserEvent, payload: UserEventPayload): void;
}