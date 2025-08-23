import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ProjectService } from './service';
import { ProjectRepository } from './repository';
import { 
  CreateProjectRequestSchema, 
  UpdateProjectRequestSchema,
  SyncProjectRequestSchema,
  ProjectListQuerySchema,
  ProjectParamsSchema 
} from './schemas';

export const projectRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize dependencies (will be improved with DI container later)
  const repository = new ProjectRepository(fastify.prisma);
  
  // For now, we'll create a simple event emitter implementation
  const eventEmitter = {
    emit: (event: string, payload: any) => {
      // TODO: Implement proper event emission
      console.log(`Event emitted: ${event}`, payload);
    }
  };

  // TODO: Initialize knowledge service properly
  const knowledgeService = null;
  
  // TODO: Load config properly
  const config = {
    maxProjectsPerUser: 10,
    defaultSyncInterval: 3600000,
    allowedRepositoryTypes: ['git', 'github'],
    maxProjectNameLength: 100,
    maxDescriptionLength: 500,
    slugPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  };

  const service = new ProjectService(repository, eventEmitter as any, knowledgeService, config);

  // Helper to sanitize project data for response
  function sanitizeProject(project: any) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      repositoryUrl: project.settings?.repositoryUrl,
      repositoryPath: project.settings?.repositoryPath,
      settings: project.settings,
      status: project.status,
      lastSyncAt: project.lastSyncAt?.toISOString(),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      stats: project.stats,
    };
  }

  // Create project
  fastify.post('/', {
    schema: {
      body: CreateProjectRequestSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { name, description, repositoryUrl, repositoryPath, settings } = request.body as any;
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
          message: "User not authenticated",
          correlationId: request.id,
        });
      }

      const newProject = await service.createProject({
        name,
        description,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        userId,
        settings: {
          ...settings,
          repositoryUrl,
          repositoryPath,
        },
      }, request.id);

      reply.status(201).send({
        success: true,
        data: {
          project: sanitizeProject(newProject),
        },
        correlationId: request.id,
      });

    } catch (error: any) {
      fastify.log.error({
        correlationId: request.id,
        error: error.message,
      }, "Project creation failed");

      const statusCode = error.name === 'ConflictError' ? 409 : 
                        error.name === 'ValidationError' ? 400 : 500;

      reply.status(statusCode).send({
        success: false,
        error: error.name || "Project Creation Error",
        message: error.message || "Failed to create project",
        correlationId: request.id,
      });
    }
  });

  // Get projects
  fastify.get('/', {
    schema: {
      querystring: ProjectListQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            metadata: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      const query = request.query as any;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
          message: "User not authenticated",
          correlationId: request.id,
        });
      }

      const projects = await service.getProjectsForUser(userId, query, request.id);
      const total = projects.length;

      reply.status(200).send({
        success: true,
        data: {
          projects: projects.map(sanitizeProject),
        },
        metadata: {
          total,
          limit: query.limit || 20,
          offset: query.offset || 0,
          hasMore: (query.offset || 0) + (query.limit || 20) < total,
        },
        correlationId: request.id,
      });

    } catch (error: any) {
      fastify.log.error({
        correlationId: request.id,
        error: error.message,
      }, "Failed to fetch projects");

      reply.status(500).send({
        success: false,
        error: "Project Fetch Error",
        message: "Failed to fetch projects",
        correlationId: request.id,
      });
    }
  });

  // Get project by ID
  fastify.get('/:projectId', {
    schema: {
      params: ProjectParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as any;
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
          message: "User not authenticated",
          correlationId: request.id,
        });
      }

      const project = await service.getProjectById(projectId, userId, request.id);

      if (!project) {
        return reply.status(404).send({
          success: false,
          error: "Not Found",
          message: "Project not found",
          correlationId: request.id,
        });
      }

      reply.status(200).send({
        success: true,
        data: {
          project: sanitizeProject(project),
        },
        correlationId: request.id,
      });

    } catch (error: any) {
      fastify.log.error({
        correlationId: request.id,
        error: error.message,
      }, "Failed to fetch project");

      const statusCode = error.name === 'NotFoundError' ? 404 : 500;

      reply.status(statusCode).send({
        success: false,
        error: error.name || "Project Fetch Error",
        message: error.message || "Failed to fetch project",
        correlationId: request.id,
      });
    }
  });

  // Update project
  fastify.put('/:projectId', {
    schema: {
      params: ProjectParamsSchema,
      body: UpdateProjectRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as any;
      const updateData = request.body as any;
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
          message: "User not authenticated",
          correlationId: request.id,
        });
      }

      const updatedProject = await service.updateProject(
        projectId,
        userId,
        updateData,
        request.id
      );

      reply.status(200).send({
        success: true,
        data: {
          project: sanitizeProject(updatedProject),
        },
        correlationId: request.id,
      });

    } catch (error: any) {
      fastify.log.error({
        correlationId: request.id,
        error: error.message,
      }, "Project update failed");

      const statusCode = error.name === 'NotFoundError' ? 404 : 
                        error.name === 'ConflictError' ? 409 : 500;

      reply.status(statusCode).send({
        success: false,
        error: error.name || "Project Update Error",
        message: error.message || "Failed to update project",
        correlationId: request.id,
      });
    }
  });

  // Delete project
  fastify.delete('/:projectId', {
    schema: {
      params: ProjectParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            correlationId: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as any;
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
          message: "User not authenticated",
          correlationId: request.id,
        });
      }

      await service.deleteProject(projectId, userId, request.id);

      reply.status(200).send({
        success: true,
        message: "Project deleted successfully",
        correlationId: request.id,
      });

    } catch (error: any) {
      fastify.log.error({
        correlationId: request.id,
        error: error.message,
      }, "Project deletion failed");

      const statusCode = error.name === 'NotFoundError' ? 404 : 500;

      reply.status(statusCode).send({
        success: false,
        error: error.name || "Project Deletion Error",
        message: error.message || "Failed to delete project",
        correlationId: request.id,
      });
    }
  });

  // Sync project
  fastify.post('/:projectId/sync', {
    schema: {
      params: ProjectParamsSchema,
      body: SyncProjectRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as any;
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
          message: "User not authenticated",
          correlationId: request.id,
        });
      }

      const syncResult = await service.syncProject(projectId, userId, request.id);

      reply.status(200).send({
        success: true,
        data: {
          syncStatus: "started",
          ...syncResult,
        },
        correlationId: request.id,
      });

    } catch (error: any) {
      fastify.log.error({
        correlationId: request.id,
        error: error.message,
      }, "Project sync failed");

      const statusCode = error.name === 'NotFoundError' ? 404 : 
                        error.name === 'ValidationError' ? 400 : 500;

      reply.status(statusCode).send({
        success: false,
        error: error.name || "Project Sync Error",
        message: error.message || "Failed to sync project",
        correlationId: request.id,
      });
    }
  });

  // Get sync status
  fastify.get('/:projectId/sync/status', {
    schema: {
      params: ProjectParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            correlationId: { type: 'string' }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as any;
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
          message: "User not authenticated",
          correlationId: request.id,
        });
      }

      // Get project to verify access
      const project = await service.getProjectById(projectId, userId, request.id);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: "Not Found",
          message: "Project not found",
          correlationId: request.id,
        });
      }

      // For now, return basic status - in a full implementation, 
      // you'd track sync progress in the database
      const syncStatus = {
        projectId,
        status: project.status,
        lastUpdated: project.updatedAt,
        // In a full implementation, you'd add:
        // progress: 0-100,
        // currentStep: 'extracting' | 'chunking' | 'embedding' | 'storing',
        // documentsProcessed: number,
        // totalDocuments: number,
        // estimatedTimeRemaining: number
      };

      reply.status(200).send({
        success: true,
        data: {
          syncStatus,
        },
        correlationId: request.id,
      });

    } catch (error: any) {
      fastify.log.error({
        correlationId: request.id,
        error: error.message,
      }, "Get sync status failed");

      const statusCode = error.name === 'NotFoundError' ? 404 : 500;

      reply.status(statusCode).send({
        success: false,
        error: error.name || "Sync Status Error",
        message: error.message || "Failed to get sync status",
        correlationId: request.id,
      });
    }
  });
};