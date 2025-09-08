import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';
import { CodeChunk } from '@/core/types/embeddings';
import { logger } from '@/core/utils/logger';

// Qdrant Configuration
const qdrantConfig = {
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || '',
  collectionName: process.env.QDRANT_COLLECTION_NAME || 'hikma-embeddings',
  dimension: parseInt(process.env.QDRANT_DIMENSION || '768', 10), // LM Studio nomic-embed-text dimensions
  distance: process.env.QDRANT_DISTANCE || 'Cosine', // Cosine, Euclidean, Dot
  maxRetries: parseInt(process.env.QDRANT_MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.QDRANT_RETRY_DELAY || '1000', 10),
  timeoutMs: parseInt(process.env.QDRANT_TIMEOUT || '30000', 10),
};

// Create Qdrant client
export const qdrant = new QdrantClient({
  url: qdrantConfig.url,
  apiKey: qdrantConfig.apiKey,
  timeout: qdrantConfig.timeoutMs,
});

// Vector database management
export class VectorDbManager {
  private static instance: VectorDbManager;
  private qdrant: QdrantClient;
  private isConnected = false;
  private collectionName: string;

  private constructor() {
    this.qdrant = qdrant;
    this.collectionName = qdrantConfig.collectionName;
  }

  public static getInstance(): VectorDbManager {
    if (!VectorDbManager.instance) {
      VectorDbManager.instance = new VectorDbManager();
    }
    return VectorDbManager.instance;
  }

