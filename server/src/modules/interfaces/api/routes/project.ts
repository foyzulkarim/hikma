import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logger } from '@/core/utils/logger.js';
import { ValidationError, NotFoundError, ConflictError } from '@/core/errors/app-error.js';
import { validateRequest } from '../middleware/validation.js';
import { projectService } from '@/modules/projects/services/project-service.js';

// Request schemas
const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  repositoryUrl: z.string().url().optional(),
  repositoryPath: z.string().optional(),
  settings: z.object({
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
    enableAutoSync: z.boolean().optional(),
    syncInterval: z.number().optional(),
  }).optional(),
});

const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  repositoryUrl: z.string().url().optional(),
  repositoryPath: z.string().optional(),
  settings: z.object({
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
    enableAutoSync: z.boolean().optional(),
    syncInterval: z.number().optional(),
  }).optional(),
});

const SyncProjectRequestSchema = z.object({
  force: z.boolean().optional(),
  incremental: z.boolean().optional(),
});

// Helper to sanitize project data for response
function sanitizeProject(project: any) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    repositoryUrl: project.repositoryUrl,
    repositoryPath: project.repositoryPath,
    settings: project.settings,
    status: project.status,
    lastSyncAt: project.lastSyncAt?.toISOString(),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    stats: project.stats,
  };
}

