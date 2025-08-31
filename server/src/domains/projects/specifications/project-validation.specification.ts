import { BaseSpecification } from './project-access.specification';
import { ProjectEntity } from '../entities/project.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { ProjectSlug } from '../value-objects/project-slug.value-object';

/**
 * Context for project validation specifications
 */
export interface ProjectValidationContext {
  project?: ProjectEntity;
  user: UserEntity;
  data: {
    name?: string;
    description?: string;
    slug?: string;
    repositoryUrl?: string;
    branch?: string;
    status?: string;
    settings?: Record<string, any>;
    isPublic?: boolean;
  };
  operation: 'create' | 'update' | 'delete';
  existingProjects?: ProjectEntity[];
}

/**
 * Specification: Project name is valid
 */
export class ValidProjectNameSpecification extends BaseSpecification<ProjectValidationContext> {
  private minLength = 3;
  private maxLength = 100;
  private forbiddenNames = ['admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'root', 'system'];
  private nameRegex = /^[a-zA-Z0-9\s\-_\.]+$/;

  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const name = context.data.name;
    
    if (!name) {
      return context.operation !== 'create'; // Name required for creation
    }

    // Check length
    if (name.length < this.minLength || name.length > this.maxLength) {
      return false;
    }

    // Check format
    if (!this.nameRegex.test(name)) {
      return false;
    }

    // Check forbidden names
    const normalizedName = name.toLowerCase().trim();
    if (this.forbiddenNames.includes(normalizedName)) {
      return false;
    }

    // Name should not start or end with special characters
    if (/^[\s\-_\.]|[\s\-_\.]$/.test(name)) {
      return false;
    }

    return true;
  }
}

/**
 * Specification: Project slug is valid and unique
 */
export class ValidProjectSlugSpecification extends BaseSpecification<ProjectValidationContext> {
  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const slug = context.data.slug;
    
    if (!slug) {
      return context.operation !== 'create'; // Slug required for creation
    }

    try {
      // Use ProjectSlug value object for validation
      const projectSlug = ProjectSlug.create(slug);
      
      // Check uniqueness against existing projects
      if (context.existingProjects) {
        const isDuplicate = context.existingProjects.some(project => {
          // Skip self when updating
          if (context.operation === 'update' && context.project && project.id === context.project.id) {
            return false;
          }
          return project.slug === slug;
        });
        
        if (isDuplicate) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Specification: Project description is valid
 */
export class ValidProjectDescriptionSpecification extends BaseSpecification<ProjectValidationContext> {
  private maxLength = 1000;

  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const description = context.data.description;
    
    // Description is optional
    if (!description) {
      return true;
    }

    // Check length
    if (description.length > this.maxLength) {
      return false;
    }

    // Description should not be only whitespace
    if (description.trim().length === 0) {
      return false;
    }

    return true;
  }
}

/**
 * Specification: Repository URL is valid
 */
export class ValidRepositoryUrlSpecification extends BaseSpecification<ProjectValidationContext> {
  private gitUrlRegex = /^(https?:\/\/)|(git@[\w\.-]+:[\w\.-]+\/[\w\.-]+\.git)|(ssh:\/\/git@[\w\.-]+\/[\w\.-]+\.git)$/;
  private githubUrlRegex = /^https:\/\/github\.com\/[\w\.-]+\/[\w\.-]+(\.git)?$/;
  private gitlabUrlRegex = /^https:\/\/gitlab\.com\/[\w\.-]+\/[\w\.-]+(\.git)?$/;
  private bitbucketUrlRegex = /^https:\/\/bitbucket\.org\/[\w\.-]+\/[\w\.-]+(\.git)?$/;

  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const repositoryUrl = context.data.repositoryUrl;
    
    // Repository URL is optional
    if (!repositoryUrl) {
      return true;
    }

    // Check if URL matches supported patterns
    const isValidFormat = this.gitUrlRegex.test(repositoryUrl) || 
                         this.githubUrlRegex.test(repositoryUrl) || 
                         this.gitlabUrlRegex.test(repositoryUrl) ||
                         this.bitbucketUrlRegex.test(repositoryUrl);
    
    return isValidFormat;
  }
}

/**
 * Specification: Project branch is valid
 */
export class ValidProjectBranchSpecification extends BaseSpecification<ProjectValidationContext> {
  private branchRegex = /^[a-zA-Z0-9._/-]+$/;
  private maxLength = 250;
  private reservedBranches = ['HEAD', 'refs/heads/', 'refs/tags/'];

  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const branch = context.data.branch;
    
