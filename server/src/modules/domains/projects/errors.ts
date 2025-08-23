import { ValidationError, NotFoundError, ConflictError } from '@/core/errors/app-error';

export class ProjectNotFoundError extends NotFoundError {
  constructor(projectId: string, correlationId?: string) {
    super(`Project with ID ${projectId} not found`, { projectId }, correlationId);
  }
}

export class ProjectLimitExceededError extends ValidationError {
  constructor(userId: string, currentCount: number, maxAllowed: number, correlationId?: string) {
    super(
      `User has reached maximum project limit (${currentCount}/${maxAllowed})`,
      { userId, currentCount, maxAllowed },
      correlationId
    );
  }
}

export class ProjectSlugConflictError extends ConflictError {
  constructor(slug: string, correlationId?: string) {
    super(`Project with slug '${slug}' already exists`, { slug }, correlationId);
  }
}

export class ProjectSyncError extends Error {
  constructor(projectId: string, reason: string, correlationId?: string) {
    super(`Project sync failed for ${projectId}: ${reason}`);
    this.name = 'ProjectSyncError';
  }
}