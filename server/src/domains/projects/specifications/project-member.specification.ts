import { BaseSpecification } from './project-access.specification';
import { ProjectEntity } from '../entities/project.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Context for project member specifications
 */
export interface ProjectMemberContext {
  project: ProjectEntity;
  requestingUser: UserEntity;
  targetUserId: string;
  targetRole?: string;
  currentRole?: string;
  operation: 'add' | 'remove' | 'change_role';
}

/**
 * Specification: User has permission to modify project members
 */
export class CanModifyMembersSpecification extends BaseSpecification<ProjectMemberContext> {
  isSatisfiedBy(context: ProjectMemberContext): boolean {
    // Admin can modify any project members
    if (context.requestingUser.isAdmin()) {
      return true;
    }

    // Project owner can modify members
    if (context.project.isOwner(context.requestingUser.id)) {
      return true;
    }

    // Project must be active for member modifications
    if (!context.project.isActive()) {
      return false;
    }

    return false;
  }
}

/**
 * Specification: Role is valid for the project
 */
export class ValidProjectRoleSpecification extends BaseSpecification<ProjectMemberContext> {
  private validRoles = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'];

  isSatisfiedBy(context: ProjectMemberContext): boolean {
    if (!context.targetRole) {
      return false;
    }

    return this.validRoles.includes(context.targetRole);
  }
}

/**
 * Specification: Role hierarchy is respected
 * Lower privilege users cannot assign higher privilege roles
 */
export class RoleHierarchySpecification extends BaseSpecification<ProjectMemberContext> {
  private roleHierarchy = {
    'VIEWER': 1,
    'MEMBER': 2,
    'ADMIN': 3,
    'OWNER': 4
  };

  isSatisfiedBy(context: ProjectMemberContext): boolean {
    // Admin users can assign any role
    if (context.requestingUser.isAdmin()) {
      return true;
    }

    // Project owner can assign any role except OWNER
    if (context.project.isOwner(context.requestingUser.id)) {
      return context.targetRole !== 'OWNER';
    }

    // Get requesting user's role in the project
    const requestingUserRole = this.getUserProjectRole(context.project, context.requestingUser.id);
    if (!requestingUserRole) {
      return false;
    }

    const requestingUserLevel = this.roleHierarchy[requestingUserRole as keyof typeof this.roleHierarchy] || 0;
    const targetRoleLevel = this.roleHierarchy[context.targetRole as keyof typeof this.roleHierarchy] || 0;

    // User can only assign roles at their level or below
    return requestingUserLevel >= targetRoleLevel;
  }

  private getUserProjectRole(project: ProjectEntity, userId: string): string | null {
    if (!project.members) {
      return null;
    }

    const member = project.members.find(m => m.userId === userId);
    return member?.role || null;
  }
}

/**
 * Specification: Cannot remove the last owner from a project
 */
export class LastOwnerProtectionSpecification extends BaseSpecification<ProjectMemberContext> {
  isSatisfiedBy(context: ProjectMemberContext): boolean {
    // Only applies to remove operations or role changes from OWNER
    if (context.operation !== 'remove' && 
        !(context.operation === 'change_role' && context.currentRole === 'OWNER')) {
      return true;
    }

    if (!context.project.members) {
      return false;
    }

    // Count current owners
    const ownerCount = context.project.members.filter(m => m.role === 'OWNER').length;
    
    // If there's only one owner and we're trying to remove/demote them, reject
    if (ownerCount === 1 && context.currentRole === 'OWNER') {
      return false;
    }

    return true;
  }
}

/**
 * Specification: User is not already a member (for add operations)
 */
export class NotAlreadyMemberSpecification extends BaseSpecification<ProjectMemberContext> {
  isSatisfiedBy(context: ProjectMemberContext): boolean {
    if (context.operation !== 'add') {
      return true;
    }

    return !context.project.isMember(context.targetUserId);
  }
}

/**
 * Specification: User is currently a member (for remove/change_role operations)
 */
export class IsCurrentMemberSpecification extends BaseSpecification<ProjectMemberContext> {
  isSatisfiedBy(context: ProjectMemberContext): boolean {
    if (context.operation === 'add') {
      return true;
    }

    return context.project.isMember(context.targetUserId);
  }
}

/**
 * Specification: Cannot modify own role (except for admins)
 */
export class CannotModifyOwnRoleSpecification extends BaseSpecification<ProjectMemberContext> {
  isSatisfiedBy(context: ProjectMemberContext): boolean {
    // Admin can modify their own role
    if (context.requestingUser.isAdmin()) {
      return true;
    }

    // Users cannot modify their own role
    return context.requestingUser.id !== context.targetUserId;
  }
}

/**
 * Specification: Project has not exceeded member limit
 */
export class MemberLimitSpecification extends BaseSpecification<ProjectMemberContext> {
  private maxMembers = 100; // This could be configurable per project tier

