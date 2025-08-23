import { EventEmitter } from 'events';
import {
  IConnector,
  ConnectorConfig,
  DataSourceType,
  ConnectorStatus,
  ConnectorHealth,
  ConnectorMetrics,
  ConnectorCapabilities,
  SyncType,
  SyncResult,
  SyncProgress,
  ExtractedDocument,
  GetDocumentsOptions,
  SearchOptions,
  ConnectorEvent,
  ConnectorEventData,
  SyncError,
} from '@/core/types/connectors';
import { logger } from '@/core/utils/logger';
import { SecureRandomUtils } from '@/core/utils/crypto';

// Base connector implementation
export abstract class BaseConnector extends EventEmitter implements IConnector {
  protected _id: string;
  protected _type: DataSourceType;
  protected _config: ConnectorConfig;
  protected _status: ConnectorStatus = ConnectorStatus.IDLE;
  protected _health: ConnectorHealth;
  protected _metrics: ConnectorMetrics;
  protected _activeSyncs = new Map<string, SyncProgress>();

  constructor(config: ConnectorConfig) {
    super();
    this._id = config.id;
    this._type = config.type;
    this._config = config;
    
    this._health = this.initializeHealth();
    this._metrics = this.initializeMetrics();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get type(): DataSourceType {
    return this._type;
  }

  get config(): ConnectorConfig {
    return this._config;
  }

  abstract get capabilities(): ConnectorCapabilities;

  // Status and health
  getStatus(): ConnectorStatus {
    return this._status;
  }

  async getHealth(): Promise<ConnectorHealth> {
    this._health.lastCheck = new Date();
    return { ...this._health };
  }

  async getMetrics(): Promise<ConnectorMetrics> {
    return { ...this._metrics };
  }

  // Abstract methods that must be implemented by subclasses
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract getDocuments(options?: GetDocumentsOptions): Promise<ExtractedDocument[]>;
  abstract getDocument(id: string): Promise<ExtractedDocument | null>;

  // Default implementation for search (can be overridden)
  async searchDocuments(query: string, options?: SearchOptions): Promise<ExtractedDocument[]> {
    const documents = await this.getDocuments(options);
    
    // Simple text-based search implementation
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return documents.filter(doc => {
      const searchableText = `${doc.title} ${doc.content}`.toLowerCase();
      
      if (options?.wholeWords) {
        return searchTerms.every(term => 
          new RegExp(`\\b${term}\\b`).test(searchableText)
        );
      } else {
        return searchTerms.every(term => searchableText.includes(term));
      }
    });
  }

  // Sync operations
  async sync(type: SyncType): Promise<SyncResult> {
    const syncId = SecureRandomUtils.generateId();
    const startTime = new Date();

    try {
      this._status = ConnectorStatus.SYNCING;
      
      const progress: SyncProgress = {
        id: syncId,
        connectorId: this._id,
        type,
        status: 'RUNNING',
        progress: 0,
        currentStep: 'Initializing sync',
        totalSteps: 4,
        currentStepIndex: 0,
        documentsProcessed: 0,
        startTime,
        errors: [],
      };

      this._activeSyncs.set(syncId, progress);
      this.emit(ConnectorEvent.SYNC_STARTED, { syncId, type });

      // Step 1: Validate connection
      progress.currentStep = 'Validating connection';
      progress.currentStepIndex = 1;
      progress.progress = 25;
      this.updateSyncProgress(syncId, progress);

      const isConnected = await this.testConnection();
      if (!isConnected) {
        throw new Error('Connection test failed');
      }

      // Step 2: Fetch documents
      progress.currentStep = 'Fetching documents';
      progress.currentStepIndex = 2;
      progress.progress = 50;
      this.updateSyncProgress(syncId, progress);

      const documents = await this.performSync(type, progress);

      // Step 3: Process documents
      progress.currentStep = 'Processing documents';
      progress.currentStepIndex = 3;
      progress.progress = 75;
      progress.documentsProcessed = documents.length;
      this.updateSyncProgress(syncId, progress);

      const result = await this.processDocuments(documents, type);

      // Step 4: Complete
      progress.currentStep = 'Completing sync';
      progress.currentStepIndex = 4;
      progress.progress = 100;
      progress.status = 'COMPLETED';
      this.updateSyncProgress(syncId, progress);

      const endTime = new Date();
      const syncResult: SyncResult = {
        success: true,
        type,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        documentsProcessed: documents.length,
        documentsAdded: result.added,
        documentsUpdated: result.updated,
        documentsDeleted: result.deleted,
        errors: progress.errors,
      };

      this.updateMetrics(syncResult);
      this._status = ConnectorStatus.CONNECTED;
      this._config.lastSyncAt = endTime;

      this.emit(ConnectorEvent.SYNC_COMPLETED, { syncId, result: syncResult });
      this._activeSyncs.delete(syncId);

      logger.info({
        connectorId: this._id,
        syncId,
        type,
        duration: syncResult.duration,
        documentsProcessed: syncResult.documentsProcessed,
      }, 'Sync completed successfully');

      return syncResult;

    } catch (error) {
      const endTime = new Date();
      const syncError: SyncError = {
        type: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        timestamp: endTime,
      };

      const syncResult: SyncResult = {
        success: false,
        type,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        documentsProcessed: 0,
        documentsAdded: 0,
        documentsUpdated: 0,
        documentsDeleted: 0,
        errors: [syncError],
      };

      const progress = this._activeSyncs.get(syncId);
      if (progress) {
        progress.status = 'FAILED';
        progress.errors.push(syncError);
        this.updateSyncProgress(syncId, progress);
      }

      this.updateMetrics(syncResult);
      this._status = ConnectorStatus.ERROR;
      this._health.lastError = syncError;
      this._health.errorCount++;

      this.emit(ConnectorEvent.SYNC_FAILED, { syncId, error: syncError });
      this._activeSyncs.delete(syncId);

      logger.error({
        connectorId: this._id,
        syncId,
        type,
        error: syncError,
      }, 'Sync failed');

      throw error;
    }
  }

  async getSyncProgress(syncId: string): Promise<SyncProgress | null> {
    return this._activeSyncs.get(syncId) || null;
  }

  async cancelSync(syncId: string): Promise<void> {
    const progress = this._activeSyncs.get(syncId);
    if (progress && progress.status === 'RUNNING') {
      progress.status = 'CANCELLED';
      this.updateSyncProgress(syncId, progress);
      this._activeSyncs.delete(syncId);
      
      logger.info({
        connectorId: this._id,
        syncId,
      }, 'Sync cancelled');
    }
  }

  // Configuration management
  async updateConfig(config: Partial<ConnectorConfig>): Promise<void> {
    const isValid = await this.validateConfig({ ...this._config, ...config });
    if (!isValid) {
      throw new Error('Invalid configuration');
    }

    this._config = { ...this._config, ...config };
    
    logger.info({
      connectorId: this._id,
      updatedFields: Object.keys(config),
    }, 'Connector configuration updated');
  }

  async validateConfig(config: ConnectorConfig): Promise<boolean> {
    try {
      // Basic validation
      if (!config.id || !config.name || !config.type) {
        return false;
      }

      // Type-specific validation should be implemented in subclasses
      return await this.validateTypeSpecificConfig(config);
    } catch (error) {
      logger.error({
        connectorId: this._id,
        error,
      }, 'Configuration validation failed');
      return false;
    }
  }

  // Event handling
  emit(event: ConnectorEvent, data?: any): boolean {
    const eventData: ConnectorEventData = {
      connectorId: this._id,
      event,
      timestamp: new Date(),
      data,
    };

    logger.debug({
      connectorId: this._id,
      event,
      data,
    }, 'Connector event emitted');

    return super.emit(event, eventData);
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Cancel all active syncs
    for (const syncId of this._activeSyncs.keys()) {
      await this.cancelSync(syncId);
    }

    // Disconnect if connected
    if (this._status === ConnectorStatus.CONNECTED || this._status === ConnectorStatus.SYNCING) {
      await this.disconnect();
    }

    // Remove all listeners
    this.removeAllListeners();

    logger.info({
      connectorId: this._id,
    }, 'Connector cleaned up');
  }

  // Protected helper methods
  protected updateSyncProgress(syncId: string, progress: SyncProgress): void {
    this._activeSyncs.set(syncId, progress);
    this.emit(ConnectorEvent.SYNC_PROGRESS, { syncId, progress });
  }

  protected addSyncError(syncId: string, error: SyncError): void {
    const progress = this._activeSyncs.get(syncId);
    if (progress) {
      progress.errors.push(error);
      this.updateSyncProgress(syncId, progress);
    }
  }

  protected updateMetrics(result: SyncResult): void {
    this._metrics.totalSyncs++;
    
    if (result.success) {
      this._metrics.successfulSyncs++;
      this._health.lastSuccessfulSync = result.endTime;
    } else {
      this._metrics.failedSyncs++;
    }

    this._metrics.lastSyncDuration = result.duration;
    this._metrics.averageSyncDuration = 
      (this._metrics.averageSyncDuration * (this._metrics.totalSyncs - 1) + result.duration) / 
      this._metrics.totalSyncs;

    this._metrics.totalDocuments += result.documentsAdded;
  }

  protected setStatus(status: ConnectorStatus): void {
    const previousStatus = this._status;
    this._status = status;

    if (status !== previousStatus) {
      logger.debug({
        connectorId: this._id,
        previousStatus,
        newStatus: status,
      }, 'Connector status changed');

      if (status === ConnectorStatus.CONNECTED) {
        this.emit(ConnectorEvent.CONNECTED);
      } else if (status === ConnectorStatus.DISCONNECTED) {
        this.emit(ConnectorEvent.DISCONNECTED);
      } else if (status === ConnectorStatus.ERROR) {
        this.emit(ConnectorEvent.ERROR_OCCURRED);
      }
    }
  }

  // Abstract methods for subclasses
  protected abstract performSync(type: SyncType, progress: SyncProgress): Promise<ExtractedDocument[]>;
  protected abstract processDocuments(documents: ExtractedDocument[], type: SyncType): Promise<{
    added: number;
    updated: number;
    deleted: number;
  }>;
  protected abstract validateTypeSpecificConfig(config: ConnectorConfig): Promise<boolean>;

  // Initialize default health and metrics
  private initializeHealth(): ConnectorHealth {
    return {
      status: ConnectorStatus.IDLE,
      lastCheck: new Date(),
      errorCount: 0,
      metrics: this.initializeMetrics(),
    };
  }

  private initializeMetrics(): ConnectorMetrics {
    return {
      totalDocuments: 0,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncDuration: 0,
      dataVolume: 0,
      apiCallsCount: 0,
      rateLimitHits: 0,
    };
  }
}

