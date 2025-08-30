import { PrismaClient, MemberRole } from '@prisma/client';
import { 
  IProjectMemberRepository, 
  ProjectMember, 
  CreateMemberData, 
  UpdateMemberData 
} from './project-member.repository.interface';

export class ProjectMemberRepository implements IProjectMemberRepository {
  constructor(private prisma: PrismaClient) {}

  async addMember(data: CreateMemberData): Promise<void> {
    await this.prisma.projectMember.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        role: data.role
      }
    });
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.deleteMany({
      where: {
        projectId,
        userId
      }
    });
  }

  async updateMemberRole(projectId: string, userId: string, role: MemberRole): Promise<void> {
    await this.prisma.projectMember.updateMany({
      where: {
        projectId,
        userId
      },
      data: {
        role
      }
    });
  }

  async getMembers(projectId: string): Promise<ProjectMember[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        id: true,
        userId: true,
        projectId: true,
        role: true,
        createdAt: true
      }
    });

    return members.map(member => ({
      ...member,
      role: member.role as string
    }));
  }

  async getMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        role: true,
        createdAt: true
      }
    });

    if (!member) {
      return null;
    }

    return {
      ...member,
      role: member.role as string
    };
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      }
    });

    return !!member;
  }

  async hasRole(projectId: string, userId: string, role: MemberRole): Promise<boolean> {
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      }
    });

    if (!member) {
      return false;
    }

    // Define role hierarchy: OWNER > ADMIN > MEMBER
    const roleHierarchy = {
      'OWNER': 3,
      'ADMIN': 2,
      'MEMBER': 1
    };

    const userRoleLevel = roleHierarchy[member.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }

  async getMemberCount(projectId: string): Promise<number> {
    return await this.prisma.projectMember.count({
      where: { projectId }
    });
  }

  async canUserModify(projectId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      }
    });

    if (!member) {
      return false;
    }

    // Only owners and admins can modify projects
    return member.role === 'OWNER' || member.role === 'ADMIN';
  }
}