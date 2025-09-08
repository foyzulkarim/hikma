// Neo4j Graph Database Types

// Graph store types
export enum GraphStoreType {
  NEO4J = 'NEO4J',
  ARANGODB = 'ARANGODB',
  NEPTUNE = 'NEPTUNE',
}

// Graph configuration
export interface GraphConfig {
  type: GraphStoreType;
  uri: string;
  username?: string;
  password?: string;
  database?: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
  maxTransactionRetryTime?: number;
  encrypted?: boolean;
}

// Graph node types
export enum GraphNodeType {
  CHUNK = 'CodeChunk',
  DOCUMENT = 'Document',
  PROJECT = 'Project',
  FUNCTION = 'Function',
  CLASS = 'Class',
  MODULE = 'Module',
  INTERFACE = 'Interface',
  TYPE = 'Type',
  PACKAGE = 'Package',
}

// Graph relationship types
export enum GraphRelationshipType {
  CONTAINS = 'CONTAINS',
  CALLS = 'CALLS',
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS',
  IMPORTS = 'IMPORTS',
  EXPORTS = 'EXPORTS',
  USES = 'USES',
  REFERENCES = 'REFERENCES',
  OVERRIDES = 'OVERRIDES',
  DEPENDS_ON = 'DEPENDS_ON',
  BELONGS_TO = 'BELONGS_TO',
  SIMILAR_TO = 'SIMILAR_TO',
  TESTED_BY = 'TESTED_BY',
  DECORATES = 'DECORATES',
}

// Base graph node interface
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  properties: Record<string, any>;
  labels?: string[];
}

// Base graph relationship interface
export interface GraphRelationship {
  id?: string;
  type: GraphRelationshipType;
  startNodeId: string;
  endNodeId: string;
  properties?: Record<string, any>;
}

// Code chunk node for Neo4j - matches new schema
export interface CodeChunkGraphNode extends GraphNode {
  type: GraphNodeType.CHUNK;
  properties: {
    // Identity - matches PostgreSQL chunk_id
    id: string;
    name: string;
    type: 'MODULE' | 'CLASS' | 'FUNCTION' | 'METHOD' | 'INTERFACE' | 'TYPE';
    
    // Core metadata
    filePath: string;
    startLine: number;
    endLine: number;
    signature?: string;
    
    // Quick classification
    purposeCategory: string;
    isAsync: boolean;
    isExported: boolean;
    
    // For quick filtering without joining
    repository: string;
    language: string;
    
    // Additional metadata for compatibility
    createdAt: string;
    updatedAt: string;
  };
}

// Legacy interface for backward compatibility (deprecated)
export interface ChunkGraphNode extends GraphNode {
  type: GraphNodeType.CHUNK;
  properties: {
    chunkId: string;
    documentId: string;
    projectId: string;
    content: string;
    hash: string;
    tokens: number;
    startIndex: number;
    endIndex: number;
    chunkIndex: number;
    totalChunks: number;
    filePath?: string;
    language?: string;
    // AST-specific properties
    astNodeType?: string;
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
    createdAt: string;
    updatedAt: string;
  };
}

// Document node for Neo4j
export interface DocumentGraphNode extends GraphNode {
  type: GraphNodeType.DOCUMENT;
  properties: {
    documentId: string;
    projectId: string;
    title: string;
    filePath: string;
    language?: string;
    sourceType: string;
    sourceId: string;
    author?: string;
    totalChunks: number;
    totalTokens: number;
    createdAt: string;
    updatedAt: string;
  };
}

// Project node for Neo4j
export interface ProjectGraphNode extends GraphNode {
  type: GraphNodeType.PROJECT;
  properties: {
    projectId: string;
    name: string;
    description?: string;
    language?: string;
    framework?: string;
    totalDocuments: number;
    totalChunks: number;
    createdAt: string;
    updatedAt: string;
  };
}

// Graph query interface
export interface GraphQuery {
  cypher: string;
  parameters?: Record<string, any>;
  database?: string;
}

