import { ProjectEntity } from '../entities/project.entity';
import { IProjectRepository, CreateProjectData, UpdateProjectData, FindProjectsOptions } from '../repositories/project.repository.interface';
import { eventBus } from '@/shared/events/event-bus';

export interface ProjectSyncResult {
  status: 'success' | 'error' | 'in_progress';
  message: string;
  syncId?: string;
  documentsProcessed?: number;
}

export class ProjectService {
  constructor(private projectRepository: IProjectRepository) {}

  async createProject(data: CreateProjectData): Promise<ProjectEntity> {
    // Validate slug format
    if (!this.isValidSlug(data.slug)) {
      throw new Error('Invalid slug format. Use lowercase letters, numbers, and hyphens only.');
    }

    // Check slug availability
    const isSlugAvailable = await this.projectRepository.isSlugAvailable(data.slug);
    if (!isSlugAvailable) {
      throw new Error(`Project with slug '${data.slug}' already exists.`);
    }

    // Create project
    const project = await this.projectRepository.create(data);

    // Emit event
    eventBus.emit('project-created', {
      projectId: project.id,
      userId: data.userId,
      timestamp: new Date().toISOString(),
      projectData: {
        name: project.name,
        slug: project.slug
      }
    });

    return project;
  }

  async getProject(id: string, userId: string): Promise<ProjectEntity | null> {
    return this.projectRepository.findById(id, userId);
  }

  async getProjectBySlug(slug: string, userId: string): Promise<ProjectEntity | null> {
    return this.projectRepository.findBySlug(slug, userId);
  }

  async updateProject(id: string, data: UpdateProjectData, userId: string): Promise<ProjectEntity> {
    // Validate project exists and user has access
    const existingProject = await this.projectRepository.findById(id, userId);
    if (!existingProject) {
      throw new Error('Project not found or access denied');
    }

    // Validate settings if provided
    if (data.settings) {
      const tempProject = new ProjectEntity(
        existingProject.id,
        existingProject.name,
        existingProject.slug,
        existingProject.description,
        existingProject.status,
        { ...existingProject.getTypedSettings(), ...data.settings },
        existingProject.createdAt,
        existingProject.updatedAt
      );

      const validation = tempProject.validateSettings();
      if (!validation.isValid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }
    }

    const updatedProject = await this.projectRepository.update(id, data, userId);

    // Emit event
    eventBus.emit('project-updated', {
      projectId: id,
      userId,
      timestamp: new Date().toISOString(),
      changes: data
    });

    return updatedProject;
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    // Verify project exists and user is owner
    const project = await this.projectRepository.findById(id, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    if (!project.isOwner(userId)) {
      throw new Error('Only project owners can delete projects');
    }

    await this.projectRepository.delete(id, userId);

    // Emit event
    eventBus.emit('project-deleted', {
      projectId: id,
      userId,
      timestamp: new Date().toISOString(),
      projectData: {
        name: project.name,
        slug: project.slug
      }
    });
  }

  async getUserProjects(userId: string, options?: FindProjectsOptions) {
    return this.projectRepository.findByUserId(userId, options);
  }

  async syncProject(id: string, userId: string): Promise<ProjectSyncResult> {
    // Verify project exists and user has access
    const project = await this.projectRepository.findById(id, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Check if project can be synced
    if (!project.canSync()) {
      return {
        status: 'error',
        message: 'Project cannot be synced. Check project status and repository configuration.'
      };
    }

    // Generate sync ID
    const syncId = `sync_${id}_${Date.now()}`;

    // Emit sync started event
    eventBus.emit('sync-job-started', {
      jobId: syncId,
      projectId: id,
      userId,
      timestamp: new Date().toISOString(),
      repositoryInfo: project.getRepositoryInfo()
    });

    // Return immediate response (actual sync happens asynchronously)
    return {
      status: 'in_progress',
      message: 'Project sync started successfully',
      syncId
    };
  }

  async addProjectMember(projectId: string, userId: string, targetUserId: string, role: string): Promise<void> {
    // Verify user can modify project
    const canModify = await this.projectRepository.canUserModify(projectId, userId);
    if (!canModify) {
      throw new Error('User does not have permission to add members to this project');
    }

    // Validate role
    const validRoles = ['MEMBER', 'ADMIN', 'OWNER'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role specified');
    }

    await this.projectRepository.addMember(projectId, targetUserId, role);

    // Emit event
    eventBus.emit('project-member-added', {
      projectId,
      userId,
      targetUserId,
      role,
      timestamp: new Date().toISOString()
    });
  }

  async removeProjectMember(projectId: string, userId: string, targetUserId: string): Promise<void> {
    // Verify user can modify project
    const canModify = await this.projectRepository.canUserModify(projectId, userId);
    if (!canModify) {
      throw new Error('User does not have permission to remove members from this project');
    }

    // Don't allow removing the last owner
    const members = await this.projectRepository.getMembers(projectId);
    const owners = members.filter(m => m.role === 'OWNER');
    const targetMember = members.find(m => m.userId === targetUserId);

    if (targetMember?.role === 'OWNER' && owners.length === 1) {
      throw new Error('Cannot remove the last owner from the project');
    }

    await this.projectRepository.removeMember(projectId, targetUserId);

    // Emit event
    eventBus.emit('project-member-removed', {
      projectId,
      userId,
      targetUserId,
      timestamp: new Date().toISOString()
    });
  }

  async getProjectMembers(projectId: string, userId: string) {
    // Verify user has access to project
    const hasAccess = await this.projectRepository.canUserAccess(projectId, userId);
    if (!hasAccess) {
      throw new Error('Access denied to project');
    }

    return this.projectRepository.getMembers(projectId);
  }

  private isValidSlug(slug: string): boolean {
    // Slug should be lowercase, alphanumeric with hyphens, 3-50 characters
    const slugRegex = /^[a-z0-9-]{3,50}$/;
    return slugRegex.test(slug) && !slug.startsWith('-') && !slug.endsWith('-');
  }

  // Utility methods
  async validateProjectAccess(projectId: string, userId: string): Promise<ProjectEntity> {
    const project = await this.projectRepository.findById(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }
    return project;
  }

  async generateUniqueSlug(baseName: string): Promise<string> {
    let slug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 45);

    // Remove leading/trailing hyphens
    slug = slug.replace(/^-+|-+$/g, '');

    // Ensure minimum length
    if (slug.length < 3) {
      slug = `project-${Date.now()}`;
    }

    let counter = 0;
    let finalSlug = slug;

    while (!(await this.projectRepository.isSlugAvailable(finalSlug))) {
      counter++;
      finalSlug = `${slug}-${counter}`;
    }

    return finalSlug;
  }
}
