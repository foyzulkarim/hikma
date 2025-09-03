// Embedding model types
export enum EmbeddingModel {
  OPENAI_TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002',
  OPENAI_TEXT_EMBEDDING_3_SMALL = 'text-embedding-3-small',
  OPENAI_TEXT_EMBEDDING_3_LARGE = 'text-embedding-3-large',
  LM_STUDIO_EMBEDDING = 'text-embedding-nomic-embed-text',
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

// Vector store configuration
export interface VectorStoreConfig {
  type: VectorStoreType;
  indexName: string;
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  namespace?: string;
  environment?: string;
  apiKey?: string;
  baseUrl?: string;
}

// Document chunk for embedding
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: ChunkMetadata;
  hash: string;
  tokens: number;
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
  totalChunks: number;
  // Neo4j graph properties
  neo4jNodeId?: string;
  graphRelationships?: string[]; // IDs of related chunks in graph
}

// Chunk metadata
export interface ChunkMetadata {
  documentType: string;
  sourceType: string;
  sourceId: string;
  projectId: string;
  title: string;
  path?: string;
  language?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  customFields?: Record<string, any>;
  // Neo4j graph metadata
  graphNodeId?: string;
  graphRelationshipCount?: number;
  graphCentralityScore?: number;
}

// Vector record for storage
export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
  sparseValues?: {
    indices: number[];
    values: number[];
  };
}

// Vector metadata (optimized for search)
export interface VectorMetadata {
  documentId: string;
  chunkId: string;
  projectId: string;
  documentType: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string; // Store content for retrieval
  path?: string;
  language?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  tokens: number;
  chunkIndex: number;
  totalChunks: number;
  // AST-specific metadata
  astNodeType?: ASTNodeType;
  functionName?: string;
  className?: string;
  methodName?: string;
  parameters?: string[];
  returnType?: string;
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAsync?: boolean;
  complexity?: number;
  dependencies?: string[];
  startLine?: number;
  endLine?: number;
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

// Vector search query
export interface VectorSearchQuery {
  vector?: number[];
  text?: string;
  topK: number;
  filter?: VectorFilter;
  includeMetadata?: boolean;
  includeValues?: boolean;
  namespace?: string;
}

// Vector search filter
export interface VectorFilter {
  projectId?: string | string[];
  documentType?: string | string[];
  sourceType?: string | string[];
  sourceId?: string | string[];
  language?: string | string[];
  author?: string | string[];
  tags?: string | string[];
  createdAt?: {
    $gte?: string;
    $lte?: string;
  };
  updatedAt?: {
    $gte?: string;
    $lte?: string;
  };
  path?: {
    $regex?: string;
  };
  // AST-specific filters
  astNodeType?: ASTNodeType | ASTNodeType[];
  functionName?: string | string[];
  className?: string | string[];
  methodName?: string | string[];
  visibility?: ('public' | 'private' | 'protected')[];
  isStatic?: boolean;
  isAsync?: boolean;
  complexity?: {
    $gte?: number;
    $lte?: number;
  };
  dependencies?: string | string[];
  startLine?: {
    $gte?: number;
    $lte?: number;
  };
  endLine?: {
    $gte?: number;
    $lte?: number;
  };
  [key: string]: any;
}

// Vector search result
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
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

// AST chunk metadata
export interface ASTChunkMetadata extends ChunkMetadata {
  astNodeType?: ASTNodeType;
  functionName?: string;
  className?: string;
  methodName?: string;
  parameters?: string[];
  returnType?: string;
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAsync?: boolean;
  complexity?: number;
  dependencies?: string[];
  startLine?: number;
  endLine?: number;
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
  chunks: DocumentChunk[];
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
  embedChunks(chunks: DocumentChunk[]): Promise<VectorRecord[]>;
  embedDocument(documentId: string, content: string, metadata: ChunkMetadata): Promise<VectorRecord[]>;

  // Processing pipeline
  processDocument(documentId: string, content: string, metadata: ChunkMetadata): Promise<{
    chunks: DocumentChunk[];
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
    metadata: ChunkMetadata;
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

// Hybrid search query
export interface HybridSearchQuery {
  text?: string;
  vector?: number[];
  keywords?: string[];
  filters?: VectorFilter;
  weights?: {
    semantic: number;
    keyword: number;
  };
  options?: VectorSearchOptions;
}

