import { PrismaClient, ProjectStatus, MemberRole } from '@prisma/client';
import { ProjectEntity } from '../entities/project.entity';
import { 
  IProjectRepository, 
  CreateProjectData, 
  UpdateProjectData, 
  FindProjectsOptions,
  ProjectListResult 
} from './project.repository.interface';

export class ProjectRepository implements IProjectRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateProjectData): Promise<ProjectEntity> {
    // Check for duplicate slug
    const existingProject = await this.prisma.project.findUnique({
      where: { slug: data.slug },
    });

    if (existingProject) {
      throw new Error(`Project with slug '${data.slug}' already exists.`);
    }

    // Create project and add owner in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          settings: data.settings || {},
          status: 'ACTIVE' as ProjectStatus,
        },
        include: {
          members: true
        }
      });

      // Add creator as owner
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: data.userId,
          role: 'OWNER' as MemberRole,
        },
      });

      return newProject;
    });

    return this.mapToEntity(result);
  }

  async findById(id: string, userId?: string): Promise<ProjectEntity | null> {
    const whereClause: any = { id };
    
    // If userId provided, ensure user has access
    if (userId) {
      whereClause.members = {
        some: { userId }
      };
    }

    const project = await this.prisma.project.findFirst({
      where: whereClause,
      include: {
        members: true
      }
    });

    return project ? this.mapToEntity(project) : null;
  }

  async findBySlug(slug: string, userId: string): Promise<ProjectEntity | null> {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        members: {
          some: { userId }
        }
      },
      include: {
        members: true
      }
    });

    return project ? this.mapToEntity(project) : null;
  }

  async update(id: string, data: UpdateProjectData, userId: string): Promise<ProjectEntity> {
    // Verify user can modify project
    const canModify = await this.canUserModify(id, userId);
    if (!canModify) {
      throw new Error('User does not have permission to modify this project');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status as ProjectStatus;
    if (data.settings !== undefined) updateData.settings = data.settings;

    const updatedProject = await this.prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        members: true
      }
    });

    return this.mapToEntity(updatedProject);
  }

  async delete(id: string, userId: string): Promise<void> {
    // Verify user is owner
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        members: {
          some: {
            userId,
            role: 'OWNER'
          }
        }
      }
    });

    if (!project) {
      throw new Error('Project not found or user is not owner');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete members first
      await tx.projectMember.deleteMany({
        where: { projectId: id }
      });

      // Delete project
      await tx.project.delete({
        where: { id }
      });
    });
  }

  async findByUserId(userId: string, options: FindProjectsOptions = {}): Promise<ProjectListResult> {
    const {
      limit = 10,
      offset = 0,
      status,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options;

    const whereClause: any = {
      members: {
        some: { userId }
      }
    };

    if (status) {
      whereClause.status = status as ProjectStatus;
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: whereClause,
        include: {
          members: true
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        take: limit,
        skip: offset
      }),
      this.prisma.project.count({
        where: whereClause
      })
    ]);

    return {
      projects: projects.map(p => this.mapToEntity(p)),
      metadata: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  async findAll(options: FindProjectsOptions = {}): Promise<ProjectListResult> {
    const {
      limit = 10,
      offset = 0,
      status,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options;

    const whereClause: any = {};
    if (status) {
      whereClause.status = status as ProjectStatus;
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: whereClause,
        include: {
          members: true
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        take: limit,
        skip: offset
      }),
      this.prisma.project.count({
        where: whereClause
      })
    ]);

    return {
      projects: projects.map(p => this.mapToEntity(p)),
      metadata: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  async count(userId?: string): Promise<number> {
    const whereClause: any = {};
    
    if (userId) {
      whereClause.members = {
        some: { userId }
      };
    }

    return this.prisma.project.count({
      where: whereClause
    });
  }

  async exists(id: string, userId?: string): Promise<boolean> {
    const whereClause: any = { id };
    
    if (userId) {
      whereClause.members = {
        some: { userId }
      };
    }

    const project = await this.prisma.project.findFirst({
      where: whereClause,
      select: { id: true }
    });

    return !!project;
  }



  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const whereClause: any = { slug };
    
    if (excludeId) {
      whereClause.id = { not: excludeId };
    }

    const project = await this.prisma.project.findFirst({
      where: whereClause,
      select: { id: true }
    });

    return !project;
  }

  async canUserAccess(projectId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      },
      select: { id: true }
    });

    return !!member;
  }

  async canUserModify(projectId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        role: {
          in: ['OWNER', 'ADMIN']
        }
      },
      select: { id: true }
    });

    return !!member;
  }

  private mapToEntity(project: any): ProjectEntity {
    return new ProjectEntity(
      project.id,
      project.name,
      project.slug,
      project.description,
      project.status,
      project.settings,
      project.createdAt,
      project.updatedAt,
      project.members?.map((member: any) => ({
        id: member.id,
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      }))
    );
  }
}
