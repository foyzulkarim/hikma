import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import simpleGit, { SimpleGit, LogResult, DiffResult } from 'simple-git';
import { BaseConnector } from './base-connector.js';
import {
  GitConnectorConfig,
  DataSourceType,
  ConnectorStatus,
  ConnectorCapabilities,
  ExtractedDocument,
  DocumentType,
  DocumentMetadata,
  GetDocumentsOptions,
  SyncType,
  SyncProgress,
  SyncError,
} from '@/core/types/connectors.js';
import { logger } from '@/core/utils/logger.js';
import { HashUtils } from '@/core/utils/crypto.js';

// Git connector implementation
export class GitConnector extends BaseConnector {
  private git: SimpleGit;
  private repositoryPath: string;
  private branch: string;
  private includePatterns: string[];
  private excludePatterns: string[];
  private maxFileSize: number;
  private followSymlinks: boolean;

  constructor(config: GitConnectorConfig) {
    super(config);
    
    this.repositoryPath = config.settings.repositoryPath;
    this.branch = config.settings.branch || 'main';
    this.includePatterns = config.settings.includePatterns || ['**/*'];
    this.excludePatterns = config.settings.excludePatterns || [
      'node_modules/**',
      '.git/**',
      '*.log',
      '*.tmp',
      'dist/**',
      'build/**',
      '.env*',
    ];
    this.maxFileSize = config.settings.maxFileSize || 1024 * 1024; // 1MB
    this.followSymlinks = config.settings.followSymlinks || false;

    this.git = simpleGit(this.repositoryPath);
  }

  get capabilities(): ConnectorCapabilities {
    return {
      supportsIncrementalSync: true,
      supportsRealTimeSync: false,
      supportsWebhooks: false,
      supportsBulkOperations: true,
      supportsFileContent: true,
      supportsMetadata: true,
      supportsRelationships: true,
      maxFileSize: this.maxFileSize,
      supportedFileTypes: [
        '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
        '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
        '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css',
        '.sql', '.sh', '.bat', '.ps1', '.dockerfile', '.gitignore',
      ],
      rateLimits: {
        requestsPerMinute: 1000, // Local operations, no real rate limits
        requestsPerHour: 60000,
        requestsPerDay: 1440000,
      },
    };
  }

  async connect(): Promise<void> {
    try {
      this.setStatus(ConnectorStatus.CONNECTING);

      // Check if repository exists
      const repoExists = await this.checkRepositoryExists();
      if (!repoExists) {
        throw new Error(`Repository not found at path: ${this.repositoryPath}`);
      }

      // Check if it's a valid git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error(`Path is not a valid git repository: ${this.repositoryPath}`);
      }

      // Check if branch exists
      const branches = await this.git.branch();
      const branchExists = branches.all.includes(this.branch) || 
                          branches.all.includes(`origin/${this.branch}`);
      
      if (!branchExists) {
        logger.warn({
          connectorId: this.id,
          branch: this.branch,
          availableBranches: branches.all,
        }, 'Specified branch not found, using current branch');
      } else {
        // Checkout the specified branch
        await this.git.checkout(this.branch);
      }

      this.setStatus(ConnectorStatus.CONNECTED);
      
      logger.info({
        connectorId: this.id,
        repositoryPath: this.repositoryPath,
        branch: this.branch,
      }, 'Git connector connected successfully');

    } catch (error) {
      this.setStatus(ConnectorStatus.ERROR);
      logger.error({
        connectorId: this.id,
        error,
      }, 'Failed to connect Git connector');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.setStatus(ConnectorStatus.DISCONNECTED);
    logger.info({
      connectorId: this.id,
    }, 'Git connector disconnected');
  }

