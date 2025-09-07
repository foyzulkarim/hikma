// Embedding model types
export enum EmbeddingModel {
  OPENAI_TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002',
  OPENAI_TEXT_EMBEDDING_3_SMALL = 'text-embedding-3-small',
  OPENAI_TEXT_EMBEDDING_3_LARGE = 'text-embedding-3-large',
  LM_STUDIO_EMBEDDING = 'text-embedding-nomic-embed-text',
  OLLAMA_EMBEDDING = 'mxbai-embed-large',
}

// Vector store types
export enum VectorStoreType {
  CHROMA = 'CHROMA',
  WEAVIATE = 'WEAVIATE',
  QDRANT = 'QDRANT',
  NEO4J = 'NEO4J', // Added Neo4j support
}

// Embedding configuration
export interface EmbeddingConfig {
  model: EmbeddingModel;
  dimensions: number;
  maxTokens: number;
  batchSize: number;
  rateLimitRpm: number;
  rateLimitTpm: number;
}

// Qdrant collection configuration
export interface QdrantCollectionConfig {
  name: string;
  vectors: {
    code: {
      size: number;
      distance: 'Cosine' | 'Euclidean' | 'Dot';
    };
    documentation: {
      size: number;
      distance: 'Cosine' | 'Euclidean' | 'Dot';
    };
  };
  optimizers_config: {
    default_segment_number: number;
    indexing_threshold: number;
  };
}

// Qdrant indexes configuration
export interface QdrantIndexesConfig {
  keyword_indexes: string[];
  keyword_array_indexes: string[];
  numeric_indexes: string[];
  boolean_indexes: string[];
}

// Vector store configuration (enhanced for multi-vector support)
export interface VectorStoreConfig {
  type: VectorStoreType;
  indexName: string;
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  namespace?: string;
  environment?: string;
  apiKey?: string;
  baseUrl?: string;
  
  // Multi-vector configuration for Qdrant
  multiVector?: {
    code: {
      dimensions: number;
      metric: 'cosine' | 'euclidean' | 'dotproduct';
    };
    documentation: {
      dimensions: number;
      metric: 'cosine' | 'euclidean' | 'dotproduct';
    };
  };
  
  // Qdrant-specific configuration
  qdrantConfig?: QdrantCollectionConfig;
  qdrantIndexes?: QdrantIndexesConfig;
}

// Code chunk for embedding (aligned with Prisma CodeChunk model)
export interface CodeChunk {
  id: string;
  fileId: string;
  parentChunkId?: string;
  
  // Position information
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  
  // Content
  codeContent: string;
  cleanedContent?: string;
  
  // Tree-sitter extracted metadata
  nodeType: string;
  nodeName?: string;
  signature?: string;
  
  // Classification metadata
  purposeCategory?: string;
  complexityScore?: number;
  cognitiveComplexity?: number;
  
  // Rich flags
  hasDocstring: boolean;
  hasErrorHandling: boolean;
  hasTests: boolean;
  isExported: boolean;
  isAsync: boolean;
  isGenerator: boolean;
  isStatic: boolean;
  
  // Indexing
  embeddingVersion?: string;
  embeddedAt?: Date;
  qdrantPointId?: string;
  vectorId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Code chunk metadata (aligned with new schema)
export interface CodeChunkMetadata {
  repositoryId: string;
  filePath: string;
  language?: string;
  framework?: string;
  projectId: string;
  
  // Tree-sitter metadata
  nodeType: string;
  nodeName?: string;
  signature?: string;
  
  // Classification
  purposeCategory?: string;
  complexityScore?: number;
  cognitiveComplexity?: number;
  
  // Flags
  hasDocstring: boolean;
  hasErrorHandling: boolean;
  hasTests: boolean;
  isExported: boolean;
  isAsync: boolean;
  isGenerator: boolean;
  isStatic: boolean;
  
  // Position
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

// Qdrant point payload (exact match to your schema)
export interface QdrantPayload {
  // Identifiers (link back to PostgreSQL)
  chunk_id: string;
  file_id: string;
  repository_id: string;
  
  // Searchable metadata (indexed)
  node_type: string;
  node_name: string;
  file_path: string;
  language: string;
  framework?: string;
  
  // Classification (indexed)
  purpose_category: string;
  domain_tags: string[];
  patterns: string[]; // design patterns detected
  
  // Hierarchical information
  parent_chunk_id?: string;
  depth_level: number; // 0=file, 1=class, 2=method, etc.
  
  // Code characteristics (for filtering)
  complexity_score: number;
  line_count: number;
  token_count: number;
  
  // Boolean filters
  has_docstring: boolean;
  has_error_handling: boolean;
  has_tests: boolean;
  is_exported: boolean;
  is_async: boolean;
  