  public async connect(): Promise<void> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= qdrantConfig.maxRetries; attempt++) {
      try {
        // Check if collection exists, create if not
        const collections = await this.qdrant.getCollections();
        const collectionExists = collections.collections.some(
          (col: any) => col.name === this.collectionName
        );

        if (!collectionExists) {
          logger.info(`Collection '${this.collectionName}' not found, creating it.`);
          await this.qdrant.createCollection(this.collectionName, {
            vectors: {
              size: qdrantConfig.dimension,
              distance: qdrantConfig.distance as any,
            },
          });
          logger.info(`Collection '${this.collectionName}' created successfully.`);
        }

        // Test connection by getting collection info
        await this.qdrant.getCollection(this.collectionName);

        this.isConnected = true;
        logger.info(
          {
            url: qdrantConfig.url,
            collectionName: this.collectionName,
            attempt,
          },
          'Qdrant connected successfully'
        );
        return;
      } catch (error: any) {
        lastError = error;
        logger.warn({ 
          error: error.message, 
          attempt, 
          maxRetries: qdrantConfig.maxRetries 
        }, 'Qdrant connection attempt failed');
        
        if (attempt < qdrantConfig.maxRetries) {
          await this.delay(qdrantConfig.retryDelayMs * attempt);
        }
      }
    }
    
    logger.error({ error: lastError }, 'Failed to connect to Qdrant after all retries');
    throw lastError;
  }

  public async disconnect(): Promise<void> {
    try {
      // Qdrant client doesn't require explicit disconnection
      this.isConnected = false;
      logger.info('Qdrant disconnected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to disconnect from Qdrant');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Try to get collections as a health check since healthCheck might not exist
      await this.qdrant.getCollections();
      return true;
    } catch (error) {
      logger.error({ error }, 'Qdrant health check failed');
      return false;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public getClient(): QdrantClient {
    return this.qdrant;
  }

  public getCollectionName(): string {
    return this.collectionName;
  }
}

// Chunk payload interface for Qdrant (aligned with CodeChunk schema)
export interface ChunkPayload {
  chunk_id: string;
  content: string;
  file_id: string;
  repository_id?: string;
  project_id?: string;
  
  // Position information
  start_line: number;
  end_line: number;
  start_column?: number;
  end_column?: number;
  
  // File information
  file_path: string;
  language: string;
  framework?: string;
  
  // Tree-sitter metadata
  node_type: string;
  node_name?: string;
  signature?: string;
  
  // Classification
  purpose_category: string;
  complexity_score: number;
  cognitive_complexity: number;
  
  // Content metrics
  line_count: number;
  token_count: number;
  
  // Hierarchical information
  depth_level: number;
  domain_tags: string[];
  patterns: string[];
  
  // Relationship counts
  num_callers: number;
  num_callees: number;
  num_imports: number;
  
  // Flags
  has_docstring: boolean;
  has_error_handling: boolean;
  has_tests: boolean;
  is_exported: boolean;
  is_async: boolean;
  is_generator: boolean;
  is_static: boolean;
  
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  original_chunk_id?: string; // Added for UUID conversion support
  [key: string]: unknown;
}

// Chunk search result interface
export interface ChunkSearchResult {
  id: string;
  score: number;
  payload: ChunkPayload;
  vector?: number[];
}

// Chunk search response interface
export interface ChunkSearchResponse {
  results: ChunkSearchResult[];
  total: number;
  query_time: number;
}

// Vector operations service
export class VectorService {
  private qdrant: QdrantClient;
  private collectionName: string;

  constructor() {
    this.qdrant = VectorDbManager.getInstance().getClient();
    this.collectionName = VectorDbManager.getInstance().getCollectionName();
  }

  async upsert(
    vectors: Array<{
      id: string;
      values: number[];
      metadata?: Record<string, any>;
    }>,
    namespace?: string
  ): Promise<void> {
    try {
      const points = vectors.map((v) => ({
        id: v.id,
        vector: v.values,
        payload: v.metadata,
      }));

      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        batch: {
          ids: points.map((p) => p.id),
          vectors: points.map((p) => p.vector),
          payloads: points.map((p) => p.payload || {}),
        },
      });

      logger.debug(
        {
          vectorCount: vectors.length,
          namespace: namespace || 'default',
        },
        'Vectors upserted successfully'
      );
    } catch (error) {
      logger.error({ error, vectorCount: vectors.length }, 'Failed to upsert vectors');
      throw error;
    }
  }

  async query(
    vector: number[],
    options: {
      topK?: number;
      filter?: Record<string, any>;
      includeMetadata?: boolean;
      includeValues?: boolean;
      namespace?: string;
    } = {}
  ): Promise<any> {
    try {
      const {
        topK = 10,
        filter,
        includeMetadata = true,
        includeValues = false,
        namespace,
      } = options;

      const result = await this.qdrant.search(this.collectionName, {
        vector,
        limit: topK,
        filter: filter ? { must: Object.entries(filter).map(([key, value]) => ({ key, match: { value } })) } : undefined,
        with_payload: includeMetadata,
        with_vector: includeValues,
        // Qdrant does not directly support namespaces in search, but you can filter by a 'namespace' field in metadata if you implement it
      });

      logger.debug(
        {
          topK,
          matchCount: result.length || 0,
          namespace: namespace || 'default',
        },
        'Vector query executed successfully'
      );

      return { matches: result }; // Align with Pinecone's result structure
    } catch (error) {
      logger.error({ error, options }, 'Failed to query vectors');
      throw error;
    }
  }

  async queryById(
    id: string,
    options: {
      topK?: number;
      filter?: Record<string, any>;
      includeMetadata?: boolean;
      includeValues?: boolean;
      namespace?: string;
    } = {}
  ): Promise<any> {
    try {
      const {
        topK = 10,
        filter,
        includeMetadata = true,
        includeValues = false,
        namespace,
      } = options;

      // For queryById, we can fetch the point directly and then perform a search if needed
      const point = await this.qdrant.retrieve(this.collectionName, {
        ids: [id],
        with_payload: includeMetadata,
        with_vector: includeValues,
      });

      if (point.length === 0) {
        return { matches: [] };
      }

      // If a filter is provided, we might need to re-evaluate or perform a search based on the vector
      // For simplicity, if a filter is present, we'll perform a search using the retrieved vector
      if (filter && point[0].vector) {
        return this.query(point[0].vector as number[], options);
      }

      // Otherwise, return the retrieved point as a match
      return {
        matches: [
          {
            id: point[0].id,
            score: 1.0, // Perfect match by ID
            values: point[0].vector,
            metadata: point[0].payload,
          },
        ],
      };
    } catch (error) {
      logger.error({ error, id, options }, 'Failed to query vectors by ID');
      throw error;
    }
  }

  async fetch(
    ids: string[],
    namespace?: string
  ): Promise<any> {
    try {
      const result = await this.qdrant.retrieve(this.collectionName, {
        ids: ids,
        with_payload: true,
        with_vector: true,
      });

      const vectors: Record<string, any> = {};
      result.forEach((point: any) => {
        vectors[point.id] = {
          id: point.id,
          values: point.vector,
          metadata: point.payload,
        };
      });

      logger.debug(
        {
          idCount: ids.length,
          namespace: namespace || 'default',
        },
        'Vectors fetched successfully'
      );

      return { vectors }; // Align with Pinecone's result structure
    } catch (error) {
      logger.error({ error, ids }, 'Failed to fetch vectors');
      throw error;
    }
  }

  async deleteVectors(
    ids: string[],
    namespace?: string
  ): Promise<void> {
    try {
      await this.qdrant.delete(this.collectionName, {
        points: ids,
        wait: true,
      });

      logger.debug(
        {
          idCount: ids.length,
          namespace: namespace || 'default',
        },
        'Vectors deleted successfully'
      );
    } catch (error) {
      logger.error({ error, ids }, 'Failed to delete vectors');
      throw error;
    }
  }

  async deleteAll(namespace?: string): Promise<void> {
    try {
      // Qdrant deletes by filter or all points in a collection
      // To delete all, we can recreate the collection or delete all points
      // Recreating is often cleaner for a full wipe
      await this.qdrant.deleteCollection(this.collectionName);
      await this.qdrant.createCollection(this.collectionName, {
        vectors: {
          size: qdrantConfig.dimension,
          distance: qdrantConfig.distance as any,
        },
      });

      logger.info(
        {
          namespace: namespace || 'default',
        },
        'All vectors deleted successfully'
      );
    } catch (error) {
      logger.error({ error, namespace }, 'Failed to delete all vectors');
      throw error;
    }
  }

  async getStats(namespace?: string): Promise<any> {
    try {
      const stats = await this.qdrant.getCollection(this.collectionName);

      logger.debug(
        {
          namespace: namespace || 'default',
          stats,
        },
        'Collection stats retrieved successfully'
      );

      return {
        dimension: qdrantConfig.dimension,
        totalVectorCount: stats.points_count || 0,
        namespaces: {
          // Qdrant doesn't have direct namespace stats like Pinecone, simulate if needed
          default: {
            vectorCount: stats.points_count || 0,
          },
        },
      }; // Align with Pinecone's result structure
    } catch (error) {
      logger.error({ error, namespace }, 'Failed to get collection stats');
      throw error;
    }
  }

  async update(
    id: string,
    options: {
      values?: number[];
      metadata?: Record<string, any>;
      namespace?: string;
    }
  ): Promise<void> {
    try {
      const { values, metadata } = options;

      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: id,
            vector: values || [],
            payload: metadata,
          },
        ],
      });

      logger.debug(
        {
          id,
          hasValues: !!values,
          hasMetadata: !!metadata,
          namespace: options?.namespace || 'default',
        },
        'Vector updated successfully'
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          id,
          namespace: options?.namespace || 'default',
        },
        'Failed to update vector'
      );
      throw error;
    }
  }

  /**
   * Generate a valid UUID-format point ID from a chunk ID
   */
  private generateValidPointId(chunkId: string): string {
    // Convert cuid to UUID format by hashing and formatting
    const hash = createHash('md5').update(chunkId).digest('hex');
    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  /**
   * Upsert a document chunk with its embedding to Qdrant
   */
  async upsertChunk(
    chunk: CodeChunk & { file?: { repository?: { id: string; dataSource?: { projectId: string } }; filePath: string; language?: string; framework?: string } },
    embedding: number[],
    projectId?: string
  ): Promise<void> {
    try {
      // Calculate content metrics
      const lines = chunk.codeContent.split('\n');
      const lineCount = lines.length;
      const tokenCount = chunk.codeContent.split(/\s+/).length;
      
      // Get repository and file information from relations
      const repositoryId = chunk.file?.repository?.id;
      const actualProjectId = projectId || chunk.file?.repository?.dataSource?.projectId;
      const filePath = chunk.file?.filePath || '';
      const language = chunk.file?.language || '';
      const framework = chunk.file?.framework || '';
      
      const payload: ChunkPayload = {
        chunk_id: chunk.id,
        content: chunk.codeContent,
        file_id: chunk.fileId,
        project_id: actualProjectId,
        
        // Position information
        start_line: chunk.startLine,
        end_line: chunk.endLine,
        start_column: chunk.startColumn || undefined,
        end_column: chunk.endColumn || undefined,
        
        // File information
        file_path: filePath,
        language: language,
        framework: framework,
        
        // Repository information
        repository_id: repositoryId,
        
        // Tree-sitter metadata
        node_type: chunk.nodeType,
        node_name: chunk.nodeName || undefined,
        signature: chunk.signature || undefined,
        
        // Classification
        purpose_category: chunk.purposeCategory || 'unknown',
        complexity_score: chunk.complexityScore || 0,
        cognitive_complexity: chunk.cognitiveComplexity || 0,
        
        // Content metrics
        line_count: lineCount,
        token_count: tokenCount,
        
        // Hierarchical information (defaults - can be enhanced later)
        depth_level: chunk.parentChunkId ? 1 : 0, // 0 for root chunks, 1+ for nested
        domain_tags: [], // Can be populated based on file path analysis
        patterns: [], // Can be populated based on AST analysis
        
        // Relationship counts (defaults - would need separate analysis)
        num_callers: 0,
        num_callees: 0,
        num_imports: 0,
        
        // Flags
        has_docstring: chunk.hasDocstring,
        has_error_handling: chunk.hasErrorHandling,
        has_tests: chunk.hasTests,
        is_exported: chunk.isExported,
        is_async: chunk.isAsync,
        is_generator: chunk.isGenerator,
        is_static: chunk.isStatic,
        
        // Enhanced metadata with useful contextual information
        metadata: {
          chunk_hierarchy: chunk.parentChunkId ? 'nested' : 'root',
          embedding_version: chunk.embeddingVersion || 'v1',
          has_cleaned_content: !!chunk.cleanedContent,
          content_length: chunk.codeContent.length,
          indexed_at: new Date().toISOString(),
        },
        created_at: chunk.createdAt.toISOString(),
        updated_at: chunk.updatedAt.toISOString(),
      };

      // Convert chunk ID to a valid Qdrant point ID (UUID format)
      const pointId = this.generateValidPointId(chunk.id);
      payload.original_chunk_id = chunk.id; // Store original chunk ID in payload
      
      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: pointId,
            vector: embedding,
            payload,
          },
        ],
      });

      logger.debug(
        {
          chunkId: chunk.id,
          fileId: chunk.fileId,
          projectId,
          embeddingSize: embedding.length,
        },
        'Chunk upserted to Qdrant successfully'
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          chunkId: chunk.id,
          fileId: chunk.fileId,
          stack: error instanceof Error ? error.stack : undefined,
          fullError: error,
          response: (error as any)?.response?.data || (error as any)?.response,
        },
        'Failed to upsert chunk to Qdrant'
      );
      throw error;
    }
  }

  /**
   * Search for similar chunks using semantic search
   */
  async searchChunks(
    queryEmbedding: number[],
    options: {
      limit?: number;
      projectId?: string;
      fileId?: string;
      repositoryId?: string;
      scoreThreshold?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<ChunkSearchResponse> {
    const startTime = Date.now();
    
    try {
      const {
        limit = 10,
        projectId,
        fileId,
        repositoryId,
        scoreThreshold = 0.7,
        filter = {},
      } = options;

      // Build filter conditions
      const searchFilter: Record<string, any> = { ...filter };
      
      if (projectId) {
        searchFilter.project_id = projectId;
      }
      
      if (fileId) {
        searchFilter.file_id = fileId;
      }
      
      if (repositoryId) {
        searchFilter.repository_id = repositoryId;
      }

      const searchResult = await this.qdrant.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        filter: Object.keys(searchFilter).length > 0 ? {
          must: Object.entries(searchFilter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        } : undefined,
        score_threshold: scoreThreshold,
        with_payload: true,
        with_vector: false,
      });

      const results: ChunkSearchResult[] = searchResult.map((result: any) => ({
        id: result.payload.original_chunk_id || result.id, // Use original chunk ID from payload
        score: result.score,
        payload: result.payload as ChunkPayload,
      }));

      const queryTime = Date.now() - startTime;

      logger.debug(
        {
          queryTime,
          resultsCount: results.length,
          projectId,
          fileId,
          repositoryId,
          scoreThreshold,
        },
        'Chunk search completed'
      );

      return {
        results,
        total: results.length,
        query_time: queryTime,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          projectId: options.projectId,
          fileId: options.fileId,
          repositoryId: options.repositoryId,
        },
        'Failed to search chunks'
      );
      throw error;
    }
  }
}

// Export singleton instances
export const vectorDbManager = VectorDbManager.getInstance();
export const vectorService = new VectorService();

// Graceful shutdown handling
process.on('beforeExit', async () => {
  await vectorDbManager.disconnect();
});

process.on('SIGINT', async () => {
  await vectorDbManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await vectorDbManager.disconnect();
  process.exit(0);
});


