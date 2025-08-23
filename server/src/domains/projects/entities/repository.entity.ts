export interface RepositoryMetadata {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  lastCommitHash?: string;
  lastCommitDate?: Date;
  branches: string[];
  defaultBranch: string;
}

export class RepositoryEntity {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly url: string,
    public readonly path: string,
    public readonly branch: string,
    public readonly metadata: RepositoryMetadata,
    public readonly lastSyncAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Domain methods
  public needsSync(intervalMinutes: number = 60): boolean {
    if (!this.lastSyncAt) return true;
    
    const now = new Date();
    const timeDiff = now.getTime() - this.lastSyncAt.getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    
    return minutesDiff >= intervalMinutes;
  }

  public isGitRepository(): boolean {
    return this.url.includes('.git') || this.path.includes('.git');
  }

  public getRepositoryType(): 'git' | 'local' | 'unknown' {
    if (this.url.startsWith('http') || this.url.startsWith('git@')) {
      return 'git';
    } else if (this.path) {
      return 'local';
    }
    return 'unknown';
  }

  public getPrimaryLanguage(): string | null {
    const languages = this.metadata.languages;
    if (!languages || Object.keys(languages).length === 0) {
      return null;
    }

    return Object.entries(languages)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  public getLanguageStats(): Array<{ language: string; percentage: number; lines: number }> {
    const languages = this.metadata.languages;
    if (!languages) return [];

    const total = Object.values(languages).reduce((sum, lines) => sum + lines, 0);
    
    return Object.entries(languages)
      .map(([language, lines]) => ({
        language,
        lines,
        percentage: total > 0 ? (lines / total) * 100 : 0
      }))
      .sort((a, b) => b.lines - a.lines);
  }

  public updateMetadata(metadata: Partial<RepositoryMetadata>): Partial<RepositoryEntity> {
    return {
      metadata: { ...this.metadata, ...metadata },
      updatedAt: new Date()
    };
  }

  public markSynced(): Partial<RepositoryEntity> {
    return {
      lastSyncAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Factory methods
  public static create(data: {
    projectId: string;
    url: string;
    path: string;
    branch?: string;
  }): {
    projectId: string;
    url: string;
    path: string;
    branch: string;
    metadata: RepositoryMetadata;
    lastSyncAt: null;
  } {
    return {
      projectId: data.projectId,
      url: data.url,
      path: data.path,
      branch: data.branch || 'main',
      metadata: {
        totalFiles: 0,
        totalLines: 0,
        languages: {},
        branches: [data.branch || 'main'],
        defaultBranch: data.branch || 'main'
      },
      lastSyncAt: null
    };
  }

  // Validation
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.url && !this.path) {
      errors.push('Either URL or path must be provided');
    }

    if (this.url && !this.isValidUrl(this.url)) {
      errors.push('Invalid repository URL format');
    }

    if (!this.branch) {
      errors.push('Branch is required');
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
      // Check for git SSH format
      return /^git@[\w.-]+:[\w.-]+\/[\w.-]+\.git$/.test(url);
    }
  }

  // Serialization
  public toResponse(): {
    id: string;
    projectId: string;
    url: string;
    path: string;
    branch: string;
    metadata: RepositoryMetadata;
    lastSyncAt: string | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      projectId: this.projectId,
      url: this.url,
      path: this.path,
      branch: this.branch,
      metadata: this.metadata,
      lastSyncAt: this.lastSyncAt?.toISOString() || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
