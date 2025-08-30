import { ProjectEntity } from '../entities/project.entity';
import { IProjectRepository } from '../repositories/project.repository.interface';
import { eventBus } from '@/shared/events/event-bus';
import { PROJECT_EVENTS, ProjectSyncStartedEvent, ProjectSyncCompletedEvent } from '../events/project.events';

export interface ProjectSyncResult {
  status: 'success' | 'error' | 'in_progress';
  message: string;
  syncId?: string;
  documentsProcessed?: number;
}

export class ProjectSyncService {
  constructor(private projectRepository: IProjectRepository) {}

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

    // Emit domain event
    const repositoryInfo = project.getRepositoryInfo();
    const event: ProjectSyncStartedEvent = {
      projectId: id,
      userId,
      syncId,
      repositoryUrl: repositoryInfo?.url,
      branch: repositoryInfo?.branch,
      timestamp: new Date().toISOString(),
      metadata: {
        force: false
      }
    };
    eventBus.emit(PROJECT_EVENTS.PROJECT_SYNC_STARTED, event);

    // Return immediate response (actual sync happens asynchronously)
    return {
      status: 'in_progress',
      message: 'Project sync started successfully',
      syncId
    };
  }

  async getSyncStatus(syncId: string, userId: string): Promise<ProjectSyncResult> {
    // This would typically query a sync status store or job queue
    // For now, return a placeholder implementation
    return {
      status: 'in_progress',
      message: 'Sync status check not yet implemented',
      syncId
    };
  }

  async cancelSync(syncId: string, userId: string): Promise<void> {
    // This would typically cancel a running sync job
    // Emit sync cancelled event
    eventBus.emit('sync-job-cancelled', {
      jobId: syncId,
      userId,
      timestamp: new Date().toISOString()
    });
  }
}