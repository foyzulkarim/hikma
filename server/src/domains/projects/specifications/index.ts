// Base specification interfaces and classes
export * from './project-access.specification';

// Project member specifications
export * from './project-member.specification';

// Project sync specifications
export * from './project-sync.specification';

// Project validation specifications
export {
  ValidProjectNameSpecification,
  ValidProjectSlugSpecification,
  ValidProjectDescriptionSpecification,
  ValidRepositoryUrlSpecification,
  ValidProjectBranchSpecification,
  ValidProjectStatusSpecification,
  ValidProjectSettingsSpecification,
  CanCreateProjectSpecification,
  CanModifyProjectSpecification,
  ValidVisibilityChangeSpecification,
  ProjectValidationSpecificationService
} from './project-validation.specification';

// Re-export commonly used types
export type { ProjectAccessContext } from './project-access.specification';
export type { ProjectMemberContext } from './project-member.specification';
export type { ProjectSyncContext } from './project-sync.specification';
export type { ProjectValidationContext } from './project-validation.specification';

// Convenience type aliases
export type { ProjectMemberContext as MemberContext } from './project-member.specification';
export type { ProjectSyncContext as SyncContext } from './project-sync.specification';
export type { ProjectValidationContext as ValidationContext } from './project-validation.specification';