  // Relationship counts (for ranking)
  num_callers: number;
  num_callees: number;
  num_imports: number;
  
  // Text snippets for context
  signature?: string;
  docstring_summary?: string;
  first_line_comment?: string;
  
  // Timestamps
  indexed_at: string;
  file_modified_at: string;
}

// Vector record for storage (enhanced with multi-vector support)
export interface VectorRecord {
  id: string;
  vectors: {
    code?: number[];
    documentation?: number[];
  };
  payload: QdrantPayload;
  // Legacy support
  values?: number[];
  metadata?: VectorMetadata;
  sparseValues?: {
    indices: number[];
    values: number[];
  };
}

// Qdrant-optimized vector metadata (matches QDrantPayload)
export interface VectorMetadata {
  // Identifiers (link back to PostgreSQL)
  chunk_id: string;
  file_id: string;
  repository_id: string;
  
  // Searchable metadata (indexed)
  node_type: string;
  node_name: string;
  file_path: string;
  language: string;
  framework?: string;
  
  // Classification (indexed)
  purpose_category: string;
  domain_tags: string[];
  patterns: string[]; // design patterns detected
  
  // Hierarchical information
  parent_chunk_id?: string;
  depth_level: number; // 0=file, 1=class, 2=method, etc.
  
  // Code characteristics (for filtering)
  complexity_score: number;
  line_count: number;
  token_count: number;
  
  // Boolean filters
  has_docstring: boolean;
  has_error_handling: boolean;
  has_tests: boolean;
  is_exported: boolean;
  is_async: boolean;
  
  // Relationship counts (for ranking)
  num_callers: number;
  num_callees: number;
  num_imports: number;
  
  // Text snippets for context
  signature?: string;
  docstring_summary?: string;
  first_line_comment?: string;
  
  // Timestamps
  indexed_at: string;
  file_modified_at: string;
}

// Legacy VectorMetadata for backward compatibility (deprecated)
export interface LegacyVectorMetadata {
  chunkId: string;
  fileId: string;
  repositoryId: string;
  projectId: string;
  filePath: string;
  content: string;
  language?: string;
  framework?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  nodeType: string;
  nodeName?: string;
  signature?: string;
  purposeCategory?: string;
  complexityScore?: number;
  cognitiveComplexity?: number;
  hasDocstring: boolean;
  hasErrorHandling: boolean;
  hasTests: boolean;
  isExported: boolean;
  isAsync: boolean;
  isGenerator: boolean;
  isStatic: boolean;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

// Embedding request
export interface EmbeddingRequest {
  texts: string[];
  model?: EmbeddingModel;
  user?: string;
}

// Embedding response
export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

// Enhanced vector search query (supports multi-vector)
export interface VectorSearchQuery {
  // Multi-vector support
  vectors?: {
    code?: number[];
    documentation?: number[];
  };
  // Legacy single vector
  vector?: number[];
  text?: string;
  topK: number;
  filter?: VectorFilter;
  includeMetadata?: boolean;
  includeValues?: boolean;
  namespace?: string;
  
  // Vector type preference for multi-vector search
  vectorType?: 'code' | 'documentation' | 'both';
  
  // Search strategy
  strategy?: 'semantic' | 'hybrid' | 'keyword';
}

// Qdrant-optimized vector search filter
export interface VectorFilter {
  // Repository and file filters
  repository_id?: string | string[];
  file_id?: string | string[];
  file_path?: string | { $regex?: string };
  
  // Node type and classification
  node_type?: string | string[];
  node_name?: string | string[];
  purpose_category?: string | string[];
  domain_tags?: string | string[];
  patterns?: string | string[];
  
  // Language and framework
  language?: string | string[];
  framework?: string | string[];
  
  // Hierarchy
  parent_chunk_id?: string | string[];
  depth_level?: number | {
    $gte?: number;
    $lte?: number;
  };
  
  // Code characteristics
  complexity_score?: {
    $gte?: number;
    $lte?: number;
  };
  line_count?: {
    $gte?: number;
    $lte?: number;
  };
  token_count?: {
    $gte?: number;
    $lte?: number;
  };
  
  // Boolean flags
  has_docstring?: boolean;
  has_error_handling?: boolean;
  has_tests?: boolean;
  is_exported?: boolean;
  is_async?: boolean;
  
  // Relationship counts
  num_callers?: {
    $gte?: number;
    $lte?: number;
  };
  num_callees?: {
    $gte?: number;
    $lte?: number;
  };
  num_imports?: {
    $gte?: number;
    $lte?: number;
  };
  
  // Time-based filters
  indexed_at?: {
    $gte?: string;
    $lte?: string;
  };
  file_modified_at?: {
    $gte?: string;
    $lte?: string;
  };
  
