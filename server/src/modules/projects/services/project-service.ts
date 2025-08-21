import { PrismaClient, Project, ProjectSettings, ProjectStatus } from '@prisma/client';
import { logger } from '@/core/utils/logger.js';
import { NotFoundError, ValidationError, ConflictError } from '@/core/errors/app-error.js';

const prisma = new PrismaClient();

export class ProjectService {
  /**
   * Creates a new project.
   * @param data - Project creation data.
   * @returns The newly created project.
   */
  async createProject(data: {
    name: string;
    description?: string;
    repositoryUrl?: string;
    repositoryPath?: string;
    ownerId: string;
    settings?: {
      includePatterns?: string[];
      excludePatterns?: string[];
      maxFileSize?: number;
      enableAutoSync?: boolean;
      syncInterval?: number;
    };
  }): Promise<Project> {
    const { name, description, repositoryUrl, repositoryPath, ownerId, settings } = data;

    // Check for duplicate project name for the same owner
    const existingProject = await prisma.project.findFirst({
      where: { name, ownerId },
    });

    if (existingProject) {
      throw new ConflictError(`Project with name '${name}' already exists for this user.`);
    }

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        repositoryUrl,
        repositoryPath,
        ownerId,
        status: ProjectStatus.ACTIVE,
        settings: {
          create: {
            includePatterns: settings?.includePatterns || ['**/*.js', '**/*.ts', '**/*.py', '**/*.md'],
            excludePatterns: settings?.excludePatterns || ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
            maxFileSize: settings?.maxFileSize || 1024 * 1024, // 1MB
            enableAutoSync: settings?.enableAutoSync || false,
            syncInterval: settings?.syncInterval || 3600, // 1 hour
          },
        },
        stats: {
          create: {},
        },
      },
      include: { settings: true, stats: true },
    });

    logger.info({ projectId: newProject.id, ownerId }, 'Project created successfully');
    return newProject;
  }

  /**
   * Retrieves projects for a given owner, with pagination and filtering.
   * @param ownerId - The ID of the project owner.
   * @param limit - Maximum number of projects to return.
   * @param offset - Number of projects to skip.
   * @param status - Filter by project status.
   * @returns A list of projects and total count.
   */
  async getProjectsByOwner(
    ownerId: string,
    limit: number = 50,
    offset: number = 0,
    status?: ProjectStatus
  ): Promise<{ projects: Project[]; total: number }> {
    const where: any = { ownerId };
    if (status) {
      where.status = status;
    }

    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        take: limit,
        skip: offset,
        include: { settings: true, stats: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    return { projects, total };
  }

  /**
   * Retrieves a single project by its ID.
   * @param projectId - The ID of the project.
   * @param ownerId - The ID of the project owner (for authorization).
   * @returns The project object.
   */
  async getProjectById(projectId: string, ownerId: string): Promise<Project> {
    const project = await prisma.project.findUnique({
      where: { id: projectId, ownerId },
      include: { settings: true, stats: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found or access denied');
    }
    return project;
  }

  /**
   * Updates an existing project.
   * @param projectId - The ID of the project to update.
   * @param ownerId - The ID of the project owner (for authorization).
   * @param updateData - Data to update the project with.
   * @returns The updated project.
   */
  async updateProject(
    projectId: string,
    ownerId: string,
    updateData: {
      name?: string;
      description?: string;
      repositoryUrl?: string;
      repositoryPath?: string;
      settings?: {
        includePatterns?: string[];
        excludePatterns?: string[];
        maxFileSize?: number;
        enableAutoSync?: boolean;
        syncInterval?: number;
      };
      status?: ProjectStatus;
    }
  ): Promise<Project> {
    const project = await prisma.project.findUnique({
      where: { id: projectId, ownerId },
    });

    if (!project) {
      throw new NotFoundError('Project not found or access denied');
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== project.name) {
      const existingProject = await prisma.project.findFirst({
        where: { name: updateData.name, ownerId },
      });
      if (existingProject && existingProject.id !== projectId) {
        throw new ConflictError(`Project with name '${updateData.name}' already exists for this user.`);
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: updateData.name,
        description: updateData.description,
        repositoryUrl: updateData.repositoryUrl,
        repositoryPath: updateData.repositoryPath,
        status: updateData.status,
        settings: updateData.settings ? { update: updateData.settings } : undefined,
        updatedAt: new Date(),
      },
      include: { settings: true, stats: true },
    });

    logger.info({ projectId, ownerId }, 'Project updated successfully');
    return updatedProject;
  }

  /**
   * Deletes a project.
   * @param projectId - The ID of the project to delete.
   * @param ownerId - The ID of the project owner (for authorization).
   */
  async deleteProject(projectId: string, ownerId: string): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId, ownerId },
    });

    if (!project) {
      throw new NotFoundError('Project not found or access denied');
    }

    // Delete related settings and stats first due to Prisma's default cascade behavior
    await prisma.projectSettings.delete({ where: { projectId } });
    await prisma.projectStats.delete({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } });

    logger.info({ projectId, ownerId }, 'Project deleted successfully');
  }

  /**
   * Initiates a sync for a project.
   * @param projectId - The ID of the project to sync.
   * @param ownerId - The ID of the project owner (for authorization).
   * @param force - Whether to force a full sync.
   * @param incremental - Whether to perform an incremental sync.
   * @returns The updated project with sync status.
   */
  async syncProject(
    projectId: string,
    ownerId: string,
    force: boolean = false,
    incremental: boolean = true
  ): Promise<Project> {
    const project = await prisma.project.findUnique({
      where: { id: projectId, ownerId },
      include: { settings: true, stats: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found or access denied');
    }

    // Prevent sync if already syncing
    if (project.status === ProjectStatus.SYNCING) {
      throw new ConflictError('Project is already syncing');
    }

    // Update project status to syncing
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.SYNCING, updatedAt: new Date() },
      include: { settings: true, stats: true },
    });

    logger.info({ projectId, ownerId, force, incremental }, 'Project sync initiated');

    // In a real application, this would trigger an asynchronous job/worker
    // For now, simulate a delay and update status back to active
    setTimeout(async () => {
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            status: ProjectStatus.ACTIVE,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
            stats: {
              update: {
                lastSyncDuration: Math.floor(Math.random() * 30000) + 5000, // 5-35 seconds
                totalFiles: Math.floor(Math.random() * 1000) + 100,
                totalSize: Math.floor(Math.random() * 10000000) + 1000000, // 1-10MB
              },
            },
          },
        });
        logger.info({ projectId }, 'Project sync completed successfully (simulated)');
      } catch (err) {
        logger.error({ projectId, error: err }, 'Project sync simulation failed to update status');
        await prisma.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.ERROR, updatedAt: new Date() },
        });
      }
    }, 2000);

    return updatedProject;
  }
}

export const projectService = new ProjectService();


