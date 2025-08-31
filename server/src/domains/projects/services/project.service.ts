import { ProjectEntity } from '../entities/project.entity';
import { IProjectRepository, CreateProjectData, UpdateProjectData, FindProjectsOptions } from '../repositories/project.repository.interface';
import { ProjectSlug } from '../value-objects';
import { eventBus } from '@/shared/events/event-bus';
import { PROJECT_EVENTS, ProjectCreatedEvent, ProjectUpdatedEvent, ProjectDeletedEvent } from '../events/project.events';

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

    // Emit domain event
    const repositoryInfo = project.getRepositoryInfo();
    const event: ProjectCreatedEvent = {
      projectId: project.id,
      userId: data.userId,
      projectName: project.name,
      slug: project.slug,
      repositoryUrl: repositoryInfo.url,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'api',
        settings: project.getTypedSettings()
      }
    };
    eventBus.emit(PROJECT_EVENTS.PROJECT_CREATED, event);

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
        existingProject.syncInfo,
        existingProject.createdAt,
        existingProject.updatedAt,
        existingProject.members
      );

      const validation = tempProject.validateSettings();
      if (!validation.isValid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }
    }

    const updatedProject = await this.projectRepository.update(id, data, userId);

    // Emit domain event
    const changes: any = {};
    if (data.name && data.name !== existingProject.name) {
      changes.name = { old: existingProject.name, new: data.name };
    }
    if (data.description !== undefined && data.description !== existingProject.description) {
      changes.description = { old: existingProject.description, new: data.description };
    }
    if (data.status && data.status !== existingProject.status) {
      changes.status = { old: existingProject.status, new: data.status };
    }
    if (data.settings) {
      changes.settings = { old: existingProject.getTypedSettings(), new: data.settings };
    }

    const event: ProjectUpdatedEvent = {
      projectId: id,
      userId,
      changes,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'api'
      }
    };
    eventBus.emit(PROJECT_EVENTS.PROJECT_UPDATED, event);

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

    // Emit domain event
    const event: ProjectDeletedEvent = {
      projectId: id,
      userId,
      projectName: project.name,
      slug: project.slug,
      timestamp: new Date().toISOString(),
      metadata: {
        memberCount: project.members?.length || 0,
        reason: 'user_requested'
      }
    };
    eventBus.emit(PROJECT_EVENTS.PROJECT_DELETED, event);
  }

  async getUserProjects(userId: string, options?: FindProjectsOptions) {
    return this.projectRepository.findByUserId(userId, options);
  }

  private isValidSlug(slug: string): boolean {
    return ProjectSlug.isValid(slug);
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