  [key: string]: any;
}

// Legacy vector filter for backward compatibility
export interface LegacyVectorFilter {
  projectId?: string | string[];
  documentType?: string | string[];
  sourceType?: string | string[];
  sourceId?: string | string[];
  language?: string | string[];
  author?: string | string[];
  tags?: string | string[];
  createdAt?: { $gte?: string; $lte?: string; };
  updatedAt?: { $gte?: string; $lte?: string; };
  path?: { $regex?: string; };
  astNodeType?: ASTNodeType | ASTNodeType[];
  functionName?: string | string[];
  className?: string | string[];
  methodName?: string | string[];
  visibility?: ('public' | 'private' | 'protected')[];
  isStatic?: boolean;
  isAsync?: boolean;
  complexity?: { $gte?: number; $lte?: number; };
  dependencies?: string | string[];
  startLine?: { $gte?: number; $lte?: number; };
  endLine?: { $gte?: number; $lte?: number; };
  [key: string]: any;
}

// Enhanced vector search result (supports multi-vector)
export interface VectorSearchResult {
  id: string;
  score: number;
  payload: QdrantPayload;
  vectors?: {
    code?: number[];
    documentation?: number[];
  };
  // Legacy support
  metadata?: VectorMetadata;
  values?: number[];
}

// Vector search response
export interface VectorSearchResponse {
  results: VectorSearchResult[];
  totalCount?: number;
  query: VectorSearchQuery;
  executionTime: number;
}

// Chunking strategy
export enum ChunkingStrategy {
  FIXED_SIZE = 'FIXED_SIZE',
  SEMANTIC = 'SEMANTIC',
  RECURSIVE = 'RECURSIVE',
  MARKDOWN = 'MARKDOWN',
  CODE = 'CODE',
}

// AST-specific chunk types
export enum ASTNodeType {
  CLASS = 'class',
  FUNCTION = 'function',
  METHOD = 'method',
  INTERFACE = 'interface',
  TYPE = 'type',
  VARIABLE = 'variable',
  CONSTANT = 'constant',
  IMPORT = 'import',
  EXPORT = 'export',
  COMMENT = 'comment',
  OTHER = 'other'
}

// AST chunk metadata (extends CodeChunkMetadata with additional AST-specific fields)
export interface ASTChunkMetadata extends Omit<CodeChunkMetadata, 'hasDocstring' | 'hasErrorHandling' | 'hasTests' | 'isExported' | 'isAsync' | 'isGenerator' | 'isStatic'> {
  astNodeType?: ASTNodeType;
  functionName?: string;
  className?: string;
  methodName?: string;
  parameters?: string[];
  returnType?: string;
  visibility?: 'public' | 'private' | 'protected';
  
  // Override boolean flags to be optional for AST metadata
  hasDocstring?: boolean;
  hasErrorHandling?: boolean;
  hasTests?: boolean;
  isExported?: boolean;
  isAsync?: boolean;
  isGenerator?: boolean;
  isStatic?: boolean;
  
  complexity?: number;
  dependencies?: string[];
  syntaxTree?: any; // Simplified AST representation
}

// Chunking configuration
export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  maxChunkSize: number;
  separators?: string[];
  preserveStructure?: boolean;
  respectBoundaries?: boolean;
  language?: string; // Language for AST-based code parsing
}

// Chunking result
export interface ChunkingResult {
  chunks: CodeChunk[];
  totalChunks: number;
  totalTokens: number;
  strategy: ChunkingStrategy;
  metadata: {
    originalLength: number;
    averageChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
  };
}

// Vector operation types
export enum VectorOperation {
  UPSERT = 'UPSERT',
  DELETE = 'DELETE',
  UPDATE = 'UPDATE',
  QUERY = 'QUERY',
  FETCH = 'FETCH',
}

// Vector operation request
export interface VectorOperationRequest {
  operation: VectorOperation;
  vectors?: VectorRecord[];
  ids?: string[];
  query?: VectorSearchQuery;
  namespace?: string;
}

// Vector operation response
export interface VectorOperationResponse {
  success: boolean;
  operation: VectorOperation;
  processedCount?: number;
  results?: VectorSearchResult[];
  errors?: VectorOperationError[];
  executionTime: number;
}

// Vector operation error
export interface VectorOperationError {
  id?: string;
  error: string;
  code?: string;
  details?: any;
}

// Vector store statistics
export interface VectorStoreStats {
  totalVectors: number;
  dimensions: number;
  indexSize: number;
  namespaces: string[];
  lastUpdated: Date;
  metrics: {
    queriesPerSecond: number;
    averageQueryLatency: number;
    indexUtilization: number;
  };
}

// Embedding service interface
export interface IEmbeddingService {
  generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  generateEmbedding(text: string, model?: EmbeddingModel): Promise<number[]>;
  getModelInfo(model: EmbeddingModel): EmbeddingConfig;
  validateText(text: string, model: EmbeddingModel): boolean;
  estimateTokens(text: string): number;
  splitTextForEmbedding(text: string, model: EmbeddingModel): string[];
}

// Vector store interface
export interface IVectorStore {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;

