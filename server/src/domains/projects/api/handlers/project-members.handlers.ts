import { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectService } from '../../services/project.service';
import { ProjectMemberService } from '../../services/project-member.service';
import { UserContext } from '../../../users/auth/types';
import {
  projectMemberSchema
} from '../schemas';

interface AuthenticatedRequest extends FastifyRequest {
  user?: UserContext;
}

export class ProjectMembersHandlers {
  constructor(
    private readonly projectService: ProjectService,
    private readonly memberService: ProjectMemberService
  ) {}

  async getProjectMembers(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { projectId } = request.params as { projectId: string };
      
      const project = await this.projectService.getProject(projectId, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const members = await this.memberService.getProjectMembers(projectId, userId);

      return reply.send({
        members: members.map(member => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt
        }))
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to fetch project members' 
      });
    }
  }

  async addProjectMember(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { projectId } = request.params as { projectId: string };
      const { userId: memberUserId, role } = request.body as { userId: string; role: string };
      
      const project = await this.projectService.getProject(projectId, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Check if user has permission to add members (owner or admin)
      if (!project.canUserModify(userId)) {
        return reply.status(403).send({ error: 'Insufficient permissions to add members' });
      }

      await this.memberService.addProjectMember(projectId, userId, memberUserId, role);

      return reply.status(201).send({
        message: 'Member added successfully'
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to add project member' 
      });
    }
  }

  async removeProjectMember(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { projectId, memberId } = request.params as { projectId: string; memberId: string };
      
      const project = await this.projectService.getProject(projectId, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Check if user has permission to remove members (owner or admin)
      if (!project.canUserModify(userId)) {
        return reply.status(403).send({ error: 'Insufficient permissions to remove members' });
      }

      await this.memberService.removeProjectMember(projectId, userId, memberId);

      return reply.status(204).send();
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to remove project member' 
      });
    }
  }
}