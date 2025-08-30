import { ValidationError, NotFoundError, ConflictError, AuthenticationError } from '@/core/errors/app-error';

export class UserNotFoundError extends NotFoundError {
  constructor(identifier: string, correlationId?: string) {
    super(`User with identifier ${identifier} not found`, { identifier }, correlationId);
  }
}

export class UserAlreadyExistsError extends ConflictError {
  constructor(field: string, value: string, correlationId?: string) {
    super(`User with ${field} '${value}' already exists`, { field, value }, correlationId);
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor(correlationId?: string) {
    super('Invalid email or password', undefined, correlationId);
  }
}

export class AccountDeactivatedError extends AuthenticationError {
  constructor(userId: string, correlationId?: string) {
    super('Account is deactivated', { userId }, correlationId);
  }
}

export class AccountLockedError extends AuthenticationError {
  constructor(userId: string, unlockTime: Date, correlationId?: string) {
    super(
      `Account is locked until ${unlockTime.toISOString()}`,
      { userId, unlockTime },
      correlationId
    );
  }
}

export class EmailNotVerifiedError extends AuthenticationError {
  constructor(userId: string, correlationId?: string) {
    super('Email address not verified', { userId }, correlationId);
  }
}

export class InvalidTokenError extends ValidationError {
  constructor(tokenType: string, correlationId?: string) {
    super(`Invalid or expired ${tokenType} token`, { tokenType }, correlationId);
  }
}

export class PasswordValidationError extends ValidationError {
  constructor(errors: string[], correlationId?: string) {
    super(`Password validation failed: ${errors.join(', ')}`, { errors }, correlationId);
  }
}

export class UsernameValidationError extends ValidationError {
  constructor(username: string, reason: string, correlationId?: string) {
    super(`Username '${username}' is invalid: ${reason}`, { username, reason }, correlationId);
  }
}