  // Index management
  createIndex(config: VectorStoreConfig): Promise<void>;
  deleteIndex(indexName: string): Promise<void>;
  listIndexes(): Promise<string[]>;
  getIndexStats(indexName?: string): Promise<VectorStoreStats>;

  // Vector operations
  upsert(vectors: VectorRecord[], namespace?: string): Promise<VectorOperationResponse>;
  delete(ids: string[], namespace?: string): Promise<VectorOperationResponse>;
  fetch(ids: string[], namespace?: string): Promise<VectorRecord[]>;
  query(query: VectorSearchQuery): Promise<VectorSearchResponse>;
  
  // Batch operations
  batchUpsert(vectors: VectorRecord[], batchSize?: number, namespace?: string): Promise<VectorOperationResponse>;
  batchDelete(ids: string[], batchSize?: number, namespace?: string): Promise<VectorOperationResponse>;

  // Namespace management
  listNamespaces(): Promise<string[]>;
  deleteNamespace(namespace: string): Promise<void>;
  getNamespaceStats(namespace: string): Promise<VectorStoreStats>;
}

// Document processing service interface
export interface IDocumentProcessor {
  // Chunking
  chunkDocument(content: string, config: ChunkingConfig): Promise<ChunkingResult>;
  chunkDocuments(documents: Array<{ id: string; content: string }>, config: ChunkingConfig): Promise<Map<string, ChunkingResult>>;

  // Embedding
  embedChunks(chunks: CodeChunk[]): Promise<VectorRecord[]>;
  embedDocument(documentId: string, content: string, metadata: CodeChunkMetadata): Promise<VectorRecord[]>;

  // Processing pipeline
  processDocument(documentId: string, content: string, metadata: CodeChunkMetadata): Promise<{
    chunks: CodeChunk[];
    vectors: VectorRecord[];
    stats: {
      totalChunks: number;
      totalTokens: number;
      processingTime: number;
    };
  }>;

  // Batch processing
  processDocuments(documents: Array<{
    id: string;
    content: string;
    metadata: CodeChunkMetadata;
  }>): Promise<Map<string, VectorRecord[]>>;
}

// Vector search service interface
export interface IVectorSearchService {
  // Text search
  searchByText(text: string, options: VectorSearchOptions): Promise<VectorSearchResponse>;
  
  // Vector search
  searchByVector(vector: number[], options: VectorSearchOptions): Promise<VectorSearchResponse>;
  
  // Hybrid search
  hybridSearch(query: HybridSearchQuery): Promise<VectorSearchResponse>;
  
  // Similarity search
  findSimilar(documentId: string, options: VectorSearchOptions): Promise<VectorSearchResponse>;
  
  // Multi-query search
  multiSearch(queries: VectorSearchQuery[]): Promise<VectorSearchResponse[]>;
}

// Vector search options
export interface VectorSearchOptions {
  topK?: number;
  filter?: VectorFilter;
  namespace?: string;
  includeMetadata?: boolean;
  includeValues?: boolean;
  threshold?: number;
  rerank?: boolean;
}

// Hybrid search query (enhanced)
export interface HybridSearchQuery {
  text?: string;
  vectors?: {
    code?: number[];
    documentation?: number[];
  };
  // Legacy single vector
  vector?: number[];
  keywords?: string[];
  filters?: VectorFilter;
  weights?: {
    semantic: number;
    keyword: number;
    code?: number;
    documentation?: number;
  };
  options?: VectorSearchOptions;
}

// Default Qdrant configuration
export const DEFAULT_QDRANT_CONFIG: QdrantCollectionConfig = {
  name: 'code_embeddings',
  vectors: {
    code: {
      size: 1536, // OpenAI ada-002
      distance: 'Cosine'
    },
    documentation: {
      size: 1536, // Separate vector for docs
      distance: 'Cosine'
    }
  },
  optimizers_config: {
    default_segment_number: 2,
    indexing_threshold: 10000
  }
};

// Default Qdrant indexes configuration
export const DEFAULT_QDRANT_INDEXES: QdrantIndexesConfig = {
  keyword_indexes: [
    'node_type',
    'purpose_category',
    'language',
    'framework',
    'file_path'
  ],
  keyword_array_indexes: [
    'domain_tags',
    'patterns'
  ],
  numeric_indexes: [
    'complexity_score',
    'line_count',
    'num_callers',
    'depth_level'
  ],
  boolean_indexes: [
    'has_docstring',
    'has_error_handling',
    'is_exported',
    'is_async'
  ]
};

