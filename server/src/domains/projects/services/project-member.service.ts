import { IProjectRepository } from '../repositories/project.repository.interface';
import { IProjectMemberRepository, CreateMemberData } from '../repositories/project-member.repository.interface';
import { eventBus } from '../../../shared/events/event-bus';
import { PROJECT_EVENTS, ProjectMemberAddedEvent, ProjectMemberRemovedEvent, ProjectMemberRoleChangedEvent } from '../events/project.events';

export interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  // Add other member properties as needed
}

export class ProjectMemberService {
  constructor(
    private projectRepository: IProjectRepository,
    private memberRepository: IProjectMemberRepository
  ) {}

  async addProjectMember(projectId: string, userId: string, targetUserId: string, role: string): Promise<void> {
    // Validate project exists and user has access
    const project = await this.projectRepository.findById(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Check if user has permission to add members (owner or admin)
    const canModify = await this.memberRepository.canUserModify(projectId, userId);
    if (!canModify) {
      throw new Error('Insufficient permissions to add members');
    }

    // Validate role
    const validRoles = ['MEMBER', 'ADMIN', 'OWNER'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role specified');
    }

    // Add member
    await this.memberRepository.addMember({
      projectId,
      userId: targetUserId,
      role: role as any
    });

    // Emit domain event
    const event: ProjectMemberAddedEvent = {
      projectId,
      userId,
      memberId: targetUserId,
      memberEmail: '', // TODO: Get email from user service
      role,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'direct_add'
      }
    };
    eventBus.emit(PROJECT_EVENTS.PROJECT_MEMBER_ADDED, event);
  }

  async removeProjectMember(projectId: string, userId: string, targetUserId: string): Promise<void> {
    // Validate project exists and user has access
    const project = await this.projectRepository.findById(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Check if user has permission to remove members (owner or admin)
    const canModify = await this.memberRepository.canUserModify(projectId, userId);
    if (!canModify) {
      throw new Error('Insufficient permissions to remove members');
    }

    // Check if this would leave the project without an owner
    const members = await this.memberRepository.getMembers(projectId);
    const owners = members.filter(m => m.role === 'OWNER');
    const targetMember = members.find(m => m.userId === targetUserId);
    
    if (targetMember?.role === 'OWNER' && owners.length === 1) {
      throw new Error('Cannot remove the last owner from the project');
    }

    await this.memberRepository.removeMember(projectId, targetUserId);

    // Emit domain event
    const event: ProjectMemberRemovedEvent = {
      projectId,
      userId,
      memberId: targetUserId,
      memberEmail: '', // TODO: Get email from user service
      previousRole: targetMember?.role || '',
      timestamp: new Date().toISOString(),
      metadata: {
        reason: 'removed'
      }
    };
    eventBus.emit(PROJECT_EVENTS.PROJECT_MEMBER_REMOVED, event);
  }

  async getProjectMembers(projectId: string, userId: string): Promise<ProjectMember[]> {
    // Verify user has access to project
    const hasAccess = await this.projectRepository.canUserAccess(projectId, userId);
    if (!hasAccess) {
      throw new Error('Access denied to project');
    }

    return this.memberRepository.getMembers(projectId);
  }

  async updateMemberRole(projectId: string, userId: string, targetUserId: string, newRole: string): Promise<void> {
    // Verify user can modify project
    const canModify = await this.projectRepository.canUserModify(projectId, userId);
    if (!canModify) {
      throw new Error('User does not have permission to update member roles');
    }

    // Validate role
    const validRoles = ['MEMBER', 'ADMIN', 'OWNER'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role specified');
    }

    // Don't allow changing the last owner's role
    const members = await this.memberRepository.getMembers(projectId);
    const owners = members.filter(m => m.role === 'OWNER');
    const targetMember = members.find(m => m.userId === targetUserId);

    if (targetMember?.role === 'OWNER' && owners.length === 1 && newRole !== 'OWNER') {
      throw new Error('Cannot change the role of the last owner');
    }

    const oldRole = targetMember?.role || '';
    await this.memberRepository.updateMemberRole(projectId, targetUserId, newRole as any);

    // Emit domain event
    const event: ProjectMemberRoleChangedEvent = {
      projectId,
      userId,
      memberId: targetUserId,
      memberEmail: '', // TODO: Get email from user service
      oldRole,
      newRole,
      timestamp: new Date().toISOString()
    };
    eventBus.emit(PROJECT_EVENTS.PROJECT_MEMBER_ROLE_CHANGED, event);
  }

  async getMemberRole(projectId: string, userId: string, targetUserId: string): Promise<string | null> {
    // Verify user has access to project
    const hasAccess = await this.projectRepository.canUserAccess(projectId, userId);
    if (!hasAccess) {
      throw new Error('Access denied to project');
    }

    const members = await this.memberRepository.getMembers(projectId);
    const member = members.find(m => m.userId === targetUserId);
    return member?.role || null;
  }
}