    // Branch is optional, defaults to 'main'
    if (!branch) {
      return true;
    }

    // Check length
    if (branch.length > this.maxLength) {
      return false;
    }

    // Check format
    if (!this.branchRegex.test(branch)) {
      return false;
    }

    // Check for reserved branch names
    if (this.reservedBranches.some(reserved => branch.startsWith(reserved))) {
      return false;
    }

    return true;
  }
}

/**
 * Specification: Project status is valid
 */
export class ValidProjectStatusSpecification extends BaseSpecification<ProjectValidationContext> {
  private validStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'DRAFT'];
  private statusTransitions: Record<string, string[]> = {
    'DRAFT': ['ACTIVE', 'ARCHIVED'],
    'ACTIVE': ['INACTIVE', 'ARCHIVED'],
    'INACTIVE': ['ACTIVE', 'ARCHIVED'],
    'ARCHIVED': [] // Cannot transition from archived
  };

  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const status = context.data.status;
    
    if (!status) {
      return true; // Status is optional for updates
    }

    // Check if status is valid
    if (!this.validStatuses.includes(status)) {
      return false;
    }

    // For updates, check if transition is allowed
    if (context.operation === 'update' && context.project) {
      const currentStatus = context.project.status;
      const allowedTransitions = this.statusTransitions[currentStatus] || [];
      
      if (status !== currentStatus && !allowedTransitions.includes(status)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Specification: Project settings are valid
 */
export class ValidProjectSettingsSpecification extends BaseSpecification<ProjectValidationContext> {
  private maxIncludePatterns = 50;
  private maxExcludePatterns = 50;
  private maxPatternLength = 500;
  private maxFileSizeMB = 100;
  private maxSyncIntervalHours = 168; // 1 week
  private minSyncIntervalHours = 1;

  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const settings = context.data.settings;
    
    // Settings are optional
    if (!settings) {
      return true;
    }

    // Validate include patterns
    if (settings.includePatterns) {
      if (!Array.isArray(settings.includePatterns)) {
        return false;
      }
      
      if (settings.includePatterns.length > this.maxIncludePatterns) {
        return false;
      }
      
      if (!this.areValidPatterns(settings.includePatterns)) {
        return false;
      }
    }

    // Validate exclude patterns
    if (settings.excludePatterns) {
      if (!Array.isArray(settings.excludePatterns)) {
        return false;
      }
      
      if (settings.excludePatterns.length > this.maxExcludePatterns) {
        return false;
      }
      
      if (!this.areValidPatterns(settings.excludePatterns)) {
        return false;
      }
    }

    // Validate max file size
    if (settings.maxFileSize !== undefined) {
      if (typeof settings.maxFileSize !== 'number' || 
          settings.maxFileSize < 0 || 
          settings.maxFileSize > this.maxFileSizeMB * 1024 * 1024) {
        return false;
      }
    }

    // Validate sync interval
    if (settings.syncInterval !== undefined) {
      if (typeof settings.syncInterval !== 'number' || 
          settings.syncInterval < this.minSyncIntervalHours || 
          settings.syncInterval > this.maxSyncIntervalHours) {
        return false;
      }
    }

    // Validate boolean settings
    const booleanSettings = ['enableAutoSync', 'enableWebhooks', 'enableNotifications'];
    for (const setting of booleanSettings) {
      if (settings[setting] !== undefined && typeof settings[setting] !== 'boolean') {
        return false;
      }
    }

    return true;
  }

  private areValidPatterns(patterns: string[]): boolean {
    return patterns.every(pattern => {
      if (typeof pattern !== 'string') {
        return false;
      }
      
      if (!pattern.trim() || pattern.length > this.maxPatternLength) {
        return false;
      }
      
      return true;
    });
  }
}

/**
 * Specification: User can create projects
 */
export class CanCreateProjectSpecification extends BaseSpecification<ProjectValidationContext> {
  constructor(private maxProjectsPerUser: number = 10) {
    super();
  }

  isSatisfiedBy(context: ProjectValidationContext): boolean {
    // Admin can create unlimited projects
    if (context.user.isAdmin()) {
      return true;
    }

    // Check user's project limit
    if (context.existingProjects) {
      const userProjectCount = context.existingProjects.filter(project => 
        project.isOwner(context.user.id)
      ).length;
      
      if (userProjectCount >= this.maxProjectsPerUser) {
        return false;
      }
    }

    // Check if user can create projects (from user entity)
    return context.user.canCreateProject();
  }
}

/**
 * Specification: User can modify project
 */
export class CanModifyProjectSpecification extends BaseSpecification<ProjectValidationContext> {
  isSatisfiedBy(context: ProjectValidationContext): boolean {
    if (!context.project) {
      return false;
    }

    // Admin can modify any project
    if (context.user.isAdmin()) {
      return true;
    }

    // Check if user can modify this specific project
    return context.user.canModifyProject(context.project.id);
  }
}

/**
 * Specification: Project can be deleted
 */
export class CanDeleteProjectSpecification extends BaseSpecification<ProjectValidationContext> {
  isSatisfiedBy(context: ProjectValidationContext): boolean {
    if (!context.project) {
      return false;
    }

    // Admin can delete any project
    if (context.user.isAdmin()) {
      return true;
    }

    // Only project owner can delete
    if (!context.project.isOwner(context.user.id)) {
      return false;
    }

    // Check if user can delete projects (from user entity)
    return context.user.canDeleteProject(context.project.id);
  }
}

/**
 * Specification: Project visibility change is valid
 */
export class ValidVisibilityChangeSpecification extends BaseSpecification<ProjectValidationContext> {
  isSatisfiedBy(context: ProjectValidationContext): boolean {
    const isPublic = context.data.isPublic;
    
    // Visibility is optional
    if (isPublic === undefined) {
      return true;
    }

    // For updates, check if user can change visibility
    if (context.operation === 'update' && context.project) {
      // Only owner or admin can change visibility
      if (!context.user.isAdmin() && !context.project.isOwner(context.user.id)) {
        return false;
      }

      // Cannot make archived projects public
      if (isPublic && context.project.status === 'ARCHIVED') {
        return false;
      }
    }

    return true;
  }
}

/**
 * Main specification service for project validation
 */
export class ProjectValidationSpecificationService {
  private nameSpec = new ValidProjectNameSpecification();
  private slugSpec = new ValidProjectSlugSpecification();
  private descriptionSpec = new ValidProjectDescriptionSpecification();
  private repositoryUrlSpec = new ValidRepositoryUrlSpecification();
  private branchSpec = new ValidProjectBranchSpecification();
  private statusSpec = new ValidProjectStatusSpecification();
  private settingsSpec = new ValidProjectSettingsSpecification();
  private visibilitySpec = new ValidVisibilityChangeSpecification();

  constructor(private maxProjectsPerUser: number = 10) {}

  /**
   * Validate project creation
   */
  validateProjectCreation(
    user: UserEntity,
    data: {
      name: string;
      description?: string;
      slug: string;
      repositoryUrl?: string;
      branch?: string;
      settings?: Record<string, any>;
      isPublic?: boolean;
    },
    existingProjects: ProjectEntity[]
  ): { isValid: boolean; errors: string[] } {
    const context: ProjectValidationContext = {
      user,
      data,
      operation: 'create',
      existingProjects
    };

    const errors: string[] = [];

    // Check if user can create projects
    const canCreateSpec = new CanCreateProjectSpecification(this.maxProjectsPerUser);
    if (!canCreateSpec.isSatisfiedBy(context)) {
      errors.push('User cannot create more projects or lacks permission');
    }

    // Validate all fields
    if (!this.nameSpec.isSatisfiedBy(context)) {
      errors.push('Project name is invalid');
    }

    if (!this.slugSpec.isSatisfiedBy(context)) {
      errors.push('Project slug is invalid or already exists');
    }

    if (!this.descriptionSpec.isSatisfiedBy(context)) {
      errors.push('Project description is invalid');
    }

    if (!this.repositoryUrlSpec.isSatisfiedBy(context)) {
      errors.push('Repository URL is invalid');
    }

    if (!this.branchSpec.isSatisfiedBy(context)) {
      errors.push('Branch name is invalid');
    }

    if (!this.settingsSpec.isSatisfiedBy(context)) {
      errors.push('Project settings are invalid');
    }

    if (!this.visibilitySpec.isSatisfiedBy(context)) {
      errors.push('Project visibility setting is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate project update
   */
  validateProjectUpdate(
    project: ProjectEntity,
    user: UserEntity,
    data: Partial<{
      name: string;
      description: string;
      slug: string;
      repositoryUrl: string;
      branch: string;
      status: string;
      settings: Record<string, any>;
      isPublic: boolean;
    }>,
    existingProjects: ProjectEntity[]
  ): { isValid: boolean; errors: string[] } {
    const context: ProjectValidationContext = {
      project,
      user,
      data,
      operation: 'update',
      existingProjects
    };

    const errors: string[] = [];

    // Check if user can modify project
    const canModifySpec = new CanModifyProjectSpecification();
    if (!canModifySpec.isSatisfiedBy(context)) {
      errors.push('User lacks permission to modify this project');
    }

    // Validate all provided fields
    if (data.name !== undefined && !this.nameSpec.isSatisfiedBy(context)) {
      errors.push('Project name is invalid');
    }

    if (data.slug !== undefined && !this.slugSpec.isSatisfiedBy(context)) {
      errors.push('Project slug is invalid or already exists');
    }

    if (data.description !== undefined && !this.descriptionSpec.isSatisfiedBy(context)) {
      errors.push('Project description is invalid');
    }

    if (data.repositoryUrl !== undefined && !this.repositoryUrlSpec.isSatisfiedBy(context)) {
      errors.push('Repository URL is invalid');
    }

    if (data.branch !== undefined && !this.branchSpec.isSatisfiedBy(context)) {
      errors.push('Branch name is invalid');
    }

    if (data.status !== undefined && !this.statusSpec.isSatisfiedBy(context)) {
      errors.push('Project status transition is invalid');
    }

    if (data.settings !== undefined && !this.settingsSpec.isSatisfiedBy(context)) {
      errors.push('Project settings are invalid');
    }

    if (data.isPublic !== undefined && !this.visibilitySpec.isSatisfiedBy(context)) {
      errors.push('Project visibility change is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate project deletion
   */
  validateProjectDeletion(
    project: ProjectEntity,
    user: UserEntity
  ): { isValid: boolean; errors: string[] } {
    const context: ProjectValidationContext = {
      project,
      user,
      data: {},
      operation: 'delete'
    };

    const errors: string[] = [];

    // Check if user can delete project
    const canDeleteSpec = new CanDeleteProjectSpecification();
    if (!canDeleteSpec.isSatisfiedBy(context)) {
      errors.push('User lacks permission to delete this project');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
