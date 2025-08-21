import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseConnector } from '@/modules/ingestion/connectors/base-connector.js';
import { ConnectorConfig, DataSourceType, ConnectorStatus, ConnectorHealth, ConnectorMetrics, ConnectorCapabilities, SyncType, ExtractedDocument, GetDocumentsOptions, SearchOptions, ConnectorEvent, SyncProgress, SyncResult, SyncError } from '@/core/types/connectors.js';
import { logger } from '@/core/utils/logger.js';
import { SecureRandomUtils } from '@/core/utils/crypto.js';

// Mock logger and SecureRandomUtils
vi.mock('@/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/core/utils/crypto.js', () => ({
  SecureRandomUtils: {
    generateId: vi.fn(() => 'mock-sync-id'),
  },
}));

// Mock implementation of a concrete connector for testing BaseConnector
class MockConnector extends BaseConnector {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  get capabilities(): ConnectorCapabilities {
    return {
      canSync: true,
      canSearch: true,
      canUpdateConfig: true,
      canTestConnection: true,
      canGetDocuments: true,
      canGetDocument: true,
    };
  }

  async connect(): Promise<void> {
    this.setStatus(ConnectorStatus.CONNECTED);
    logger.info('MockConnector connected');
  }

  async disconnect(): Promise<void> {
    this.setStatus(ConnectorStatus.DISCONNECTED);
    logger.info('MockConnector disconnected');
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async getDocuments(options?: GetDocumentsOptions): Promise<ExtractedDocument[]> {
    return [
      { id: 'doc1', content: 'This is document 1', title: 'Doc 1', type: 'text', source: 'mock', metadata: {} },
      { id: 'doc2', content: 'This is document 2', title: 'Doc 2', type: 'text', source: 'mock', metadata: {} },
    ];
  }

  async getDocument(id: string): Promise<ExtractedDocument | null> {
    if (id === 'doc1') {
      return { id: 'doc1', content: 'This is document 1', title: 'Doc 1', type: 'text', source: 'mock', metadata: {} };
    }
    return null;
  }

  protected async performSync(type: SyncType, progress: SyncProgress): Promise<ExtractedDocument[]> {
    // Simulate fetching documents
    return this.getDocuments();
  }

  protected async processDocuments(documents: ExtractedDocument[], type: SyncType): Promise<{ added: number; updated: number; deleted: number; }> {
    // Simulate processing documents
    return { added: documents.length, updated: 0, deleted: 0 };
  }

  protected async validateTypeSpecificConfig(config: ConnectorConfig): Promise<boolean> {
    return true;
  }
}

describe('BaseConnector', () => {
  let connector: MockConnector;
  const mockConfig: ConnectorConfig = {
    id: 'test-connector-id',
    name: 'Test Connector',
    type: DataSourceType.GIT,
    projectId: 'test-project-id',
    config: {},
    enabled: true,
    lastSyncAt: null,
  };

  beforeEach(() => {
    connector = new MockConnector(mockConfig);
    vi.clearAllMocks();
  });

  it('should initialize with correct properties', () => {
    expect(connector.id).toBe(mockConfig.id);
    expect(connector.type).toBe(mockConfig.type);
    expect(connector.config).toEqual(mockConfig);
    expect(connector.getStatus()).toBe(ConnectorStatus.IDLE);
  });

  it('should connect and disconnect', async () => {
    await connector.connect();
    expect(connector.getStatus()).toBe(ConnectorStatus.CONNECTED);
    expect(logger.info).toHaveBeenCalledWith('MockConnector connected');

    await connector.disconnect();
    expect(connector.getStatus()).toBe(ConnectorStatus.DISCONNECTED);
    expect(logger.info).toHaveBeenCalledWith('MockConnector disconnected');
  });

  it('should test connection', async () => {
    const isConnected = await connector.testConnection();
    expect(isConnected).toBe(true);
  });

  it('should get documents', async () => {
    const documents = await connector.getDocuments();
    expect(documents).toHaveLength(2);
    expect(documents[0].id).toBe('doc1');
  });

  it('should get a single document by ID', async () => {
    const document = await connector.getDocument('doc1');
    expect(document).toBeDefined();
    expect(document?.id).toBe('doc1');

    const nullDocument = await connector.getDocument('non-existent');
    expect(nullDocument).toBeNull();
  });

  it('should perform basic search on documents', async () => {
    const results = await connector.searchDocuments('document 1');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc1');

    const allResults = await connector.searchDocuments('document');
    expect(allResults).toHaveLength(2);

    const noResults = await connector.searchDocuments('nonexistent');
    expect(noResults).toHaveLength(0);
  });

  it('should perform basic search with whole words option', async () => {
    const results = await connector.searchDocuments('document', { wholeWords: true });
    expect(results).toHaveLength(2);

    const singleWordResults = await connector.searchDocuments('Doc', { wholeWords: true });
    expect(singleWordResults).toHaveLength(2);

    const noWholeWordResults = await connector.searchDocuments('docu', { wholeWords: true });
    expect(noWholeWordResults).toHaveLength(0);
  });

  describe('sync', () => {
    it('should perform a successful sync', async () => {
      const result = await connector.sync(SyncType.FULL);

      expect(result.success).toBe(true);
      expect(result.documentsProcessed).toBe(2);
      expect(result.documentsAdded).toBe(2);
      expect(connector.getStatus()).toBe(ConnectorStatus.CONNECTED);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ syncId: 'mock-sync-id' }), 'Sync completed successfully');
      expect(connector.config.lastSyncAt).toBeInstanceOf(Date);

      const metrics = await connector.getMetrics();
      expect(metrics.totalSyncs).toBe(1);
      expect(metrics.successfulSyncs).toBe(1);
      expect(metrics.totalDocuments).toBe(2);
    });

    it('should update sync progress', async () => {
      const syncPromise = connector.sync(SyncType.FULL);

      // Check initial progress
      let progress = await connector.getSyncProgress('mock-sync-id');
      expect(progress?.status).toBe('RUNNING');
      expect(progress?.progress).toBe(25);

      await syncPromise;

      // Check final progress
      progress = await connector.getSyncProgress('mock-sync-id');
      expect(progress?.status).toBe('COMPLETED');
      expect(progress?.progress).toBe(100);
    });

    it('should handle sync failure', async () => {
      vi.spyOn(connector, 'testConnection').mockResolvedValueOnce(false);

      await expect(connector.sync(SyncType.FULL)).rejects.toThrow('Connection test failed');

      expect(connector.getStatus()).toBe(ConnectorStatus.ERROR);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ syncId: 'mock-sync-id' }), 'Sync failed');

