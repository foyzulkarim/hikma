// Project CRUD Handlers
// Extracted from project.routes.ts for better organization

import { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectService } from '../../services/project.service';
import { CreateProjectUseCase } from '../../use-cases/create-project.use-case';
import { DeleteProjectUseCase } from '../../use-cases/delete-project.use-case';
import { UserContext } from '../../../users/auth/types';
import {
  projectResponseSchema,
  createProjectBodySchema,
  updateProjectBodySchema,
  deleteResultSchema
} from '../schemas';

interface AuthenticatedRequest extends FastifyRequest {
  user?: UserContext;
}

export class ProjectHandlers {
  constructor(
    private readonly service: ProjectService,
    private readonly createProjectUseCase: CreateProjectUseCase,
    private readonly deleteProjectUseCase: DeleteProjectUseCase
  ) {}

  async getProjects(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { limit, offset, status, sortBy, sortOrder } = request.query as any;
      
      const result = await this.service.getUserProjects(userId, {
        limit,
        offset,
        status,
        sortBy,
        sortOrder
      });

      return reply.send({
        projects: result.projects.map(p => p.toResponse()),
        metadata: result.metadata
      });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to fetch projects' 
      });
    }
  }

  async getProject(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      
      const project = await this.service.getProject(id, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return reply.send({ project: project.toResponse() });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to fetch project' 
      });
    }
  }

  async createProject(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const body = request.body as any;
      
      const result = await this.createProjectUseCase.execute({
        ...body,
        userId
      });

      return reply.status(201).send(result);
    } catch (error) {
      return reply.status(400).send({ 
        error: error instanceof Error ? error.message : 'Failed to create project' 
      });
    }
  }

  async updateProject(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      const body = request.body as any;
      
      const project = await this.service.updateProject(id, body, userId);

      return reply.send({ project: project.toResponse() });
    } catch (error) {
      return reply.status(400).send({ 
        error: error instanceof Error ? error.message : 'Failed to update project' 
      });
    }
  }

  async deleteProject(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      
      const result = await this.deleteProjectUseCase.execute({
        projectId: id,
        userId
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.message });
      }

      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to delete project' 
      });
    }
  }
}