// Export API routes
export { projectRoutes } from './api/project.routes';

// Export entities
export { ProjectEntity } from './entities/project.entity';
export { RepositoryEntity } from './entities/repository.entity';
export type { ProjectMember } from './entities/project.entity';
export type { RepositoryMetadata } from './entities/repository.entity';

// Export value objects
export { ProjectSettings } from './value-objects/project-settings.value-object';
export type { ProjectSettingsData } from './value-objects/project-settings.value-object';

// Export repository interfaces and implementations
export { ProjectRepository } from './repositories/project.repository';
export { ProjectMemberRepository } from './repositories/project-member.repository';
export type { 
  IProjectRepository,
  CreateProjectData,
  UpdateProjectData,
  FindProjectsOptions,
  ProjectListResult
} from './repositories/project.repository.interface';
export type {
  IProjectMemberRepository,
  CreateMemberData
} from './repositories/project-member.repository.interface';

// Export services
export { ProjectService } from './services/project.service';
export { ProjectSyncService } from './services/project-sync.service';
export { ProjectMemberService } from './services/project-member.service';
export type { ProjectSyncResult } from './services/project-sync.service';

// Export use cases
export * from './use-cases/base.use-case';
export { CreateProjectUseCase } from './use-cases/create-project.use-case';
export { SyncProjectUseCase } from './use-cases/sync-project.use-case';
export { DeleteProjectUseCase } from './use-cases/delete-project.use-case';

export type { 
  CreateProjectRequest,
  CreateProjectResponse 
} from './use-cases/create-project.use-case';

export type { 
  SyncProjectRequest,
  SyncProjectResponse 
} from './use-cases/sync-project.use-case';

export type { 
  DeleteProjectRequest,
  DeleteProjectResponse 
} from './use-cases/delete-project.use-case';

// Export domain events
export type {
  ProjectCreatedEvent,
  ProjectUpdatedEvent,
  ProjectDeletedEvent,
  ProjectStatusChangedEvent,
  ProjectSyncStartedEvent,
  ProjectSyncCompletedEvent,
  ProjectMemberAddedEvent,
  ProjectMemberRemovedEvent,
  ProjectMemberRoleChangedEvent,
  ProjectSettingsUpdatedEvent,
  ProjectDomainEvent,
  ProjectEventName
} from './events/project.events';
export { PROJECT_EVENTS } from './events/project.events';

// Export event handlers
export { ProjectEventHandlers, projectEventHandlers } from './events/project.event-handlers';
