import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ProjectRepository } from '../repositories/project.repository';
import { ProjectMemberRepository } from '../repositories/project-member.repository';
import { ProjectService, ProjectSyncService, ProjectMemberService } from '../services';
import { CreateProjectUseCase } from '../use-cases/create-project.use-case';
import { SyncProjectUseCase } from '../use-cases/sync-project.use-case';
import { DeleteProjectUseCase } from '../use-cases/delete-project.use-case';
// import { AuthService } from '@/domains/users/auth/service';
// import { IUserRepository } from '@/domains/users/repositories/user.repository';
// import { IUserEventEmitter } from '@/domains/users/events/user.events';
import {
  projectListQuerySchema,
  projectIdParamSchema,
  createProjectBodySchema,
  updateProjectBodySchema
} from './schemas';

import {
  projectListResponseSchema,
  projectDetailResponseWrapperSchema,
  projectCreateResponseSchema,
  projectUpdateResponseSchema,
  projectMembersResponseSchema,
  syncResponseSchema,
  deleteResponseSchema
} from './schemas';

import {
  ProjectHandlers,
  ProjectSyncHandlers,
  ProjectMembersHandlers
} from './handlers';

import { createProjectAuthMiddleware } from './middleware';

export const projectRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize dependencies
  const prisma = new PrismaClient();
  const repository = new ProjectRepository(prisma);
  const memberRepository = new ProjectMemberRepository(prisma);
  const service = new ProjectService(repository);
  const syncService = new ProjectSyncService(repository);
  const memberService = new ProjectMemberService(repository, memberRepository);
  
  // Initialize use cases
  const createProjectUseCase = new CreateProjectUseCase(service);
  const syncProjectUseCase = new SyncProjectUseCase(service, syncService);
  const deleteProjectUseCase = new DeleteProjectUseCase(service);
  
  // Initialize auth service (commented out until proper user repository is available)
  // const authService = new AuthService(userRepository, userEventEmitter);
  // const authMiddleware = createProjectAuthMiddleware(authService);
  
  // Initialize handlers
  const projectHandlers = new ProjectHandlers(service, createProjectUseCase, deleteProjectUseCase);
  const projectSyncHandlers = new ProjectSyncHandlers(syncService, syncProjectUseCase);
  const projectMembersHandlers = new ProjectMembersHandlers(service, memberService);

  // Get all projects for user
  fastify.get('/', {
    schema: {
      description: 'Get all projects for the authenticated user',
      tags: ['Projects'],
      querystring: projectListQuerySchema,
      response: {
        200: projectListResponseSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireAuth(), // Uncomment when auth is properly initialized
  }, projectHandlers.getProjects.bind(projectHandlers));

  // Get project by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get a specific project by ID',
      tags: ['Projects'],
      params: projectIdParamSchema,
      response: {
        200: projectDetailResponseWrapperSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireAuth(), // Uncomment when auth is properly initialized
  }, projectHandlers.getProject.bind(projectHandlers));

  // Create new project
  fastify.post('/', {
    schema: {
      description: 'Create a new project',
      tags: ['Projects'],
      body: createProjectBodySchema,
      response: {
        201: projectCreateResponseSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireAuth(), // Uncomment when auth is properly initialized
  }, projectHandlers.createProject.bind(projectHandlers));

  // Update project
  fastify.put('/:id', {
    schema: {
      description: 'Update an existing project',
      tags: ['Projects'],
      params: projectIdParamSchema,
      body: updateProjectBodySchema,
      response: {
        200: projectUpdateResponseSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireManagerOrAdmin(), // Uncomment when auth is properly initialized
  }, projectHandlers.updateProject.bind(projectHandlers));

  // Delete project
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a project',
      tags: ['Projects'],
      params: projectIdParamSchema,
      response: {
        204: { type: 'null' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireManagerOrAdmin(), // Uncomment when auth is properly initialized
  }, projectHandlers.deleteProject.bind(projectHandlers));

  // Sync project
  fastify.post('/:projectId/sync', {
    schema: {
      description: 'Trigger project synchronization',
      tags: ['Projects'],
      params: {
        type: 'object',
        properties: {
          projectId: { type: 'string', format: 'uuid' }
        },
        required: ['projectId']
      },
      response: {
        200: syncResponseSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireAuth(), // Uncomment when auth is properly initialized
  }, projectSyncHandlers.syncProject.bind(projectSyncHandlers));

  // Get project members
  fastify.get('/:id/members', {
    schema: {
      description: 'Get project members',
      tags: ['Projects'],
      params: projectIdParamSchema,
      response: {
        200: projectMembersResponseSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireAuth(), // Uncomment when auth is properly initialized
  }, projectMembersHandlers.getProjectMembers.bind(projectMembersHandlers));

  // Add project member
  fastify.post('/:id/members', {
    schema: {
      description: 'Add a member to the project',
      tags: ['Projects'],
      params: projectIdParamSchema,
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['MEMBER', 'ADMIN'] }
        },
        required: ['userId', 'role']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireManagerOrAdmin(), // Uncomment when auth is properly initialized
  }, projectMembersHandlers.addProjectMember.bind(projectMembersHandlers));

  // Remove project member
  fastify.delete('/:id/members/:memberId', {
    schema: {
      description: 'Remove a member from the project',
      tags: ['Projects'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          memberId: { type: 'string', format: 'uuid' }
        },
        required: ['id', 'memberId']
      },
      response: {
        204: { type: 'null' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    },
    // preHandler: authMiddleware.requireManagerOrAdmin(), // Uncomment when auth is properly initialized
  }, projectMembersHandlers.removeProjectMember.bind(projectMembersHandlers));
};
