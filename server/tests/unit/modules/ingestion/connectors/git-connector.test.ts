import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitConnector } from '@/modules/ingestion/connectors/git-connector.js';
import { GitConnectorConfig, DataSourceType, ConnectorStatus, SyncType, DocumentType } from '@/core/types/connectors.js';
import { logger } from '@/core/utils/logger.js';
import simpleGit, { SimpleGit, LogResult, DiffResult } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';

// Mock external dependencies
vi.mock('simple-git', () => {
  const mockLogResult: LogResult = {
    all: [
      { hash: 'commit1', date: '2023-01-01', message: 'feat: initial commit', author_name: 'John Doe', author_email: 'john@example.com', refs: '', body: '', raw: '' },
      { hash: 'commit2', date: '2023-01-02', message: 'fix: bugfix', author_name: 'Jane Doe', author_email: 'jane@example.com', refs: '', body: '', raw: '' },
    ],
    latest: {
      hash: 'commit1', date: '2023-01-01', message: 'feat: initial commit', author_name: 'John Doe', author_email: 'john@example.com', refs: '', body: '', raw: ''
    },
    total: 2,
  };

  const mockSimpleGit = {
    checkIsRepo: vi.fn(() => Promise.resolve(true)),
    status: vi.fn(() => Promise.resolve({})),
    branch: vi.fn(() => Promise.resolve({ all: ['main', 'develop'], current: 'main' })),
    checkout: vi.fn(() => Promise.resolve()),
    log: vi.fn(() => Promise.resolve(mockLogResult)),
    raw: vi.fn(() => Promise.resolve('file1.txt\nfile2.js\nexcluded.log\n')), // Mock for ls-tree
    diff: vi.fn(() => Promise.resolve('diff content')),
  };
  return { default: vi.fn(() => mockSimpleGit), __esModule: true };
});

vi.mock('fs', async (importOriginal) => {
  const actualFs = await importOriginal();
  return {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      stat: vi.fn((path) => {
        if (path.includes('nonexistent')) {
          throw new Error('File not found');
        }
        return Promise.resolve({
          isDirectory: () => !path.includes('.'), // Simple check for directory
          size: path.includes('too_large') ? 2 * 1024 * 1024 : 100, // 2MB or 100B
          birthtime: new Date(),
          mtime: new Date(),
        });
      }),
      readFile: vi.fn((path) => {
        if (path.includes('file1.txt')) return Promise.resolve('Content of file1.txt');
        if (path.includes('file2.js')) return Promise.resolve('console.log(\'hello\');');
        return Promise.resolve('');
      }),
    },
  };
});

vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/core/utils/crypto.js', () => ({
  HashUtils: {
    sha256: vi.fn((content) => `mock-hash-${content}`),
  },
}));

