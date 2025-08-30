import { MemberRole } from '@prisma/client';

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: string;
  createdAt: Date;
}

export interface CreateMemberData {
  projectId: string;
  userId: string;
  role: MemberRole;
}

export interface UpdateMemberData {
  role: MemberRole;
}

export interface IProjectMemberRepository {
  /**
   * Add a new member to a project
   */
  addMember(data: CreateMemberData): Promise<void>;

  /**
   * Remove a member from a project
   */
  removeMember(projectId: string, userId: string): Promise<void>;

  /**
   * Update a member's role in a project
   */
  updateMemberRole(projectId: string, userId: string, role: MemberRole): Promise<void>;

  /**
   * Get all members of a project
   */
  getMembers(projectId: string): Promise<ProjectMember[]>;

  /**
   * Get a specific member by project and user ID
   */
  getMember(projectId: string, userId: string): Promise<ProjectMember | null>;

  /**
   * Check if a user is a member of a project
   */
  isMember(projectId: string, userId: string): Promise<boolean>;

  /**
   * Check if a user has a specific role or higher in a project
   */
  hasRole(projectId: string, userId: string, role: MemberRole): Promise<boolean>;

  /**
   * Get member count for a project
   */
  getMemberCount(projectId: string): Promise<number>;

  /**
   * Check if user can modify project (owner or admin)
   */
  canUserModify(projectId: string, userId: string): Promise<boolean>;
}