// Graph query result
export interface GraphQueryResult {
  records: GraphRecord[];
  summary: {
    queryType: string;
    counters: {
      nodesCreated: number;
      nodesDeleted: number;
      relationshipsCreated: number;
      relationshipsDeleted: number;
      propertiesSet: number;
      labelsAdded: number;
      labelsRemoved: number;
      indexesAdded: number;
      indexesRemoved: number;
      constraintsAdded: number;
      constraintsRemoved: number;
    };
    plan?: any;
    profile?: any;
    notifications?: any[];
    resultAvailableAfter: number;
    resultConsumedAfter: number;
  };
}

// Graph record (single result row)
export interface GraphRecord {
  keys: string[];
  length: number;
  get(key: string | number): any;
  has(key: string | number): boolean;
  toObject(): Record<string, any>;
}

// Graph traversal options
export interface GraphTraversalOptions {
  maxDepth?: number;
  relationshipTypes?: GraphRelationshipType[];
  nodeTypes?: GraphNodeType[];
  direction?: 'INCOMING' | 'OUTGOING' | 'BOTH';
  limit?: number;
  skip?: number;
  orderBy?: {
    property: string;
    direction: 'ASC' | 'DESC';
  }[];
}

// Graph search options
export interface GraphSearchOptions {
  nodeTypes?: GraphNodeType[];
  relationshipTypes?: GraphRelationshipType[];
  properties?: Record<string, any>;
  textSearch?: {
    property: string;
    query: string;
    fuzzy?: boolean;
  };
  traversal?: GraphTraversalOptions;
  limit?: number;
  skip?: number;
}

// Graph analytics result
export interface GraphAnalyticsResult {
  nodeCount: number;
  relationshipCount: number;
  nodeTypeDistribution: Record<GraphNodeType, number>;
  relationshipTypeDistribution: Record<GraphRelationshipType, number>;
  averageDegree: number;
  maxDegree: number;
  connectedComponents: number;
  density: number;
  diameter?: number;
  clustering?: {
    global: number;
    average: number;
  };
}

// Graph path result
export interface GraphPath {
  start: GraphNode;
  end: GraphNode;
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
  weight?: number;
}

// Graph centrality metrics
export interface GraphCentralityMetrics {
  nodeId: string;
  degree: number;
  betweenness?: number;
  closeness?: number;
  eigenvector?: number;
  pageRank?: number;
}

// Graph community detection result
export interface GraphCommunity {
  id: string;
  nodes: string[];
  size: number;
  modularity?: number;
  density?: number;
}

// Graph service interface
export interface IGraphService {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;

  // Node operations
  createNode(node: GraphNode): Promise<GraphNode>;
  updateNode(id: string, properties: Record<string, any>): Promise<GraphNode>;
  deleteNode(id: string): Promise<boolean>;
  findNode(id: string): Promise<GraphNode | null>;
  findNodes(options: GraphSearchOptions): Promise<GraphNode[]>;

  // Relationship operations
  createRelationship(relationship: GraphRelationship): Promise<GraphRelationship>;
  deleteRelationship(id: string): Promise<boolean>;
  findRelationships(startNodeId: string, endNodeId?: string, type?: GraphRelationshipType): Promise<GraphRelationship[]>;

  // Batch operations
  batchCreateNodes(nodes: GraphNode[]): Promise<GraphNode[]>;
  batchCreateRelationships(relationships: GraphRelationship[]): Promise<GraphRelationship[]>;
  batchDelete(nodeIds: string[], relationshipIds?: string[]): Promise<boolean>;

  // Query operations
  executeQuery(query: GraphQuery): Promise<GraphQueryResult>;
  executeTransaction(queries: GraphQuery[]): Promise<GraphQueryResult[]>;

  // Traversal operations
  traverse(startNodeId: string, options: GraphTraversalOptions): Promise<GraphNode[]>;
  findPaths(startNodeId: string, endNodeId: string, options?: GraphTraversalOptions): Promise<GraphPath[]>;
  findShortestPath(startNodeId: string, endNodeId: string, options?: GraphTraversalOptions): Promise<GraphPath | null>;

  // Analytics operations
  getAnalytics(): Promise<GraphAnalyticsResult>;
  getCentralityMetrics(nodeIds?: string[]): Promise<GraphCentralityMetrics[]>;
  detectCommunities(algorithm?: 'louvain' | 'leiden' | 'label_propagation'): Promise<GraphCommunity[]>;

