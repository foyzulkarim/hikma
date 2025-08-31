import { JsonValue } from '@prisma/client/runtime/library';
import { ProjectStatus, MemberRole } from '@prisma/client';
import { ProjectSlug, ProjectSettings, ProjectSettingsData } from '../value-objects';

// Legacy interface for backward compatibility
export interface LegacyProjectSettings {
  repositoryUrl?: string;
  repositoryPath?: string;
  branch?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  enableAutoSync?: boolean;
  syncInterval?: number;
  followSymlinks?: boolean;
  // New properties for URL-only repositories
  isUrlOnlyRepository?: boolean;
  enableTemporaryCloning?: boolean;
}

// Sync status tracking interface
export interface ProjectSyncInfo {
  syncStatus?: 'idle' | 'in_progress' | 'completed' | 'failed';
  lastSyncAt?: string; // ISO date string
  tempPath?: string;
  syncId?: string;
  errorMessage?: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly status: ProjectStatus,
    public readonly settings: JsonValue,
    public readonly syncInfo: JsonValue,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly members?: ProjectMember[]
  ) {}

  // Domain methods
  public isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  public canSync(): boolean {
    return this.isActive() && this.hasValidRepository();
  }

  public hasValidRepository(): boolean {
    const settings = this.getTypedSettings();
    return !!(settings.repositoryUrl || settings.repositoryPath);
  }

  public isUrlOnlyRepository(): boolean {
    const settings = this.getTypedSettings();
    return !!(settings.repositoryUrl && !settings.repositoryPath && settings.isUrlOnlyRepository);
  }

  public requiresTemporaryCloning(): boolean {
    const settings = this.getTypedSettings();
    return this.isUrlOnlyRepository() && (settings.enableTemporaryCloning ?? true);
  }

  public canUseGitHubCli(): boolean {
    const settings = this.getTypedSettings();
    if (!settings.repositoryUrl) return false;
    
    // Check if it's a GitHub URL
    const url = settings.repositoryUrl.toLowerCase();
    return url.includes('github.com') || url.includes('github.enterprise');
  }

  public getTypedSettings(): LegacyProjectSettings {
    return this.settings as LegacyProjectSettings;
  }

  public getProjectSettings(): ProjectSettings {
    const legacySettings = this.getTypedSettings();
    return ProjectSettings.create(legacySettings);
  }

  public getSyncInfo(): ProjectSyncInfo {
    return (this.syncInfo as ProjectSyncInfo) || {};
  }

  public isSyncInProgress(): boolean {
    const syncInfo = this.getSyncInfo();
    return syncInfo.syncStatus === 'in_progress';
  }

  public hasValidTempClone(): boolean {
    const syncInfo = this.getSyncInfo();
    return !!(syncInfo.tempPath && syncInfo.syncStatus === 'completed');
  }

  public updateSyncStatus(updates: Partial<ProjectSyncInfo>): JsonValue {
    const currentSyncInfo = this.getSyncInfo();
    return {
      ...currentSyncInfo,
      ...updates,
      lastSyncAt: updates.lastSyncAt || new Date().toISOString()
    } as JsonValue;
  }

  public getRepositoryInfo(): { 
    url?: string; 
    path?: string; 
    branch?: string;
    isUrlOnly?: boolean;
    requiresTempCloning?: boolean;
    canUseGitHubCli?: boolean;
  } {
    const projectSettings = this.getProjectSettings();
    return {
      url: projectSettings.repositoryUrl?.value,
      path: projectSettings.repositoryPath,
      branch: projectSettings.branch,
      isUrlOnly: this.isUrlOnlyRepository(),
      requiresTempCloning: this.requiresTemporaryCloning(),
      canUseGitHubCli: this.canUseGitHubCli()
    };
  }

  public isOwner(userId: string): boolean {
    return this.members?.some(member => 
      member.userId === userId && member.role === 'OWNER'
    ) || false;
  }

  public isMember(userId: string): boolean {
    return this.members?.some(member => member.userId === userId) || false;
  }

  public canUserAccess(userId: string): boolean {
    return this.isMember(userId);
  }

  public canUserModify(userId: string): boolean {
    return this.members?.some(member => 
      member.userId === userId && 
      (member.role === 'OWNER' || member.role === 'ADMIN')
    ) || false;
  }

  // Factory methods
  public static create(data: {
    name: string;
    slug: string;
    description?: string | null;
    userId: string;
    settings?: LegacyProjectSettings;
  }): {
    name: string;
    slug: string;
    description: string | null;
    status: ProjectStatus;
    settings: JsonValue;
    syncInfo: JsonValue;
  } {
    return {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      status: 'ACTIVE' as ProjectStatus,
      settings: (data.settings || {}) as JsonValue,
      syncInfo: { syncStatus: 'idle' } as JsonValue
    };
  }

  public update(data: {
    name?: string;
    description?: string | null;
    settings?: LegacyProjectSettings;
    status?: ProjectStatus;
    syncInfo?: Partial<ProjectSyncInfo>;
  }): Partial<ProjectEntity> {
    const updates: any = {};
    
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = data.status;
    if (data.settings !== undefined) {
      updates.settings = { ...this.getTypedSettings(), ...data.settings } as JsonValue;
    }
    if (data.syncInfo !== undefined) {
      updates.syncInfo = this.updateSyncStatus(data.syncInfo);
    }

    return updates;
  }

  // Validation methods
  public validateSettings(): { isValid: boolean; errors: string[] } {
    try {
      const legacySettings = this.getTypedSettings();
      const errors: string[] = [];
      
      // Validate using the new ProjectSettings value object
      ProjectSettings.create(legacySettings);
      
      // Additional validation for URL-only repositories
      if (legacySettings.isUrlOnlyRepository) {
        if (!legacySettings.repositoryUrl) {
          errors.push('Repository URL is required for URL-only repositories');
        }
        if (legacySettings.repositoryPath) {
          errors.push('Repository path should not be set for URL-only repositories');
        }
      }
      
      // Validate GitHub CLI compatibility
      if (legacySettings.enableTemporaryCloning && legacySettings.repositoryUrl) {
        const url = legacySettings.repositoryUrl.toLowerCase();
        if (!url.includes('github.com') && !url.includes('github.enterprise')) {
          errors.push('Temporary cloning is currently only supported for GitHub repositories');
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Invalid settings']
      };
    }
  }

  // Serialization
  public toResponse(): {
    id: string;
    name: string;
    description: string | null;
    repositoryUrl?: string;
    repositoryPath?: string;
    settings: LegacyProjectSettings;
    syncInfo: ProjectSyncInfo;
    status: string;
    createdAt: string;
    updatedAt: string;
    isUrlOnlyRepository?: boolean;
    requiresTemporaryCloning?: boolean;
    canUseGitHubCli?: boolean;
  } {
    const settings = this.getTypedSettings();
    const syncInfo = this.getSyncInfo();
    
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repositoryUrl: settings.repositoryUrl,
      repositoryPath: settings.repositoryPath,
      settings,
      syncInfo,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isUrlOnlyRepository: this.isUrlOnlyRepository(),
      requiresTemporaryCloning: this.requiresTemporaryCloning(),
      canUseGitHubCli: this.canUseGitHubCli()
    };
  }
}

// Re-export types for convenience
export type { ProjectStatus, MemberRole } from '@prisma/client';