describe('GitConnector', () => {
  let connector: GitConnector;
  let mockSimpleGit: SimpleGit;

  const mockConfig: GitConnectorConfig = {
    id: 'git-connector-1',
    name: 'Test Git Repo',
    type: DataSourceType.GIT,
    projectId: 'project-123',
    enabled: true,
    settings: {
      repositoryPath: '/mock/repo',
      branch: 'main',
      includePatterns: ['**/*.txt', '**/*.js'],
      excludePatterns: ['excluded.log'],
      maxFileSize: 1024 * 1024, // 1MB
    },
  };

  beforeEach(() => {
    connector = new GitConnector(mockConfig);
    mockSimpleGit = simpleGit(mockConfig.settings.repositoryPath);
    vi.clearAllMocks();
  });

  it('should initialize with correct properties', () => {
    expect(connector.id).toBe(mockConfig.id);
    expect(connector.type).toBe(mockConfig.type);
    expect(connector.config).toEqual(mockConfig);
    expect(connector.getStatus()).toBe(ConnectorStatus.IDLE);
  });

  describe('connect', () => {
    it('should connect successfully if repo is valid', async () => {
      await connector.connect();
      expect(connector.getStatus()).toBe(ConnectorStatus.CONNECTED);
      expect(mockSimpleGit.checkIsRepo).toHaveBeenCalled();
      expect(mockSimpleGit.checkout).toHaveBeenCalledWith('main');
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ connectorId: connector.id }), 'Git connector connected successfully');
    });

    it('should throw error if repository path does not exist', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValueOnce(new Error('Path not found'));
      await expect(connector.connect()).rejects.toThrow('Repository not found');
      expect(connector.getStatus()).toBe(ConnectorStatus.ERROR);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw error if path is not a git repository', async () => {
      (mockSimpleGit.checkIsRepo as vi.Mock).mockResolvedValueOnce(false);
      await expect(connector.connect()).rejects.toThrow('Path is not a valid git repository');
      expect(connector.getStatus()).toBe(ConnectorStatus.ERROR);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should warn and use current branch if specified branch not found', async () => {
      (mockSimpleGit.branch as vi.Mock).mockResolvedValueOnce({ all: ['develop'], current: 'develop' });
      await connector.connect();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ branch: 'main' }), 'Specified branch not found, using current branch');
      expect(mockSimpleGit.checkout).not.toHaveBeenCalledWith('main'); // Should not try to checkout non-existent branch
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await connector.disconnect();
      expect(connector.getStatus()).toBe(ConnectorStatus.DISCONNECTED);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ connectorId: connector.id }), 'Git connector disconnected');
    });
  });

  describe('testConnection', () => {
    it('should return true for a valid connection', async () => {
      const result = await connector.testConnection();
      expect(result).toBe(true);
      expect(mockSimpleGit.checkIsRepo).toHaveBeenCalled();
      expect(mockSimpleGit.status).toHaveBeenCalled();
    });

    it('should return false if repository path does not exist', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValueOnce(new Error('Path not found'));
      const result = await connector.testConnection();
      expect(result).toBe(false);
    });

    it('should return false if path is not a git repository', async () => {
      (mockSimpleGit.checkIsRepo as vi.Mock).mockResolvedValueOnce(false);
      const result = await connector.testConnection();
      expect(result).toBe(false);
    });

    it('should return false if git status fails', async () => {
      (mockSimpleGit.status as vi.Mock).mockRejectedValueOnce(new Error('Git error'));
      const result = await connector.testConnection();
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getDocuments', () => {
    it('should return file and commit documents by default', async () => {
      const documents = await connector.getDocuments();
      expect(documents).toHaveLength(3); // 2 files + 1 commit
      expect(documents.some(doc => doc.type === DocumentType.CODE_FILE)).toBe(true);
      expect(documents.some(doc => doc.type === DocumentType.COMMIT)).toBe(true);
    });

    it('should return only file documents if specified', async () => {
      const documents = await connector.getDocuments({ types: [DocumentType.CODE_FILE] });
      expect(documents).toHaveLength(2);
      expect(documents.every(doc => doc.type === DocumentType.CODE_FILE)).toBe(true);
    });

    it('should return only commit documents if specified', async () => {
      const documents = await connector.getDocuments({ types: [DocumentType.COMMIT] });
      expect(documents).toHaveLength(1);
      expect(documents.every(doc => doc.type === DocumentType.COMMIT)).toBe(true);
    });

    it('should filter out excluded files', async () => {
      // Mock raw to include an excluded file
      (mockSimpleGit.raw as vi.Mock).mockResolvedValueOnce('file1.txt\nfile2.js\nexcluded.log\n');
      const documents = await connector.getDocuments({ types: [DocumentType.CODE_FILE] });
      expect(documents).toHaveLength(2); // excluded.log should not be included
      expect(documents.some(doc => doc.title === 'excluded.log')).toBe(false);
    });

    it('should skip files larger than maxFileSize', async () => {
      (mockSimpleGit.raw as vi.Mock).mockResolvedValueOnce('file1.txt\ntoo_large_file.js\n');
      vi.spyOn(fs.promises, 'stat').mockImplementation((filePath) => {
        if (filePath.includes('too_large_file.js')) {
          return Promise.resolve({ isDirectory: () => false, size: 2 * 1024 * 1024, birthtime: new Date(), mtime: new Date() }) as any;
        }
        return Promise.resolve({ isDirectory: () => false, size: 100, birthtime: new Date(), mtime: new Date() }) as any;
      });
      const documents = await connector.getDocuments({ types: [DocumentType.CODE_FILE] });
      expect(documents).toHaveLength(1); // Only file1.txt should be included
      expect(documents[0].title).toBe('file1.txt');
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'too_large_file.js' }), 'File too large, skipping');
    });
  });

  describe('getDocument', () => {
    it('should return a file document by ID', async () => {
      const docId = `git:${mockConfig.id}:file:file1.txt`;
      const document = await connector.getDocument(docId);
      expect(document).toBeDefined();
      expect(document?.id).toBe(docId);
      expect(document?.type).toBe(DocumentType.CODE_FILE);
    });

    it('should return a commit document by ID', async () => {
      const docId = `git:${mockConfig.id}:commit:commit1`;
      const document = await connector.getDocument(docId);
      expect(document).toBeDefined();
      expect(document?.id).toBe(docId);
      expect(document?.type).toBe(DocumentType.COMMIT);
    });

    it('should return null for a non-existent document ID', async () => {
      const document = await connector.getDocument('non-existent-id');
      expect(document).toBeNull();
    });
  });

  describe('sync', () => {
    it('should perform a full sync successfully', async () => {
      const result = await connector.sync(SyncType.FULL_SYNC);
      expect(result.success).toBe(true);
      expect(result.documentsProcessed).toBe(3); // 2 files + 1 commit
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ syncId: 'mock-sync-id' }), 'Sync completed successfully');
    });

    it('should perform an incremental sync successfully', async () => {
      // Simulate a previous sync
      connector.config.lastSyncAt = new Date('2023-01-01T12:00:00Z');
      (mockSimpleGit.log as vi.Mock).mockResolvedValueOnce({
        all: [
          { hash: 'commit3', date: '2023-01-03', message: 'feat: new feature', author_name: 'John Doe', author_email: 'john@example.com', refs: '', body: '', raw: '' },
        ],
        latest: null,
        total: 1,
      });
      (mockSimpleGit.diff as vi.Mock).mockResolvedValueOnce('file3.txt\n');
      vi.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('Content of file3.txt');

      const result = await connector.sync(SyncType.INCREMENTAL_SYNC);
      expect(result.success).toBe(true);
      expect(result.documentsProcessed).toBe(2); // 1 new commit + 1 new file
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ syncId: 'mock-sync-id' }), 'Sync completed successfully');
    });

    it('should fall back to full sync if no lastSyncAt for incremental', async () => {
      connector.config.lastSyncAt = null; // No previous sync
      const result = await connector.sync(SyncType.INCREMENTAL_SYNC);
      expect(result.success).toBe(true);
      expect(result.documentsProcessed).toBe(3); // Should perform full sync
    });

    it('should handle sync failure gracefully', async () => {
      (mockSimpleGit.raw as vi.Mock).mockRejectedValueOnce(new Error('Git command failed'));
      await expect(connector.sync(SyncType.FULL_SYNC)).rejects.toThrow('Git command failed');
      expect(connector.getStatus()).toBe(ConnectorStatus.ERROR);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ syncId: 'mock-sync-id' }), 'Sync failed');
    });
  });

  describe('validateTypeSpecificConfig', () => {
    it('should return true for a valid git repository path', async () => {
      const result = await connector.validateTypeSpecificConfig(mockConfig);
      expect(result).toBe(true);
    });

    it('should return false if repository path does not exist', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValueOnce(new Error('Path not found'));
      const result = await connector.validateTypeSpecificConfig(mockConfig);
      expect(result).toBe(false);
    });

    it('should return false if path is not a directory', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({ isDirectory: () => false } as any);
      const result = await connector.validateTypeSpecificConfig(mockConfig);
      expect(result).toBe(false);
    });

    it('should return false if path is not a git repository', async () => {
      (mockSimpleGit.checkIsRepo as vi.Mock).mockResolvedValueOnce(false);
      const result = await connector.validateTypeSpecificConfig(mockConfig);
      expect(result).toBe(false);
    });
  });
});


