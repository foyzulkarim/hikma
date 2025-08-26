import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ProjectRepository } from '../repositories/project.repository';
import { ProjectService } from '../services/project.service';
import { CreateProjectUseCase } from '../use-cases/create-project.use-case';
import { SyncProjectUseCase } from '../use-cases/sync-project.use-case';
import { DeleteProjectUseCase } from '../use-cases/delete-project.use-case';

export const projectRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize dependencies
  const prisma = fastify.prisma as PrismaClient;
  const repository = new ProjectRepository(prisma);
  const service = new ProjectService(repository);
  
  // Initialize use cases
  const createProjectUseCase = new CreateProjectUseCase(service);
  const syncProjectUseCase = new SyncProjectUseCase(service);
  const deleteProjectUseCase = new DeleteProjectUseCase(service);

  // Get all projects for user
  fastify.get('/', {
    schema: {
      description: 'Get all projects for the authenticated user',
      tags: ['Projects'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
          offset: { type: 'number', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
          sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'], default: 'updatedAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            projects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string' }
                }
              }
            },
            metadata: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                limit: { type: 'number' },
                offset: { type: 'number' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { limit, offset, status, sortBy, sortOrder } = request.query as any;
      
      const result = await service.getUserProjects(userId, {
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
  });

  // Get project by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get a specific project by ID',
      tags: ['Projects'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            project: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' },
                repositoryUrl: { type: 'string' },
                settings: { type: 'object' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      
      const project = await service.getProject(id, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return reply.send({ project: project.toResponse() });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to fetch project' 
      });
    }
  });

  // Create new project
  fastify.post('/', {
    schema: {
      description: 'Create a new project',
      tags: ['Projects'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          repositoryUrl: { type: 'string', format: 'uri' },
          repositoryPath: { type: 'string' },
          branch: { type: 'string', default: 'main' },
          settings: {
            type: 'object',
            properties: {
              includePatterns: { type: 'array', items: { type: 'string' } },
              excludePatterns: { type: 'array', items: { type: 'string' } },
              maxFileSize: { type: 'number', minimum: 0 },
              enableAutoSync: { type: 'boolean' },
              syncInterval: { type: 'number', minimum: 60 },
              followSymlinks: { type: 'boolean' }
            }
          }
        },
        required: ['name']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            project: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const body = request.body as any;
      
      const result = await createProjectUseCase.execute({
        ...body,
        userId
      });

      return reply.status(201).send(result);
    } catch (error) {
      return reply.status(400).send({ 
        error: error instanceof Error ? error.message : 'Failed to create project' 
      });
    }
  });

  // Update project
  fastify.put('/:id', {
    schema: {
      description: 'Update an existing project',
      tags: ['Projects'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          settings: { type: 'object' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            project: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      const body = request.body as any;
      
      const project = await service.updateProject(id, body, userId);

      return reply.send({ project: project.toResponse() });
    } catch (error) {
      return reply.status(400).send({ 
        error: error instanceof Error ? error.message : 'Failed to update project' 
      });
    }
  });

  // Delete project
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a project',
      tags: ['Projects'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            deletedProject: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      
      const result = await deleteProjectUseCase.execute({
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
  });

  // Sync project
  fastify.post('/:id/sync', {
    schema: {
      description: 'Synchronize project with repository',
      tags: ['Projects'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            syncedFiles: { type: 'number' }
          }
        },
        400: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      
      const result = await syncProjectUseCase.execute({
        projectId: id,
        userId
      });

      if (result.status === 'error') {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to sync project' 
      });
    }
  });

  // Get project members
  fastify.get('/:id/members', {
    schema: {
      description: 'Get all members of a project',
      tags: ['Projects'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            members: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      
      const members = await service.getProjectMembers(id, userId);

      return reply.send({ members });
    } catch (error) {
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to fetch project members' 
      });
    }
  });
};
