import { PrismaClient, ProjectStatus, MemberRole } from '@prisma/client';
import { Project, CreateProjectData, UpdateProjectData, FindOptions } from './types';

export interface IProjectRepository {
  create(data: CreateProjectData): Promise<Project>;
  findById(id: string, userId?: string): Promise<Project | null>;
  findByUserId(userId: string, options?: FindOptions): Promise<Project[]>;
  findBySlug(slug: string, userId: string): Promise<Project | null>;
  update(id: string, data: UpdateProjectData, userId: string): Promise<Project>;
  delete(id: string, userId: string): Promise<void>;
  count(userId?: string): Promise<number>;
  exists(id: string, userId?: string): Promise<boolean>;
}

export class ProjectRepository implements IProjectRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateProjectData): Promise<Project> {
    // Implementation will mirror existing service logic
    // Check for duplicate slug, create project + member in transaction
    const existingProject = await this.prisma.project.findUnique({
      where: { slug: data.slug },
    });

    if (existingProject) {
      throw new Error(`Project with slug '${data.slug}' already exists.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          slug: data.slug,
          status: ProjectStatus.ACTIVE,
          settings: data.settings || {},
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: data.userId,
          role: MemberRole.OWNER,
        },
      });

      return newProject;
    });
  }

  async findById(id: string, userId?: string): Promise<Project | null> {
    const whereClause: any = { id };
    
    if (userId) {
      whereClause.members = {
        some: {
          userId,
        },
      };
    }

    return await this.prisma.project.findFirst({
      where: whereClause,
      include: {
        members: true,
      },
    });
  }

  async findByUserId(userId: string, options: FindOptions = {}): Promise<Project[]> {
    const {
      limit = 20,
      offset = 0,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const whereClause: any = {
      members: {
        some: {
          userId,
        },
      },
    };

    if (status) {
      whereClause.status = status;
    }

    return await this.prisma.project.findMany({
      where: whereClause,
      include: {
        members: {
          where: { userId },
          select: { 
            id: true,
            projectId: true,
            userId: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      take: limit,
      skip: offset,
    });
  }

  async findBySlug(slug: string, userId: string): Promise<Project | null> {
    return await this.prisma.project.findFirst({
      where: {
        slug,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  async update(id: string, data: UpdateProjectData, userId: string): Promise<Project> {
    // Check if user has permission to update the project
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId: id,
        userId,
        role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
      },
    });

    if (!membership) {
      throw new Error('Project not found or insufficient permissions');
    }

    return await this.prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status as ProjectStatus,
        settings: data.settings,
      },
      include: {
        members: true,
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    // Check if user is the owner
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId: id,
        userId,
        role: MemberRole.OWNER,
      },
    });

    if (!membership) {
      throw new Error('Project not found or insufficient permissions');
    }

    await this.prisma.project.delete({
      where: { id },
    });
  }

  async count(userId?: string): Promise<number> {
    const whereClause: any = {};
    
    if (userId) {
      whereClause.members = {
        some: {
          userId,
        },
      };
    }

    return await this.prisma.project.count({
      where: whereClause,
    });
  }

  async exists(id: string, userId?: string): Promise<boolean> {
    const whereClause: any = { id };
    
    if (userId) {
      whereClause.members = {
        some: {
          userId,
        },
      };
    }

    const project = await this.prisma.project.findFirst({
      where: whereClause,
      select: { id: true },
    });

    return project !== null;
  }
}