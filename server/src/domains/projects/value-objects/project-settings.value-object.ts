import { RepositoryUrl } from './repository-url.value-object';

export interface ProjectSettingsData {
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

export class ProjectSettings {
  private readonly _repositoryUrl?: RepositoryUrl;
  private readonly _repositoryPath?: string;
  private readonly _branch: string;
  private readonly _includePatterns: string[];
  private readonly _excludePatterns: string[];
  private readonly _maxFileSize: number;
  private readonly _enableAutoSync: boolean;
  private readonly _syncInterval: number;
  private readonly _followSymlinks: boolean;

  constructor(data: ProjectSettingsData = {}) {
    this.validate(data);
    
    this._repositoryUrl = data.repositoryUrl ? new RepositoryUrl(data.repositoryUrl) : undefined;
    this._repositoryPath = data.repositoryPath;
    this._branch = data.branch || 'main';
    this._includePatterns = data.includePatterns || ['**/*'];
    this._excludePatterns = data.excludePatterns || [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',
      '**/coverage/**',
      '**/*.log',
      '**/.DS_Store',
      '**/Thumbs.db'
    ];
    this._maxFileSize = data.maxFileSize || 1048576; // 1MB default
    this._enableAutoSync = data.enableAutoSync ?? true;
    this._syncInterval = data.syncInterval || 3600; // 1 hour default
    this._followSymlinks = data.followSymlinks ?? false;
  }

