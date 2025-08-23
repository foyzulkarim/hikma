export enum ProjectEvent {
  CREATED = 'project.created',
  UPDATED = 'project.updated',
  DELETED = 'project.deleted',
  SYNC_STARTED = 'project.sync.started',
  SYNC_COMPLETED = 'project.sync.completed',
  SYNC_FAILED = 'project.sync.failed',
  STATUS_CHANGED = 'project.status.changed'
}

export interface ProjectEventPayload {
  projectId: string;
  userId: string;
  timestamp: Date;
  correlationId?: string;
}

export interface ProjectCreatedPayload extends ProjectEventPayload {
  projectName: string;
  settings: Record<string, any>;
}

export interface ProjectSyncPayload extends ProjectEventPayload {
  syncType: 'manual' | 'scheduled';
  syncId: string;
}

export interface IProjectEventEmitter {
  emit(event: ProjectEvent, payload: ProjectEventPayload): void;
}