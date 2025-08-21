// Data source types
export enum DataSourceType {
  GIT = 'GIT',
  GITHUB = 'GITHUB',
  JIRA = 'JIRA',
  SLACK = 'SLACK',
  CONFLUENCE = 'CONFLUENCE',
  FILE_UPLOAD = 'FILE_UPLOAD',
}

// Connector status
export enum ConnectorStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  SYNCING = 'SYNCING',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED',
}

// Sync operation types
export enum SyncType {
  FULL_SYNC = 'FULL_SYNC',
  INCREMENTAL_SYNC = 'INCREMENTAL_SYNC',
  REINDEX = 'REINDEX',
  CLEANUP = 'CLEANUP',
}

// Document types that can be extracted
export enum DocumentType {
  CODE_FILE = 'CODE_FILE',
  COMMIT = 'COMMIT',
  PULL_REQUEST = 'PULL_REQUEST',
  ISSUE = 'ISSUE',
  COMMENT = 'COMMENT',
  WIKI_PAGE = 'WIKI_PAGE',
  SLACK_MESSAGE = 'SLACK_MESSAGE',
  JIRA_TICKET = 'JIRA_TICKET',
  CONFLUENCE_PAGE = 'CONFLUENCE_PAGE',
  MARKDOWN = 'MARKDOWN',
  TEXT = 'TEXT',
}

// Base connector configuration
export interface ConnectorConfig {
  id: string;
  name: string;
  type: DataSourceType;
  enabled: boolean;
  settings: Record<string, any>;
  credentials?: Record<string, any>;
  syncSchedule?: string; // Cron expression
  lastSyncAt?: Date;
  nextSyncAt?: Date;
}

// Git connector specific configuration
export interface GitConnectorConfig extends ConnectorConfig {
  type: DataSourceType.GIT;
  settings: {
    repositoryPath: string;
    branch?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    followSymlinks?: boolean;
  };
}

// GitHub connector specific configuration
export interface GitHubConnectorConfig extends ConnectorConfig {
  type: DataSourceType.GITHUB;
  settings: {
    owner: string;
    repository: string;
    branch?: string;
    includePullRequests?: boolean;
    includeIssues?: boolean;
    includeWiki?: boolean;
    maxResults?: number;
  };
  credentials: {
    token: string;
  };
}

// Jira connector specific configuration
export interface JiraConnectorConfig extends ConnectorConfig {
  type: DataSourceType.JIRA;
  settings: {
    baseUrl: string;
    projectKeys: string[];
    includeComments?: boolean;
    includeAttachments?: boolean;
    maxResults?: number;
    jqlFilter?: string;
  };
  credentials: {
    email: string;
    apiToken: string;
  };
}

// Extracted document interface
export interface ExtractedDocument {
  id: string;
  externalId: string;
  title: string;
  content: string;
  summary?: string;
  type: DocumentType;
  metadata: DocumentMetadata;
  hash: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

// Document metadata
export interface DocumentMetadata {
  source: DataSourceType;
  sourceId: string;
  path?: string;
  url?: string;
  author?: string;
  authorEmail?: string;
  language?: string;
  fileExtension?: string;
  lineCount?: number;
  tags?: string[];
  labels?: string[];
  status?: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  parentId?: string;
  children?: string[];
  relationships?: DocumentRelationship[];
  customFields?: Record<string, any>;
}

// Document relationships
export interface DocumentRelationship {
  type: RelationshipType;
  targetId: string;
  targetType: DocumentType;
  metadata?: Record<string, any>;
}

export enum RelationshipType {
  REFERENCES = 'REFERENCES',
  IMPLEMENTS = 'IMPLEMENTS',
  FIXES = 'FIXES',
  RELATES_TO = 'RELATES_TO',
  DEPENDS_ON = 'DEPENDS_ON',
  BLOCKS = 'BLOCKS',
  DUPLICATES = 'DUPLICATES',
  PARENT_OF = 'PARENT_OF',
  CHILD_OF = 'CHILD_OF',
  MENTIONS = 'MENTIONS',
  MODIFIES = 'MODIFIES',
}

// Sync result interface
export interface SyncResult {
  success: boolean;
  type: SyncType;
  startTime: Date;
  endTime: Date;
  duration: number;
  documentsProcessed: number;
  documentsAdded: number;
  documentsUpdated: number;
  documentsDeleted: number;
  errors: SyncError[];
  metadata?: Record<string, any>;
}

// Sync error interface
export interface SyncError {
  type: 'CONNECTION_ERROR' | 'AUTHENTICATION_ERROR' | 'PARSING_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  details?: any;
  documentId?: string;
  timestamp: Date;
}

// Connector health status
export interface ConnectorHealth {
  status: ConnectorStatus;
  lastCheck: Date;
  lastSuccessfulSync?: Date;
  errorCount: number;
  lastError?: SyncError;
  metrics: ConnectorMetrics;
}

// Connector metrics
export interface ConnectorMetrics {
  totalDocuments: number;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncDuration: number;
  lastSyncDuration?: number;
  dataVolume: number; // in bytes
  apiCallsCount: number;
  rateLimitHits: number;
}

// Sync progress interface
export interface SyncProgress {
  id: string;
  connectorId: string;
  type: SyncType;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  currentStepIndex: number;
  documentsProcessed: number;
  totalDocuments?: number;
  startTime: Date;
  estimatedEndTime?: Date;
  errors: SyncError[];
  metadata?: Record<string, any>;
}

// Connector capabilities
export interface ConnectorCapabilities {
  supportsIncrementalSync: boolean;
  supportsRealTimeSync: boolean;
  supportsWebhooks: boolean;
  supportsBulkOperations: boolean;
  supportsFileContent: boolean;
  supportsMetadata: boolean;
  supportsRelationships: boolean;
  maxFileSize: number;
  supportedFileTypes: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

// Connector events
export enum ConnectorEvent {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  SYNC_STARTED = 'SYNC_STARTED',
  SYNC_PROGRESS = 'SYNC_PROGRESS',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
  SYNC_FAILED = 'SYNC_FAILED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  RATE_LIMITED = 'RATE_LIMITED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
}

// Connector event data
export interface ConnectorEventData {
  connectorId: string;
  event: ConnectorEvent;
  timestamp: Date;
  data?: any;
  error?: SyncError;
}

// Base connector interface
export interface IConnector {
  // Configuration
  readonly id: string;
  readonly type: DataSourceType;
  readonly config: ConnectorConfig;
  readonly capabilities: ConnectorCapabilities;

