import { JsonValue } from '@prisma/client/runtime/library';
import { ProjectStatus, MemberRole } from '@prisma/client';

export interface ProjectSettings {
  repositoryUrl?: string;
  repositoryPath?: string;
  branch?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  enableAutoSync?: boolean;
  syncInterval?: number;
  followSymlinks?: boolean;
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

  public getTypedSettings(): ProjectSettings {
    return (this.settings as any) || {};
  }

  public getRepositoryInfo(): { url?: string; path?: string; branch?: string } {
    const settings = this.getTypedSettings();
    return {
      url: settings.repositoryUrl,
      path: settings.repositoryPath,
      branch: settings.branch || 'main'
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
    settings?: ProjectSettings;
  }): {
    name: string;
    slug: string;
    description: string | null;
    status: ProjectStatus;
    settings: JsonValue;
  } {
    return {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      status: 'ACTIVE' as ProjectStatus,
      settings: (data.settings || {}) as JsonValue
    };
  }

  public update(data: {
    name?: string;
    description?: string | null;
    settings?: ProjectSettings;
    status?: ProjectStatus;
  }): Partial<ProjectEntity> {
    const updates: any = {};
    
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = data.status;
    if (data.settings !== undefined) {
      updates.settings = { ...this.getTypedSettings(), ...data.settings } as JsonValue;
    }

    return updates;
  }

  // Validation methods
  public validateSettings(): { isValid: boolean; errors: string[] } {
    const settings = this.getTypedSettings();
    const errors: string[] = [];

    if (settings.repositoryUrl && !this.isValidUrl(settings.repositoryUrl)) {
      errors.push('Invalid repository URL format');
    }

    if (settings.maxFileSize && settings.maxFileSize < 0) {
      errors.push('Max file size must be positive');
    }

    if (settings.syncInterval && settings.syncInterval < 60) {
      errors.push('Sync interval must be at least 60 seconds');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Serialization
  public toResponse(): {
    id: string;
    name: string;
    description: string | null;
    repositoryUrl?: string;
    repositoryPath?: string;
    settings: ProjectSettings;
    status: string;
    createdAt: string;
    updatedAt: string;
  } {
    const settings = this.getTypedSettings();
    
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repositoryUrl: settings.repositoryUrl,
      repositoryPath: settings.repositoryPath,
      settings,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}

// Re-export types for convenience
export type { ProjectStatus, MemberRole } from '@prisma/client';