  // Search operations
  searchNodes(query: string, options?: GraphSearchOptions): Promise<GraphNode[]>;
  findSimilarNodes(nodeId: string, options?: GraphSearchOptions): Promise<GraphNode[]>;
  findRelatedNodes(nodeId: string, options?: GraphTraversalOptions): Promise<GraphNode[]>;
}

// Graph chunk service interface (extends IGraphService for chunk-specific operations)
export interface IGraphChunkService extends IGraphService {
  // New chunk-specific operations
  createCodeChunkNode(chunk: CodeChunkGraphNode): Promise<CodeChunkGraphNode>;
  batchCreateCodeChunkNodes(chunks: CodeChunkGraphNode[]): Promise<CodeChunkGraphNode[]>;
  findCodeChunks(options: GraphSearchOptions): Promise<CodeChunkGraphNode[]>;
  findRelatedCodeChunks(chunkId: string, options?: GraphTraversalOptions): Promise<CodeChunkGraphNode[]>;

  // Legacy chunk operations (deprecated)
  createChunkNode(chunk: ChunkGraphNode): Promise<ChunkGraphNode>;
  batchCreateChunkNodes(chunks: ChunkGraphNode[]): Promise<ChunkGraphNode[]>;
  findChunks(options: GraphSearchOptions): Promise<ChunkGraphNode[]>;
  findRelatedChunks(chunkId: string, options?: GraphTraversalOptions): Promise<ChunkGraphNode[]>;
  deleteChunkNode(chunkId: string): Promise<boolean>;
  deleteDocumentChunks(documentId: string): Promise<boolean>;

  // Chunk relationship operations
  createChunkRelationship(relationship: GraphRelationship): Promise<GraphRelationship>;
  batchCreateChunkRelationships(relationships: GraphRelationship[]): Promise<GraphRelationship[]>;

  // Chunk analytics
  getChunkStats(): Promise<{
    totalChunks: number;
    chunksByType: Record<string, number>;
    chunksByLanguage: Record<string, number>;
    averageComplexity: number;
    relationshipCounts: Record<GraphRelationshipType, number>;
  }>;

  // Enhanced chunk queries
  findChunksByContent(content: string, limit?: number): Promise<CodeChunkGraphNode[]>;
  findChunksByFunction(functionName: string, limit?: number): Promise<CodeChunkGraphNode[]>;
  findChunksByFile(filePath: string, limit?: number): Promise<CodeChunkGraphNode[]>;
  findChunksByType(type: 'MODULE' | 'CLASS' | 'FUNCTION' | 'METHOD' | 'INTERFACE' | 'TYPE', limit?: number): Promise<CodeChunkGraphNode[]>;
  findChunksByPurpose(purposeCategory: string, limit?: number): Promise<CodeChunkGraphNode[]>;
  getChunkCallGraph(chunkId: string, maxDepth?: number): Promise<GraphPath[]>;
  getChunkDependencies(chunkId: string, maxDepth?: number): Promise<CodeChunkGraphNode[]>;
  findSimilarChunks(chunkId: string, limit?: number): Promise<CodeChunkGraphNode[]>;
}

// Graph operation result
export interface GraphOperationResult {
  success: boolean;
  operation: string;
  nodesAffected?: number;
  relationshipsAffected?: number;
  executionTime: number;
  error?: string;
  details?: any;
}

// Graph transaction context
export interface GraphTransaction {
  id: string;
  isOpen: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  run(query: string, parameters?: Record<string, any>): Promise<GraphQueryResult>;
}

// Graph index configuration
export interface GraphIndexConfig {
  label: string;
  properties: string[];
  type: 'BTREE' | 'FULLTEXT' | 'LOOKUP';
  name?: string;
}

// Graph constraint configuration
export interface GraphConstraintConfig {
  label: string;
  properties: string[];
  type: 'UNIQUE' | 'EXISTS' | 'NODE_KEY';
  name?: string;
}

// Graph schema information
export interface GraphSchema {
  labels: string[];
  relationshipTypes: string[];
  propertyKeys: string[];
  indexes: GraphIndexConfig[];
  constraints: GraphConstraintConfig[];
}

// Export all types for easy importing
export * from './embeddings';