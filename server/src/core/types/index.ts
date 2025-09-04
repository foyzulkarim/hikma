// Core Types Index
// This file exports all types for easy importing throughout the application

// Embedding and Vector Store Types
export {
  // Enums
  EmbeddingModel,
  VectorStoreType,
  ChunkingStrategy,
  ASTNodeType,
  VectorOperation,
} from './embeddings';

export type {
  // Interfaces
  EmbeddingConfig,
  VectorStoreConfig,
  DocumentChunk,
  ChunkMetadata,
  VectorRecord,
  VectorMetadata,
  EmbeddingRequest,
  EmbeddingResponse,
  VectorSearchQuery,
  VectorFilter,
  VectorSearchResult,
  VectorSearchResponse,
  ASTChunkMetadata,
  ChunkingConfig,
  ChunkingResult,
  VectorOperationRequest,
  VectorOperationResponse,
  VectorOperationError,
  VectorStoreStats,
  VectorSearchOptions,
  HybridSearchQuery,
  
  // Service Interfaces
  IEmbeddingService,
  IVectorStore,
  IDocumentProcessor,
  IVectorSearchService,
} from './embeddings';

// Graph Database Types
export {
  // Enums
  GraphStoreType,
  GraphNodeType,
  GraphRelationshipType,
} from './graph';

export type {
  // Interfaces
  GraphConfig,
  GraphNode,
  GraphRelationship,
  ChunkGraphNode,
  DocumentGraphNode,
  ProjectGraphNode,
  GraphQuery,
  GraphQueryResult,
  GraphRecord,
  GraphTraversalOptions,
  GraphSearchOptions,
  GraphAnalyticsResult,
  GraphPath,
  GraphCentralityMetrics,
  GraphCommunity,
  GraphOperationResult,
  GraphTransaction,
  GraphIndexConfig,
  GraphConstraintConfig,
  GraphSchema,
  
  // Service Interfaces
  IGraphService,
  IGraphChunkService,
} from './graph';

// Common built-in types are available globally, no need to re-export

// Utility types for the application
export type ID = string;
export type Timestamp = string;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// Common response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Timestamp;
    requestId?: string;
    executionTime?: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

// Pagination options
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter options
export interface FilterOptions {
  search?: string;
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  tags?: string[];
  status?: string[];
  [key: string]: any;
}

// Batch operation options
export interface BatchOptions {
  batchSize?: number;
  parallel?: boolean;
  continueOnError?: boolean;
  progressCallback?: (processed: number, total: number) => void;
}

// Service configuration base
export interface ServiceConfig {
  enabled: boolean;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  circuitBreaker?: {
    enabled: boolean;
    threshold: number;
    timeout: number;
  };
}

// Health check result
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Timestamp;
  responseTime?: number;
  details?: any;
  dependencies?: HealthCheckResult[];
}

// Metrics data
export interface MetricsData {
  name: string;
  value: number;
  unit?: string;
  timestamp: Timestamp;
  tags?: Record<string, string>;
}

// Event data
export interface EventData {
  id: ID;
  type: string;
  source: string;
  timestamp: Timestamp;
  data: JSONObject;
  metadata?: JSONObject;
}

// Cache options
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  tags?: string[];
  compress?: boolean;
}

// Rate limiting options
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// File upload options
export interface FileUploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  destination?: string;
  filename?: string;
  preserveOriginalName?: boolean;
}

// Search options (generic)
export interface SearchOptions {
  query: string;
  fields?: string[];
  fuzzy?: boolean;
  boost?: Record<string, number>;
  filters?: FilterOptions;
  pagination?: PaginationOptions;
  highlight?: boolean;
}

// Audit log entry
export interface AuditLogEntry {
  id: ID;
  userId?: ID;
  action: string;
  resource: string;
  resourceId?: ID;
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
  details?: JSONObject;
}

// Configuration value
export interface ConfigValue {
  key: string;
  value: JSONValue;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  defaultValue?: JSONValue;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: JSONValue[];
  };
}