      const metrics = await connector.getMetrics();
      expect(metrics.totalSyncs).toBe(1);
      expect(metrics.failedSyncs).toBe(1);

      const health = await connector.getHealth();
      expect(health.lastError).toBeDefined();
      expect(health.errorCount).toBe(1);
    });

    it('should cancel a running sync', async () => {
      const syncPromise = connector.sync(SyncType.FULL);

      // Wait for sync to start
      await vi.waitFor(() => expect(connector.getStatus()).toBe(ConnectorStatus.SYNCING));

      await connector.cancelSync('mock-sync-id');

      const progress = await connector.getSyncProgress('mock-sync-id');
      expect(progress).toBeNull(); // Should be removed after cancellation
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ syncId: 'mock-sync-id' }), 'Sync cancelled');

      // Ensure the sync promise eventually resolves or rejects (depending on internal handling)
      // For this test, we just ensure it doesn't stay stuck
      await expect(syncPromise).rejects.toThrow(); // It will throw because testConnection was mocked to return true, but the sync was cancelled before completion
    });
  });

  describe('updateConfig', () => {
    it('should update connector config successfully', async () => {
      const newConfig = { name: 'Updated Connector Name', enabled: false };
      await connector.updateConfig(newConfig);

      expect(connector.config.name).toBe('Updated Connector Name');
      expect(connector.config.enabled).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ updatedFields: ['name', 'enabled'] }), 'Connector configuration updated');
    });

    it('should throw error for invalid config update', async () => {
      vi.spyOn(connector, 'validateConfig').mockResolvedValueOnce(false);

      const newConfig = { name: '' }; // Invalid name
      await expect(connector.updateConfig(newConfig as any)).rejects.toThrow('Invalid configuration');
      expect(connector.config.name).toBe(mockConfig.name); // Should not be updated
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', async () => {
      const isValid = await connector.validateConfig(mockConfig);
      expect(isValid).toBe(true);
    });

    it('should return false for config missing id', async () => {
      const invalidConfig = { ...mockConfig, id: '' };
      const isValid = await connector.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should return false for config missing name', async () => {
      const invalidConfig = { ...mockConfig, name: '' };
      const isValid = await connector.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should return false for config missing type', async () => {
      const invalidConfig = { ...mockConfig, type: undefined as any };
      const isValid = await connector.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should log error if type-specific validation fails', async () => {
      vi.spyOn(connector, 'validateTypeSpecificConfig').mockResolvedValueOnce(false);
      const isValid = await connector.validateConfig(mockConfig);
      expect(isValid).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cancel active syncs and disconnect', async () => {
      // Start a sync to make it active
      const syncPromise = connector.sync(SyncType.FULL);
      await vi.waitFor(() => expect(connector.getStatus()).toBe(ConnectorStatus.SYNCING));

      vi.spyOn(connector, 'cancelSync');
      vi.spyOn(connector, 'disconnect');
      vi.spyOn(connector, 'removeAllListeners');

      await connector.cleanup();

      expect(connector.cancelSync).toHaveBeenCalledWith('mock-sync-id');
      expect(connector.disconnect).toHaveBeenCalled();
      expect(connector.removeAllListeners).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ connectorId: connector.id }), 'Connector cleaned up');
    });

    it('should only remove listeners if not connected or syncing', async () => {
      vi.spyOn(connector, 'cancelSync');
      vi.spyOn(connector, 'disconnect');
      vi.spyOn(connector, 'removeAllListeners');

      await connector.cleanup();

      expect(connector.cancelSync).not.toHaveBeenCalled();
      expect(connector.disconnect).not.toHaveBeenCalled();
      expect(connector.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('event emission', () => {
    it('should emit SYNC_STARTED event', async () => {
      const listener = vi.fn();
      connector.on(ConnectorEvent.SYNC_STARTED, listener);
      await connector.sync(SyncType.FULL);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ event: ConnectorEvent.SYNC_STARTED }));
    });

    it('should emit SYNC_PROGRESS event', async () => {
      const listener = vi.fn();
      connector.on(ConnectorEvent.SYNC_PROGRESS, listener);
      await connector.sync(SyncType.FULL);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ event: ConnectorEvent.SYNC_PROGRESS }));
      expect(listener).toHaveBeenCalledTimes(4); // Initializing, Fetching, Processing, Completing
    });

    it('should emit SYNC_COMPLETED event', async () => {
      const listener = vi.fn();
      connector.on(ConnectorEvent.SYNC_COMPLETED, listener);
      await connector.sync(SyncType.FULL);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ event: ConnectorEvent.SYNC_COMPLETED }));
    });

    it('should emit SYNC_FAILED event', async () => {
      const listener = vi.fn();
      connector.on(ConnectorEvent.SYNC_FAILED, listener);
      vi.spyOn(connector, 'testConnection').mockResolvedValueOnce(false);
      await expect(connector.sync(SyncType.FULL)).rejects.toThrow();
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ event: ConnectorEvent.SYNC_FAILED }));
    });

    it('should emit CONNECTED and DISCONNECTED events on status change', async () => {
      const connectedListener = vi.fn();
      const disconnectedListener = vi.fn();
      connector.on(ConnectorEvent.CONNECTED, connectedListener);
      connector.on(ConnectorEvent.DISCONNECTED, disconnectedListener);

      await connector.connect();
      expect(connectedListener).toHaveBeenCalled();
      expect(disconnectedListener).not.toHaveBeenCalled();

      await connector.disconnect();
      expect(disconnectedListener).toHaveBeenCalled();
    });
  });
});