  private validate(data: ProjectSettingsData): void {
    // Validate that at least one repository source is provided
    if (!data.repositoryUrl && !data.repositoryPath) {
      throw new Error('Either repository URL or repository path must be provided');
    }

    // Validate repository path if provided
    if (data.repositoryPath) {
      if (typeof data.repositoryPath !== 'string') {
        throw new Error('Repository path must be a string');
      }
      if (data.repositoryPath.trim().length === 0) {
        throw new Error('Repository path cannot be empty');
      }
      if (data.repositoryPath.length > 1024) {
        throw new Error('Repository path is too long (maximum 1024 characters)');
      }
    }

    // Validate branch
    if (data.branch !== undefined) {
      if (typeof data.branch !== 'string') {
        throw new Error('Branch must be a string');
      }
      if (data.branch.trim().length === 0) {
        throw new Error('Branch cannot be empty');
      }
      if (data.branch.length > 255) {
        throw new Error('Branch name is too long (maximum 255 characters)');
      }
      // Basic Git branch name validation
      const invalidChars = /[\s~^:?*\[\\]/;
      if (invalidChars.test(data.branch)) {
        throw new Error('Branch name contains invalid characters');
      }
    }

    // Validate include patterns
    if (data.includePatterns !== undefined) {
      if (!Array.isArray(data.includePatterns)) {
        throw new Error('Include patterns must be an array');
      }
      if (data.includePatterns.length > 100) {
        throw new Error('Too many include patterns (maximum 100)');
      }
      data.includePatterns.forEach((pattern, index) => {
        if (typeof pattern !== 'string') {
          throw new Error(`Include pattern at index ${index} must be a string`);
        }
        if (pattern.length > 255) {
          throw new Error(`Include pattern at index ${index} is too long (maximum 255 characters)`);
        }
      });
    }

    // Validate exclude patterns
    if (data.excludePatterns !== undefined) {
      if (!Array.isArray(data.excludePatterns)) {
        throw new Error('Exclude patterns must be an array');
      }
      if (data.excludePatterns.length > 100) {
        throw new Error('Too many exclude patterns (maximum 100)');
      }
      data.excludePatterns.forEach((pattern, index) => {
        if (typeof pattern !== 'string') {
          throw new Error(`Exclude pattern at index ${index} must be a string`);
        }
        if (pattern.length > 255) {
          throw new Error(`Exclude pattern at index ${index} is too long (maximum 255 characters)`);
        }
      });
    }

    // Validate max file size
    if (data.maxFileSize !== undefined) {
      if (typeof data.maxFileSize !== 'number') {
        throw new Error('Max file size must be a number');
      }
      if (data.maxFileSize < 0) {
        throw new Error('Max file size must be positive');
      }
      if (data.maxFileSize > 104857600) { // 100MB
        throw new Error('Max file size is too large (maximum 100MB)');
      }
    }

    // Validate enable auto sync
    if (data.enableAutoSync !== undefined && typeof data.enableAutoSync !== 'boolean') {
      throw new Error('Enable auto sync must be a boolean');
    }

    // Validate sync interval
    if (data.syncInterval !== undefined) {
      if (typeof data.syncInterval !== 'number') {
        throw new Error('Sync interval must be a number');
      }
      if (data.syncInterval < 60) {
        throw new Error('Sync interval must be at least 60 seconds');
      }
      if (data.syncInterval > 86400) { // 24 hours
        throw new Error('Sync interval cannot exceed 24 hours');
      }
    }

    // Validate follow symlinks
    if (data.followSymlinks !== undefined && typeof data.followSymlinks !== 'boolean') {
      throw new Error('Follow symlinks must be a boolean');
    }
  }

  // Getters
  public get repositoryUrl(): RepositoryUrl | undefined {
    return this._repositoryUrl;
  }

  public get repositoryPath(): string | undefined {
    return this._repositoryPath;
  }

  public get branch(): string {
    return this._branch;
  }

  public get includePatterns(): string[] {
    return [...this._includePatterns];
  }

  public get excludePatterns(): string[] {
    return [...this._excludePatterns];
  }

  public get maxFileSize(): number {
    return this._maxFileSize;
  }

  public get enableAutoSync(): boolean {
    return this._enableAutoSync;
  }

  public get syncInterval(): number {
    return this._syncInterval;
  }

  public get followSymlinks(): boolean {
    return this._followSymlinks;
  }

  // Domain methods
  public hasRepository(): boolean {
    return !!(this._repositoryUrl || this._repositoryPath);
  }

  public hasRemoteRepository(): boolean {
    return !!this._repositoryUrl;
  }

  public hasLocalRepository(): boolean {
    return !!this._repositoryPath;
  }

  public canAutoSync(): boolean {
    return this._enableAutoSync && this.hasRepository();
  }

  public getRepositoryInfo(): { url?: string; path?: string; branch: string } {
    return {
      url: this._repositoryUrl?.value,
      path: this._repositoryPath,
      branch: this._branch
    };
  }

  // Factory methods
  public static create(data: ProjectSettingsData = {}): ProjectSettings {
    return new ProjectSettings(data);
  }

  public static createDefault(): ProjectSettings {
    return new ProjectSettings({
      branch: 'main',
      includePatterns: ['**/*'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**'
      ],
      maxFileSize: 1048576,
      enableAutoSync: true,
      syncInterval: 3600,
      followSymlinks: false
    });
  }

  public static isValid(data: ProjectSettingsData): boolean {
    try {
      new ProjectSettings(data);
      return true;
    } catch {
      return false;
    }
  }

  // Update methods
  public withRepositoryUrl(url: string): ProjectSettings {
    return new ProjectSettings({
      ...this.toPlainObject(),
      repositoryUrl: url
    });
  }

  public withRepositoryPath(path: string): ProjectSettings {
    return new ProjectSettings({
      ...this.toPlainObject(),
      repositoryPath: path
    });
  }

  public withBranch(branch: string): ProjectSettings {
    return new ProjectSettings({
      ...this.toPlainObject(),
      branch
    });
  }

  public withAutoSync(enabled: boolean): ProjectSettings {
    return new ProjectSettings({
      ...this.toPlainObject(),
      enableAutoSync: enabled
    });
  }

  // Serialization
  public toPlainObject(): ProjectSettingsData {
    return {
      repositoryUrl: this._repositoryUrl?.value,
      repositoryPath: this._repositoryPath,
      branch: this._branch,
      includePatterns: [...this._includePatterns],
      excludePatterns: [...this._excludePatterns],
      maxFileSize: this._maxFileSize,
      enableAutoSync: this._enableAutoSync,
      syncInterval: this._syncInterval,
      followSymlinks: this._followSymlinks
    };
  }

  public toJSON(): ProjectSettingsData {
    return this.toPlainObject();
  }

  public equals(other: ProjectSettings): boolean {
    return JSON.stringify(this.toPlainObject()) === JSON.stringify(other.toPlainObject());
  }
}