  async testConnection(): Promise<boolean> {
    try {
      const repoExists = await this.checkRepositoryExists();
      if (!repoExists) return false;

      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) return false;

      // Try to get repository status
      await this.git.status();
      return true;
    } catch (error) {
      logger.error({
        connectorId: this.id,
        error,
      }, 'Git connection test failed');
      return false;
    }
  }

  async getDocuments(options?: GetDocumentsOptions): Promise<ExtractedDocument[]> {
    try {
      const documents: ExtractedDocument[] = [];

      // Get file documents
      if (!options?.types || options.types.includes(DocumentType.CODE_FILE)) {
        const fileDocuments = await this.getFileDocuments(options);
        documents.push(...fileDocuments);
      }

      // Get commit documents
      if (!options?.types || options.types.includes(DocumentType.COMMIT)) {
        const commitDocuments = await this.getCommitDocuments(options);
        documents.push(...commitDocuments);
      }

      // Apply filters
      return this.applyFilters(documents, options);
    } catch (error) {
      logger.error({
        connectorId: this.id,
        error,
      }, 'Failed to get documents from Git repository');
      throw error;
    }
  }

  async getDocument(id: string): Promise<ExtractedDocument | null> {
    try {
      // Try to find as file document first
      const fileDoc = await this.getFileDocument(id);
      if (fileDoc) return fileDoc;

      // Try to find as commit document
      const commitDoc = await this.getCommitDocument(id);
      if (commitDoc) return commitDoc;

      return null;
    } catch (error) {
      logger.error({
        connectorId: this.id,
        documentId: id,
        error,
      }, 'Failed to get document from Git repository');
      return null;
    }
  }

  protected async performSync(type: SyncType, progress: SyncProgress): Promise<ExtractedDocument[]> {
    try {
      const documents: ExtractedDocument[] = [];

      if (type === SyncType.FULL_SYNC || type === SyncType.REINDEX) {
        // Full sync: get all files and commits
        progress.currentStep = 'Fetching all files';
        const fileDocuments = await this.getFileDocuments();
        documents.push(...fileDocuments);

        progress.currentStep = 'Fetching commit history';
        const commitDocuments = await this.getCommitDocuments();
        documents.push(...commitDocuments);

      } else if (type === SyncType.INCREMENTAL_SYNC) {
        // Incremental sync: get changes since last sync
        const since = this._config.lastSyncAt;
        if (since) {
          progress.currentStep = 'Fetching recent changes';
          const recentDocuments = await this.getRecentChanges(since);
          documents.push(...recentDocuments);
        } else {
          // No previous sync, fall back to full sync
          return await this.performSync(SyncType.FULL_SYNC, progress);
        }
      }

      return documents;
    } catch (error) {
      const syncError: SyncError = {
        type: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during sync',
        details: error,
        timestamp: new Date(),
      };
      this.addSyncError(progress.id, syncError);
      throw error;
    }
  }

  protected async processDocuments(documents: ExtractedDocument[], type: SyncType): Promise<{
    added: number;
    updated: number;
    deleted: number;
  }> {
    // This would typically involve saving to database
    // For now, just return counts
    return {
      added: documents.length,
      updated: 0,
      deleted: 0,
    };
  }

  protected async validateTypeSpecificConfig(config: GitConnectorConfig): Promise<boolean> {
    try {
      // Check if repository path exists
      const stats = await fs.stat(config.settings.repositoryPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check if it's a git repository
      const git = simpleGit(config.settings.repositoryPath);
      const isRepo = await git.checkIsRepo();
      
      return isRepo;
    } catch (error) {
      return false;
    }
  }

  // Private helper methods
  private async checkRepositoryExists(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.repositoryPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  private async getFileDocuments(options?: GetDocumentsOptions): Promise<ExtractedDocument[]> {
    const documents: ExtractedDocument[] = [];
    const files = await this.getTrackedFiles();

    for (const filePath of files) {
      try {
        const document = await this.createFileDocument(filePath);
        if (document) {
          documents.push(document);
        }
      } catch (error) {
        logger.warn({
          connectorId: this.id,
          filePath,
          error,
        }, 'Failed to process file');
      }
    }

    return documents;
  }

  private async getCommitDocuments(options?: GetDocumentsOptions): Promise<ExtractedDocument[]> {
    const documents: ExtractedDocument[] = [];
    
    try {
      const logOptions: any = {
        maxCount: options?.limit || 1000,
      };

      if (options?.since) {
        logOptions.from = options.since.toISOString();
      }

      if (options?.until) {
        logOptions.to = options.until.toISOString();
      }

      const log: LogResult = await this.git.log(logOptions);

      for (const commit of log.all) {
        try {
          const document = await this.createCommitDocument(commit);
          if (document) {
            documents.push(document);
          }
        } catch (error) {
          logger.warn({
            connectorId: this.id,
            commitHash: commit.hash,
            error,
          }, 'Failed to process commit');
        }
      }
    } catch (error) {
      logger.error({
        connectorId: this.id,
        error,
      }, 'Failed to get commit history');
    }

    return documents;
  }

  private async getTrackedFiles(): Promise<string[]> {
    try {
      const result = await this.git.raw(['ls-tree', '-r', '--name-only', 'HEAD']);
      const files = result.trim().split('\n').filter(file => file.length > 0);
      
      return files.filter(file => this.shouldIncludeFile(file));
    } catch (error) {
      logger.error({
        connectorId: this.id,
        error,
      }, 'Failed to get tracked files');
      return [];
    }
  }

  private shouldIncludeFile(filePath: string): boolean {
    // Check exclude patterns first
    for (const pattern of this.excludePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of this.includePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    return new RegExp(`^${regex}$`).test(filePath);
  }

  private async createFileDocument(filePath: string): Promise<ExtractedDocument | null> {
    try {
      const fullPath = path.join(this.repositoryPath, filePath);
      const stats = await fs.stat(fullPath);

      // Check file size
      if (stats.size > this.maxFileSize) {
        logger.debug({
          connectorId: this.id,
          filePath,
          size: stats.size,
          maxSize: this.maxFileSize,
        }, 'File too large, skipping');
        return null;
      }

      // Read file content
      const content = await fs.readFile(fullPath, 'utf-8');
      const hash = HashUtils.sha256(content);

      // Get file metadata from git
      const log = await this.git.log({ file: filePath, maxCount: 1 });
      const lastCommit = log.latest;

      const metadata: DocumentMetadata = {
        source: DataSourceType.GIT,
        sourceId: this.id,
        path: filePath,
        language: this.detectLanguage(filePath),
        fileExtension: path.extname(filePath),
        lineCount: content.split('\n').length,
        author: lastCommit?.author_name,
        authorEmail: lastCommit?.author_email,
      };

      const document: ExtractedDocument = {
        id: `git:${this.id}:file:${filePath}`,
        externalId: filePath,
        title: path.basename(filePath),
        content,
        type: DocumentType.CODE_FILE,
        metadata,
        hash,
        size: stats.size,
        createdAt: lastCommit ? new Date(lastCommit.date) : stats.birthtime,
        updatedAt: lastCommit ? new Date(lastCommit.date) : stats.mtime,
      };

      return document;
    } catch (error) {
      logger.error({
        connectorId: this.id,
        filePath,
        error,
      }, 'Failed to create file document');
      return null;
    }
  }

  private async createCommitDocument(commit: any): Promise<ExtractedDocument | null> {
    try {
      const content = `${commit.message}\n\nAuthor: ${commit.author_name} <${commit.author_email}>\nDate: ${commit.date}`;
      const hash = HashUtils.sha256(content);

      // Get commit diff
      let diffContent = '';
      try {
        const diff: DiffResult = await this.git.diff([`${commit.hash}^`, commit.hash]);
        diffContent = diff;
      } catch (error) {
        // Ignore diff errors for initial commit
      }

      const metadata: DocumentMetadata = {
        source: DataSourceType.GIT,
        sourceId: this.id,
        author: commit.author_name,
        authorEmail: commit.author_email,
        customFields: {
          hash: commit.hash,
          parentHashes: commit.refs ? commit.refs.split(', ') : [],
          diff: diffContent,
        },
      };

      const document: ExtractedDocument = {
        id: `git:${this.id}:commit:${commit.hash}`,
        externalId: commit.hash,
        title: commit.message.split('\n')[0], // First line as title
        content,
        type: DocumentType.COMMIT,
        metadata,
        hash,
        size: content.length,
        createdAt: new Date(commit.date),
        updatedAt: new Date(commit.date),
      };

      return document;
    } catch (error) {
      logger.error({
        connectorId: this.id,
        commitHash: commit.hash,
        error,
      }, 'Failed to create commit document');
      return null;
    }
  }

  private async getFileDocument(id: string): Promise<ExtractedDocument | null> {
    // Extract file path from ID
    const match = id.match(/^git:.+:file:(.+)$/);
    if (!match) return null;

    const filePath = match[1];
    return await this.createFileDocument(filePath);
  }

  private async getCommitDocument(id: string): Promise<ExtractedDocument | null> {
    // Extract commit hash from ID
    const match = id.match(/^git:.+:commit:(.+)$/);
    if (!match) return null;

    const commitHash = match[1];
    
    try {
      const log = await this.git.log({ from: commitHash, maxCount: 1 });
      const commit = log.all.find(c => c.hash === commitHash);
      
      if (!commit) return null;
      
      return await this.createCommitDocument(commit);
    } catch (error) {
      return null;
    }
  }

  private async getRecentChanges(since: Date): Promise<ExtractedDocument[]> {
    const documents: ExtractedDocument[] = [];

    try {
      // Get recent commits
      const log = await this.git.log({
        from: since.toISOString(),
      });

      for (const commit of log.all) {
        // Add commit document
        const commitDoc = await this.createCommitDocument(commit);
        if (commitDoc) {
          documents.push(commitDoc);
        }

        // Get files changed in this commit
        try {
          const diff = await this.git.diff([`${commit.hash}^`, commit.hash, '--name-only']);
          const changedFiles = diff.trim().split('\n').filter(file => file.length > 0);

          for (const filePath of changedFiles) {
            if (this.shouldIncludeFile(filePath)) {
              const fileDoc = await this.createFileDocument(filePath);
              if (fileDoc) {
                documents.push(fileDoc);
              }
            }
          }
        } catch (error) {
          // Ignore diff errors
        }
      }
    } catch (error) {
      logger.error({
        connectorId: this.id,
        since,
        error,
      }, 'Failed to get recent changes');
    }

    return documents;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.sql': 'sql',
      '.sh': 'bash',
      '.bat': 'batch',
      '.ps1': 'powershell',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
    };

    return languageMap[ext] || 'text';
  }

  private applyFilters(documents: ExtractedDocument[], options?: GetDocumentsOptions): ExtractedDocument[] {
    let filtered = documents;

    if (options?.since) {
      filtered = filtered.filter(doc => doc.updatedAt >= options.since!);
    }

    if (options?.until) {
      filtered = filtered.filter(doc => doc.updatedAt <= options.until!);
    }

    if (options?.types && options.types.length > 0) {
      filtered = filtered.filter(doc => options.types!.includes(doc.type));
    }

    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }
}

export { GitConnector };

