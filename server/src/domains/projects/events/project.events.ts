// Project Domain Events
// These events represent important business events in the project lifecycle

export interface ProjectCreatedEvent {
  projectId: string;
  userId: string;
  projectName: string;
  slug: string;
  repositoryUrl?: string;
  timestamp: string;
  metadata?: {
    source: 'api' | 'import' | 'migration';
    settings?: Record<string, any>;
  };
}

export interface ProjectUpdatedEvent {
  projectId: string;
  userId: string;
  changes: {
    name?: { old: string; new: string };
    description?: { old: string | null; new: string | null };
    status?: { old: string; new: string };
    settings?: { old: Record<string, any>; new: Record<string, any> };
  };
  timestamp: string;
  metadata?: {
    source: 'api' | 'admin' | 'system';
    reason?: string;
  };
}

export interface ProjectDeletedEvent {
  projectId: string;
  userId: string;
  projectName: string;
  slug: string;
  timestamp: string;
  metadata?: {
    memberCount: number;
    documentCount?: number;
    reason?: string;
  };
}

export interface ProjectStatusChangedEvent {
  projectId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
  metadata?: {
    reason?: string;
    automatic?: boolean;
  };
}

export interface ProjectSyncStartedEvent {
  projectId: string;
  userId: string;
  syncId: string;
  repositoryUrl?: string;
  branch?: string;
  timestamp: string;
  metadata?: {
    force?: boolean;
    lastSyncAt?: string;
    tempPath?: string;
    useTemporaryClone?: boolean;
  };
}

export interface ProjectSyncCompletedEvent {
  projectId: string;
  userId: string;
  syncId: string;
  status: 'success' | 'error' | 'partial';
  documentsProcessed: number;
  documentsAdded: number;
  documentsUpdated: number;
  documentsDeleted: number;
  duration: number; // milliseconds
  timestamp: string;
  metadata?: {
    errors?: string[];
    warnings?: string[];
    repositoryInfo?: {
      url: string;
      branch: string;
      commit?: string;
    };
  };
}

export interface ProjectMemberAddedEvent {
  projectId: string;
  userId: string; // User who added the member
  memberId: string; // User who was added
  memberEmail: string;
  role: string;
  timestamp: string;
  metadata?: {
    invitationId?: string;
    source: 'invitation' | 'direct_add' | 'import';
  };
}

export interface ProjectMemberRemovedEvent {
  projectId: string;
  userId: string; // User who removed the member
  memberId: string; // User who was removed
  memberEmail: string;
  previousRole: string;
  timestamp: string;
  metadata?: {
    reason?: 'left' | 'removed' | 'deactivated';
    automatic?: boolean;
  };
}

export interface ProjectMemberRoleChangedEvent {
  projectId: string;
  userId: string; // User who changed the role
  memberId: string; // User whose role was changed
  memberEmail: string;
  oldRole: string;
  newRole: string;
  timestamp: string;
  metadata?: {
    reason?: string;
  };
}

export interface ProjectSettingsUpdatedEvent {
  projectId: string;
  userId: string;
  changes: {
    repositoryUrl?: { old?: string; new?: string };
    repositoryPath?: { old?: string; new?: string };
    branch?: { old: string; new: string };
    includePatterns?: { old: string[]; new: string[] };
    excludePatterns?: { old: string[]; new: string[] };
    maxFileSize?: { old: number; new: number };
    enableAutoSync?: { old: boolean; new: boolean };
    syncInterval?: { old: number; new: number };
    followSymlinks?: { old: boolean; new: boolean };
  };
  timestamp: string;
  metadata?: {
    source: 'api' | 'admin' | 'migration';
    triggeredSync?: boolean;
  };
}

// Union type for all project events
export type ProjectDomainEvent = 
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | ProjectDeletedEvent
  | ProjectStatusChangedEvent
  | ProjectSyncStartedEvent
  | ProjectSyncCompletedEvent
  | ProjectMemberAddedEvent
  | ProjectMemberRemovedEvent
  | ProjectMemberRoleChangedEvent
  | ProjectSettingsUpdatedEvent;

// Event names for type safety
export const PROJECT_EVENTS = {
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_STATUS_CHANGED: 'project.status.changed',
  PROJECT_SYNC_STARTED: 'project.sync.started',
  PROJECT_SYNC_COMPLETED: 'project.sync.completed',
  PROJECT_MEMBER_ADDED: 'project.member.added',
  PROJECT_MEMBER_REMOVED: 'project.member.removed',
  PROJECT_MEMBER_ROLE_CHANGED: 'project.member.role.changed',
  PROJECT_SETTINGS_UPDATED: 'project.settings.updated'
} as const;

export type ProjectEventName = typeof PROJECT_EVENTS[keyof typeof PROJECT_EVENTS];