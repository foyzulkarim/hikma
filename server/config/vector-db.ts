import { QdrantClient } from '@qdrant/qdrant-client';
import { logger } from '@/core/utils/logger.js';

// Qdrant Configuration
const qdrantConfig = {
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || '',
  collectionName: process.env.QDRANT_COLLECTION_NAME || 'hikma-embeddings',
  dimension: parseInt(process.env.QDRANT_DIMENSION || '1536', 10), // OpenAI text-embedding-3-small
  distance: process.env.QDRANT_DISTANCE || 'Cosine', // Cosine, Euclidean, Dot
};

// Create Qdrant client
export const qdrant = new QdrantClient({
  url: qdrantConfig.url,
  apiKey: qdrantConfig.apiKey,
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
    try {
      // Check if collection exists, create if not
      const collections = await this.qdrant.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName
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
        },
        'Qdrant connected successfully'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Qdrant');
      throw error;
    }
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
      const health = await this.qdrant.healthCheck();
      return health.status === 'ok';
    } catch (error) {
      logger.error({ error }, 'Qdrant health check failed');
      return false;
    }
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
          payloads: points.map((p) => p.payload),
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
        with_vectors: includeValues,
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
        with_vectors: includeValues,
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
        with_vectors: true,
      });

      const vectors: Record<string, any> = {};
      result.forEach(point => {
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
            vector: values,
            payload: metadata,
          },
        ],
      });

      logger.debug(
        {
          id,
          hasValues: !!values,
          hasMetadata: !!metadata,
          namespace: namespace || 'default',
        },
        'Vector updated successfully'
      );
    } catch (error) {
      logger.error({ error, id, options }, 'Failed to update vector');
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