  // Status and health
  getStatus(): ConnectorStatus;
  getHealth(): Promise<ConnectorHealth>;
  getMetrics(): Promise<ConnectorMetrics>;

  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;

  // Sync operations
  sync(type: SyncType): Promise<SyncResult>;
  getSyncProgress(syncId: string): Promise<SyncProgress | null>;
  cancelSync(syncId: string): Promise<void>;

  // Document operations
  getDocuments(options?: GetDocumentsOptions): Promise<ExtractedDocument[]>;
  getDocument(id: string): Promise<ExtractedDocument | null>;
  searchDocuments(query: string, options?: SearchOptions): Promise<ExtractedDocument[]>;

  // Event handling
  on(event: ConnectorEvent, handler: (data: ConnectorEventData) => void): void;
  off(event: ConnectorEvent, handler: (data: ConnectorEventData) => void): void;
  emit(event: ConnectorEvent, data?: any): void;

  // Configuration management
  updateConfig(config: Partial<ConnectorConfig>): Promise<void>;
  validateConfig(config: ConnectorConfig): Promise<boolean>;

  // Cleanup
  cleanup(): Promise<void>;
}

// Options for getting documents
export interface GetDocumentsOptions {
  limit?: number;
  offset?: number;
  types?: DocumentType[];
  since?: Date;
  until?: Date;
  includeContent?: boolean;
  includeMetadata?: boolean;
  filters?: Record<string, any>;
}

// Options for searching documents
export interface SearchOptions extends GetDocumentsOptions {
  fuzzy?: boolean;
  caseSensitive?: boolean;
  wholeWords?: boolean;
  regex?: boolean;
}

// Connector factory interface
export interface IConnectorFactory {
  createConnector(config: ConnectorConfig): Promise<IConnector>;
  getSupportedTypes(): DataSourceType[];
  validateConfig(type: DataSourceType, config: any): boolean;
}

// Connector registry interface
export interface IConnectorRegistry {
  register(factory: IConnectorFactory): void;
  createConnector(config: ConnectorConfig): Promise<IConnector>;
  getConnector(id: string): IConnector | null;
  getAllConnectors(): IConnector[];
  removeConnector(id: string): Promise<void>;
}

// Export all types
export type {
  ConnectorConfig,
  GitConnectorConfig,
  GitHubConnectorConfig,
  JiraConnectorConfig,
  ExtractedDocument,
  DocumentMetadata,
  DocumentRelationship,
  SyncResult,
  SyncError,
  ConnectorHealth,
  ConnectorMetrics,
  SyncProgress,
  ConnectorCapabilities,
  ConnectorEventData,
  IConnector,
  GetDocumentsOptions,
  SearchOptions,
  IConnectorFactory,
  IConnectorRegistry,
};