  isSatisfiedBy(context: ProjectMemberContext): boolean {
    if (context.operation !== 'add') {
      return true;
    }

    const currentMemberCount = context.project.members?.length || 0;
    return currentMemberCount < this.maxMembers;
  }
}

/**
 * Main specification service for project member operations
 */
export class ProjectMemberSpecificationService {
  private canModifySpec = new CanModifyMembersSpecification();
  private validRoleSpec = new ValidProjectRoleSpecification();
  private roleHierarchySpec = new RoleHierarchySpecification();
  private lastOwnerSpec = new LastOwnerProtectionSpecification();
  private notAlreadyMemberSpec = new NotAlreadyMemberSpecification();
  private isCurrentMemberSpec = new IsCurrentMemberSpecification();
  private cannotModifyOwnRoleSpec = new CannotModifyOwnRoleSpecification();
  private memberLimitSpec = new MemberLimitSpecification();

  /**
   * Check if a user can add a member to a project
   */
  canAddMember(
    project: ProjectEntity,
    requestingUser: UserEntity,
    targetUserId: string,
    targetRole: string
  ): { canAdd: boolean; reason?: string } {
    const context: ProjectMemberContext = {
      project,
      requestingUser,
      targetUserId,
      targetRole,
      operation: 'add'
    };

    if (!this.canModifySpec.isSatisfiedBy(context)) {
      return { canAdd: false, reason: 'Insufficient permissions to modify project members' };
    }

    if (!this.validRoleSpec.isSatisfiedBy(context)) {
      return { canAdd: false, reason: 'Invalid role specified' };
    }

    if (!this.roleHierarchySpec.isSatisfiedBy(context)) {
      return { canAdd: false, reason: 'Cannot assign role higher than your own' };
    }

    if (!this.notAlreadyMemberSpec.isSatisfiedBy(context)) {
      return { canAdd: false, reason: 'User is already a member of this project' };
    }

    if (!this.memberLimitSpec.isSatisfiedBy(context)) {
      return { canAdd: false, reason: 'Project has reached maximum member limit' };
    }

    return { canAdd: true };
  }

  /**
   * Check if a user can remove a member from a project
   */
  canRemoveMember(
    project: ProjectEntity,
    requestingUser: UserEntity,
    targetUserId: string,
    currentRole: string
  ): { canRemove: boolean; reason?: string } {
    const context: ProjectMemberContext = {
      project,
      requestingUser,
      targetUserId,
      currentRole,
      operation: 'remove'
    };

    if (!this.canModifySpec.isSatisfiedBy(context)) {
      return { canRemove: false, reason: 'Insufficient permissions to modify project members' };
    }

    if (!this.isCurrentMemberSpec.isSatisfiedBy(context)) {
      return { canRemove: false, reason: 'User is not a member of this project' };
    }

    if (!this.lastOwnerSpec.isSatisfiedBy(context)) {
      return { canRemove: false, reason: 'Cannot remove the last owner from the project' };
    }

    if (!this.cannotModifyOwnRoleSpec.isSatisfiedBy(context)) {
      return { canRemove: false, reason: 'Cannot remove yourself from the project' };
    }

    return { canRemove: true };
  }

  /**
   * Check if a user can change another member's role
   */
  canChangeMemberRole(
    project: ProjectEntity,
    requestingUser: UserEntity,
    targetUserId: string,
    currentRole: string,
    newRole: string
  ): { canChange: boolean; reason?: string } {
    const context: ProjectMemberContext = {
      project,
      requestingUser,
      targetUserId,
      targetRole: newRole,
      currentRole,
      operation: 'change_role'
    };

    if (!this.canModifySpec.isSatisfiedBy(context)) {
      return { canChange: false, reason: 'Insufficient permissions to modify project members' };
    }

    if (!this.validRoleSpec.isSatisfiedBy(context)) {
      return { canChange: false, reason: 'Invalid role specified' };
    }

    if (!this.isCurrentMemberSpec.isSatisfiedBy(context)) {
      return { canChange: false, reason: 'User is not a member of this project' };
    }

    if (!this.roleHierarchySpec.isSatisfiedBy(context)) {
      return { canChange: false, reason: 'Cannot assign role higher than your own' };
    }

    if (!this.lastOwnerSpec.isSatisfiedBy(context)) {
      return { canChange: false, reason: 'Cannot demote the last owner from the project' };
    }

    if (!this.cannotModifyOwnRoleSpec.isSatisfiedBy(context)) {
      return { canChange: false, reason: 'Cannot modify your own role' };
    }

    return { canChange: true };
  }

  /**
   * Get the maximum role a user can assign in a project
   */
  getMaxAssignableRole(
    project: ProjectEntity,
    requestingUser: UserEntity
  ): string | null {
    if (requestingUser.isAdmin()) {
      return 'ADMIN'; // Admin can assign any role except OWNER
    }

    if (project.isOwner(requestingUser.id)) {
      return 'ADMIN'; // Owner can assign any role except OWNER
    }

    // For other roles, they would need to be implemented based on project member roles
    return null;
  }
}