// Route handlers
async function handleCreateProject(
  request: FastifyRequest<{
    Body: z.infer<typeof CreateProjectRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { name, description, repositoryUrl, repositoryPath, settings } = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new ValidationError("User not authenticated");
    }

    logger.info({
      correlationId: request.id,
      userId,
      name,
      repositoryUrl,
      repositoryPath,
    }, "Creating new project");

    const newProject = await projectService.createProject({
      name,
      description,
      repositoryUrl,
      repositoryPath,
      ownerId: userId,
      settings,
    });

    reply.status(201).send({
      success: true,
      data: {
        project: sanitizeProject(newProject),
      },
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }, "Project creation failed");

    if (error instanceof ConflictError) {
      reply.status(409).send({
        success: false,
        error: "Conflict Error",
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ValidationError) {
      reply.status(400).send({
        success: false,
        error: "Validation Error",
        message: error.message,
        correlationId: request.id,
      });
    } else {
      reply.status(500).send({
        success: false,
        error: "Project Creation Error",
        message: "Failed to create project",
        correlationId: request.id,
      });
    }
  }
}

async function handleGetProjects(
  request: FastifyRequest<{
    Querystring: {
      limit?: number;
      offset?: number;
      status?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { limit, offset, status } = request.query;
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new ValidationError("User not authenticated");
    }

    logger.debug({
      correlationId: request.id,
      userId,
      limit,
      offset,
      status,
    }, "Fetching user projects");

    const { projects, total } = await projectService.getProjectsByOwner(
      userId,
      limit,
      offset,
      status as any // Cast to ProjectStatus if needed, Zod will validate
    );

    reply.status(200).send({
      success: true,
      data: {
        projects: projects.map(sanitizeProject),
      },
      metadata: {
        total,
        limit: limit || 50,
        offset: offset || 0,
        hasMore: (offset || 0) + (limit || 50) < total,
      },
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }, "Failed to fetch projects");

    reply.status(500).send({
      success: false,
      error: "Project Fetch Error",
      message: "Failed to fetch projects",
      correlationId: request.id,
    });
  }
}

async function handleGetProject(
  request: FastifyRequest<{
    Params: { projectId: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { projectId } = request.params;
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new ValidationError("User not authenticated");
    }

    logger.debug({
      correlationId: request.id,
      userId,
      projectId,
    }, "Fetching project details");

    const project = await projectService.getProjectById(projectId, userId);

    reply.status(200).send({
      success: true,
      data: {
        project: sanitizeProject(project),
      },
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }, "Failed to fetch project");

    if (error instanceof NotFoundError) {
      reply.status(404).send({
        success: false,
        error: "Not Found",
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ValidationError) {
      reply.status(403).send({
        success: false,
        error: "Access Denied",
        message: error.message,
        correlationId: request.id,
      });
    } else {
      reply.status(500).send({
        success: false,
        error: "Project Fetch Error",
        message: "Failed to fetch project",
        correlationId: request.id,
      });
    }
  }
}

async function handleUpdateProject(
  request: FastifyRequest<{
    Params: { projectId: string };
    Body: z.infer<typeof UpdateProjectRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { projectId } = request.params;
    const updateData = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new ValidationError("User not authenticated");
    }

    logger.info({
      correlationId: request.id,
      userId,
      projectId,
      updateData,
    }, "Updating project");

    const updatedProject = await projectService.updateProject(
      projectId,
      userId,
      updateData
    );

    reply.status(200).send({
      success: true,
      data: {
        project: sanitizeProject(updatedProject),
      },
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }, "Project update failed");

    if (error instanceof NotFoundError) {
      reply.status(404).send({
        success: false,
        error: "Not Found",
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ValidationError) {
      reply.status(403).send({
        success: false,
        error: "Access Denied",
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ConflictError) {
      reply.status(409).send({
        success: false,
        error: "Conflict Error",
        message: error.message,
        correlationId: request.id,
      });
    } else {
      reply.status(500).send({
        success: false,
        error: "Project Update Error",
        message: "Failed to update project",
        correlationId: request.id,
      });
    }
  }
}

async function handleDeleteProject(
  request: FastifyRequest<{
    Params: { projectId: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { projectId } = request.params;
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new ValidationError("User not authenticated");
    }

    logger.info({
      correlationId: request.id,
      userId,
      projectId,
    }, "Deleting project");

    await projectService.deleteProject(projectId, userId);

    reply.status(200).send({
      success: true,
      message: "Project deleted successfully",
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }, "Project deletion failed");

    if (error instanceof NotFoundError) {
      reply.status(404).send({
        success: false,
        error: "Not Found",
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ValidationError) {
      reply.status(403).send({
        success: false,
        error: "Access Denied",
        message: error.message,
        correlationId: request.id,
      });
    } else {
      reply.status(500).send({
        success: false,
        error: "Project Deletion Error",
        message: "Failed to delete project",
        correlationId: request.id,
      });
    }
  }
}

async function handleSyncProject(
  request: FastifyRequest<{
    Params: { projectId: string };
    Body: z.infer<typeof SyncProjectRequestSchema>;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { projectId } = request.params;
    const { force = false, incremental = true } = request.body;
    const userId = (request as any).user?.id;

    if (!userId) {
      throw new ValidationError("User not authenticated");
    }

    logger.info({
      correlationId: request.id,
      userId,
      projectId,
      force,
      incremental,
    }, "Starting project sync");

    const updatedProject = await projectService.syncProject(
      projectId,
      userId,
      force,
      incremental
    );

    reply.status(200).send({
      success: true,
      data: {
        project: sanitizeProject(updatedProject),
        syncStatus: "started",
      },
      correlationId: request.id,
    });

  } catch (error) {
    logger.error({
      correlationId: request.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }, "Project sync failed");

    if (error instanceof NotFoundError) {
      reply.status(404).send({
        success: false,
        error: "Not Found",
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ValidationError) {
      reply.status(403).send({
        success: false,
        error: "Access Denied",
        message: error.message,
        correlationId: request.id,
      });
    } else if (error instanceof ConflictError) {
      reply.status(409).send({
        success: false,
        error: "Conflict Error",
        message: error.message,
        correlationId: request.id,
      });
    } else {
      reply.status(500).send({
        success: false,
        error: "Project Sync Error",
        message: "Failed to sync project",
        correlationId: request.id,
      });
    }
  }
}

// Route registration
export async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  // Create project
  fastify.post("/", {
    preHandler: [fastify.authenticate, validateRequest(CreateProjectRequestSchema)],
    schema: {
      description: "Create a new project",
      tags: ["Projects"],
      body: CreateProjectRequestSchema,
    },
  }, handleCreateProject);

  // Get projects
  fastify.get("/", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Get user projects",
      tags: ["Projects"],
      querystring: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 100, default: 50 },
          offset: { type: "number", minimum: 0, default: 0 },
          status: { type: "string", enum: ["ACTIVE", "SYNCING", "ERROR", "INACTIVE"] },
        },
      },
    },
  }, handleGetProjects);

  // Get project by ID
  fastify.get("/:projectId", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Get project details",
      tags: ["Projects"],
      params: {
        type: "object",
        properties: {
          projectId: { type: "string" },
        },
        required: ["projectId"],
      },
    },
  }, handleGetProject);

  // Update project
  fastify.put("/:projectId", {
    preHandler: [fastify.authenticate, validateRequest(UpdateProjectRequestSchema)],
    schema: {
      description: "Update project details",
      tags: ["Projects"],
      params: {
        type: "object",
        properties: {
          projectId: { type: "string" },
        },
        required: ["projectId"],
      },
      body: UpdateProjectRequestSchema,
    },
  }, handleUpdateProject);

  // Delete project
  fastify.delete("/:projectId", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Delete a project",
      tags: ["Projects"],
      params: {
        type: "object",
        properties: {
          projectId: { type: "string" },
        },
        required: ["projectId"],
      },
    },
  }, handleDeleteProject);

  // Sync project
  fastify.post("/:projectId/sync", {
    preHandler: [fastify.authenticate, validateRequest(SyncProjectRequestSchema)],
    schema: {
      description: "Initiate project synchronization",
      tags: ["Projects"],
      params: {
        type: "object",
        properties: {
          projectId: { type: "string" },
        },
        required: ["projectId"],
      },
      body: SyncProjectRequestSchema,
    },
  }, handleSyncProject);
}


