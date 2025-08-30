import { ProjectEntity } from '../entities/project.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Base specification interface for project-related business rules
 */
export interface ISpecification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

/**
 * Abstract base class for specifications
 */
export abstract class BaseSpecification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

/**
 * Composite specifications for logical operations
 */
class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private spec: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/**
 * Context for project access specifications
 */
export interface ProjectAccessContext {
  project: ProjectEntity;
  user: UserEntity;
  requestedAction: 'read' | 'write' | 'delete' | 'manage_members' | 'sync';
}

/**
 * Specification: User is a system administrator
 */
export class UserIsAdminSpecification extends BaseSpecification<ProjectAccessContext> {
  isSatisfiedBy(context: ProjectAccessContext): boolean {
    return context.user.isAdmin();
  }
}

/**
 * Specification: User is the project owner
 */
export class UserIsProjectOwnerSpecification extends BaseSpecification<ProjectAccessContext> {
  isSatisfiedBy(context: ProjectAccessContext): boolean {
    return context.project.isOwner(context.user.id);
  }
}

/**
 * Specification: User is a project member
 */
export class UserIsProjectMemberSpecification extends BaseSpecification<ProjectAccessContext> {
  isSatisfiedBy(context: ProjectAccessContext): boolean {
    return context.project.isMember(context.user.id);
  }
}

/**
 * Specification: Project is active
 */
export class ProjectIsActiveSpecification extends BaseSpecification<ProjectAccessContext> {
  isSatisfiedBy(context: ProjectAccessContext): boolean {
    return context.project.isActive();
  }
}

/**
 * Specification: User can read project
 */
export class CanReadProjectSpecification extends BaseSpecification<ProjectAccessContext> {
  private adminSpec = new UserIsAdminSpecification();
  private memberSpec = new UserIsProjectMemberSpecification();
  private activeSpec = new ProjectIsActiveSpecification();

  isSatisfiedBy(context: ProjectAccessContext): boolean {
    if (context.requestedAction !== 'read') {
      return false;
    }

    // Admin can read any project
    if (this.adminSpec.isSatisfiedBy(context)) {
      return true;
    }

    // Members can read active projects they belong to
    return this.activeSpec.isSatisfiedBy(context) && this.memberSpec.isSatisfiedBy(context);
  }
}

/**
 * Specification: User can write to project
 */
export class CanWriteProjectSpecification extends BaseSpecification<ProjectAccessContext> {
  private adminSpec = new UserIsAdminSpecification();
  private ownerSpec = new UserIsProjectOwnerSpecification();
  private memberSpec = new UserIsProjectMemberSpecification();
  private activeSpec = new ProjectIsActiveSpecification();

  isSatisfiedBy(context: ProjectAccessContext): boolean {
    if (context.requestedAction !== 'write') {
      return false;
    }

    // Admin can write to any project
    if (this.adminSpec.isSatisfiedBy(context)) {
      return true;
    }

    // Owner can write to their projects
    if (this.ownerSpec.isSatisfiedBy(context)) {
      return true;
    }

    // Members can write to active projects (depending on role)
    return this.activeSpec.isSatisfiedBy(context) && this.memberSpec.isSatisfiedBy(context);
  }
}

/**
 * Specification: User can delete project
 */
export class CanDeleteProjectSpecification extends BaseSpecification<ProjectAccessContext> {
  private adminSpec = new UserIsAdminSpecification();
  private ownerSpec = new UserIsProjectOwnerSpecification();

  isSatisfiedBy(context: ProjectAccessContext): boolean {
    if (context.requestedAction !== 'delete') {
      return false;
    }

    // Only admin or owner can delete projects
    return this.adminSpec.isSatisfiedBy(context) || this.ownerSpec.isSatisfiedBy(context);
  }
}

/**
 * Specification: User can manage project members
 */
export class CanManageMembersSpecification extends BaseSpecification<ProjectAccessContext> {
  private adminSpec = new UserIsAdminSpecification();
  private ownerSpec = new UserIsProjectOwnerSpecification();
  private activeSpec = new ProjectIsActiveSpecification();

  isSatisfiedBy(context: ProjectAccessContext): boolean {
    if (context.requestedAction !== 'manage_members') {
      return false;
    }

    // Admin can manage members of any project
    if (this.adminSpec.isSatisfiedBy(context)) {
      return true;
    }

    // Owner can manage members of active projects
    return this.activeSpec.isSatisfiedBy(context) && this.ownerSpec.isSatisfiedBy(context);
  }
}

/**
 * Specification: User can sync project
 */
export class CanSyncProjectSpecification extends BaseSpecification<ProjectAccessContext> {
  private adminSpec = new UserIsAdminSpecification();
  private ownerSpec = new UserIsProjectOwnerSpecification();
  private memberSpec = new UserIsProjectMemberSpecification();
  private activeSpec = new ProjectIsActiveSpecification();

  isSatisfiedBy(context: ProjectAccessContext): boolean {
    if (context.requestedAction !== 'sync') {
      return false;
    }

    // Project must be active and have valid repository
    if (!this.activeSpec.isSatisfiedBy(context) || !context.project.canSync()) {
      return false;
    }

    // Admin can sync any project
    if (this.adminSpec.isSatisfiedBy(context)) {
      return true;
    }

    // Owner or members can sync projects
    return this.ownerSpec.isSatisfiedBy(context) || this.memberSpec.isSatisfiedBy(context);
  }
}

/**
 * Main specification service for project access control
 */
export class ProjectAccessSpecificationService {
  private readSpec = new CanReadProjectSpecification();
  private writeSpec = new CanWriteProjectSpecification();
  private deleteSpec = new CanDeleteProjectSpecification();
  private manageMembersSpec = new CanManageMembersSpecification();
  private syncSpec = new CanSyncProjectSpecification();

  canUserAccessProject(
    project: ProjectEntity,
    user: UserEntity,
    action: 'read' | 'write' | 'delete' | 'manage_members' | 'sync'
  ): boolean {
    const context: ProjectAccessContext = {
      project,
      user,
      requestedAction: action
    };

    switch (action) {
      case 'read':
        return this.readSpec.isSatisfiedBy(context);
      case 'write':
        return this.writeSpec.isSatisfiedBy(context);
      case 'delete':
        return this.deleteSpec.isSatisfiedBy(context);
      case 'manage_members':
        return this.manageMembersSpec.isSatisfiedBy(context);
      case 'sync':
        return this.syncSpec.isSatisfiedBy(context);
      default:
        return false;
    }
  }

  /**
   * Get all actions a user can perform on a project
   */
  getUserProjectPermissions(
    project: ProjectEntity,
    user: UserEntity
  ): Array<'read' | 'write' | 'delete' | 'manage_members' | 'sync'> {
    const actions: Array<'read' | 'write' | 'delete' | 'manage_members' | 'sync'> = [];
    const possibleActions: Array<'read' | 'write' | 'delete' | 'manage_members' | 'sync'> = [
      'read', 'write', 'delete', 'manage_members', 'sync'
    ];

    for (const action of possibleActions) {
      if (this.canUserAccessProject(project, user, action)) {
        actions.push(action);
      }
    }

    return actions;
  }
}