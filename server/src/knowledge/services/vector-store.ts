import { QdrantClient } from '@qdrant/js-client-rest';
import {
  IVectorStore,
  VectorStoreConfig,
  VectorRecord,
  VectorSearchQuery,
  VectorSearchResponse,
  VectorSearchResult,
  VectorOperationResponse,
  VectorOperation,
  VectorOperationError,
  VectorStoreStats,
  VectorMetadata,
} from '@/core/types/embeddings';
import { config } from '@/config/app';
import { logger } from '@/core/utils/logger';
import { ExternalServiceError } from '@/core/errors/app-error';

// Qdrant vector store implementation
export class QdrantVectorStore implements IVectorStore {
  private client: QdrantClient;
  private connected: boolean = false;
  private collectionName: string;
  private dimensions: number;
  private distance: string;

  constructor(private storeConfig: VectorStoreConfig) {
    this.collectionName = storeConfig.indexName; // Qdrant uses collectionName instead of indexName
    this.dimensions = storeConfig.dimensions;
    this.distance = this.mapDistanceMetric(storeConfig.metric); // Map to Qdrant distance format

    this.client = new QdrantClient({
      url: storeConfig.baseUrl || config.vectorDb.url,
      apiKey: storeConfig.apiKey || config.vectorDb.apiKey,
    });
  }

  private mapDistanceMetric(metric: string): string {
    const metricMap: Record<string, string> = {
      'cosine': 'Cosine',
      'euclidean': 'Euclid',
      'dotproduct': 'Dot'
    };
    return metricMap[metric] || 'Cosine';
  }

  async connect(): Promise<void> {
    try {
      logger.info({ collectionName: this.collectionName }, 'Connecting to Qdrant vector store');

      // Check if collection exists, create if not
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName
      );

      if (!collectionExists) {
        logger.info(`Collection '${this.collectionName}' not found, creating it.`);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.dimensions,
            distance: this.distance as "Cosine" | "Euclid" | "Dot" | "Manhattan",
          },
        });
        logger.info(`Collection '${this.collectionName}' created successfully.`);
      }

      // Test connection by getting collection info
      await this.client.getCollection(this.collectionName);

      this.connected = true;

      logger.info({ collectionName: this.collectionName }, 'Connected to Qdrant vector store successfully');
    } catch (error) {
      this.connected = false;
      logger.error({
        collectionName: this.collectionName,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to connect to Qdrant vector store');

      throw new ExternalServiceError(
        'Failed to connect to Qdrant vector store',
        { collectionName: this.collectionName, originalError: error }
      );
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info({ collectionName: this.collectionName }, 'Disconnected from Qdrant vector store');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Try to get collections as a health check since healthCheck might not exist
      await this.client.getCollections();
      return true;
    } catch (error) {
      logger.error({
        collectionName: this.collectionName,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Qdrant connection test failed');
      return false;
    }
  }

  async createIndex(config: VectorStoreConfig): Promise<void> {
    try {
      const qdrantDistance = this.mapDistanceMetric(config.metric);
      
      logger.info({
        collectionName: config.indexName,
        dimensions: config.dimensions,
        metric: config.metric,
        qdrantDistance,
      }, 'Creating Qdrant collection');

      await this.client.createCollection(config.indexName, {
        vectors: {
          size: config.dimensions,
          distance: qdrantDistance as "Cosine" | "Euclid" | "Dot" | "Manhattan",
        },
      });

      logger.info({ collectionName: config.indexName }, 'Qdrant collection created successfully');
    } catch (error) {
      logger.error({
        collectionName: config.indexName,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to create Qdrant collection');

      throw new ExternalServiceError(
        'Failed to create Qdrant collection',
        { collectionName: config.indexName, originalError: error }
      );
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      logger.info({ collectionName: indexName }, 'Deleting Qdrant collection');

      await this.client.deleteCollection(indexName);

      logger.info({ collectionName: indexName }, 'Qdrant collection deleted successfully');
    } catch (error) {
      logger.error({
        collectionName: indexName,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to delete Qdrant collection');

      throw new ExternalServiceError(
        'Failed to delete Qdrant collection',
        { collectionName: indexName, originalError: error }
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const response = await this.client.getCollections();
      return response.collections?.map(col => col.name) || [];
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to list Qdrant collections');

      throw new ExternalServiceError(
        'Failed to list Qdrant collections',
        { originalError: error }
      );
    }
  }

  async getIndexStats(indexName?: string): Promise<VectorStoreStats> {
    try {
      const targetCollection = indexName || this.collectionName;
      const stats = await this.client.getCollection(targetCollection);

      return {
        totalVectors: stats.points_count || 0,
        dimensions: this.dimensions,
        indexSize: 0, // Qdrant doesn't provide this directly
        namespaces: [], // Qdrant doesn't have direct namespaces like Pinecone
        lastUpdated: new Date(),
        metrics: {
          queriesPerSecond: 0, // Would need separate monitoring
          averageQueryLatency: 0, // Would need separate monitoring
          indexUtilization: 0, // Would need calculation
        },
      };
    } catch (error) {
      logger.error({
        collectionName: indexName || this.collectionName,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get Qdrant collection stats');

      throw new ExternalServiceError(
        'Failed to get Qdrant collection stats',
        { collectionName: indexName || this.collectionName, originalError: error }
      );
    }
  }

  async upsert(vectors: VectorRecord[], namespace?: string): Promise<VectorOperationResponse> {
    const startTime = Date.now();

    try {
      if (!this.isConnected()) {
        throw new Error('Vector store not connected');
      }

      const points = vectors.map(vector => ({
        id: vector.id,
        vector: vector.vectors?.code || vector.values || [],
        payload: vector.payload || vector.metadata,
      }));

      await this.client.upsert(this.collectionName, {
        wait: true,
        batch: {
          ids: points.map(p => p.id),
          vectors: points.map(p => p.vector),
          payloads: points.map(p => p.payload as unknown as Record<string, unknown>),
        },
      });

      const executionTime = Date.now() - startTime;

      logger.debug({
        vectorCount: vectors.length,
        namespace,
        executionTime,
      }, 'Upserted vectors to Qdrant');

      return {
        success: true,
        operation: VectorOperation.UPSERT,
        processedCount: vectors.length,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        vectorCount: vectors.length,
        namespace,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to upsert vectors to Qdrant');

      return {
        success: false,
        operation: VectorOperation.UPSERT,
        processedCount: 0,
        errors: [{
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'UPSERT_FAILED',
          details: error,
        }] as VectorOperationError[],
        executionTime,
      };
    }
  }

  async delete(ids: string[], namespace?: string): Promise<VectorOperationResponse> {
    const startTime = Date.now();

    try {
      if (!this.isConnected()) {
        throw new Error('Vector store not connected');
      }

      await this.client.delete(this.collectionName, {
        points: ids,
        wait: true,
      });

      const executionTime = Date.now() - startTime;

      logger.debug({
        idCount: ids.length,
        namespace,
        executionTime,
      }, 'Deleted vectors from Qdrant');

      return {
        success: true,
        operation: VectorOperation.DELETE,
        processedCount: ids.length,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        idCount: ids.length,
        namespace,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to delete vectors from Qdrant');

      return {
        success: false,
        operation: VectorOperation.DELETE,
        processedCount: 0,
        errors: [{
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'DELETE_FAILED',
          details: error,
        }],
        executionTime,
      };
    }
  }

  async fetch(ids: string[], namespace?: string): Promise<VectorRecord[]> {
    try {
      if (!this.isConnected()) {
        throw new Error('Vector store not connected');
      }

      const response = await this.client.retrieve(this.collectionName, {
        ids: ids,
        with_payload: true,
        with_vector: true,
      });

      const vectors: VectorRecord[] = response.map(point => ({
        id: point.id as string,
        vectors: {
          code: point.vector as number[]
        },
        payload: (point.payload as unknown) as any || {},
        values: point.vector as number[],
        metadata: (point.payload as unknown) as VectorMetadata || {} as VectorMetadata,
      }));

      logger.debug({
        requestedCount: ids.length,
        foundCount: vectors.length,
        namespace,
      }, 'Fetched vectors from Qdrant');

      return vectors;

    } catch (error) {
      logger.error({
        idCount: ids.length,
        namespace,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to fetch vectors from Qdrant');

      throw new ExternalServiceError(
        'Failed to fetch vectors from Qdrant',
        { idCount: ids.length, namespace, originalError: error }
      );
    }
  }

  async query(query: VectorSearchQuery): Promise<VectorSearchResponse> {
    const startTime = Date.now();

    try {
      if (!this.isConnected()) {
        throw new Error('Vector store not connected');
      }

      // Build Qdrant query
      const qdrantFilter = query.filter ? { must: Object.entries(query.filter).map(([key, value]) => ({ key, match: { value } })) } : undefined;

      const response = await this.client.search(this.collectionName, {
        vector: query.vector || [],
        limit: query.topK,
        filter: qdrantFilter,
        with_payload: query.includeMetadata !== false,
        with_vector: query.includeValues || false,
      });

      // Convert results
      const results: VectorSearchResult[] = response.map((match: any) => ({
        id: match.id,
        score: match.score,
        payload: match.payload || {},
        vectors: {
          code: match.vector
        },
        metadata: match.payload || {},
        values: match.vector,
      }));

      const executionTime = Date.now() - startTime;

      logger.debug({
        topK: query.topK,
        resultCount: results.length,
        namespace: query.namespace,
        executionTime,
      }, 'Queried vectors from Qdrant');

      return {
        results,
        query,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        topK: query.topK,
        namespace: query.namespace,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to query vectors from Qdrant');

      throw new ExternalServiceError(
        'Failed to query vectors from Qdrant',
        { query, executionTime, originalError: error }
      );
    }
  }

  async batchUpsert(
    vectors: VectorRecord[],
    batchSize: number = 100,
    namespace?: string
  ): Promise<VectorOperationResponse> {
    const startTime = Date.now();
    let totalProcessed = 0;
    const errors: VectorOperationError[] = [];

    try {
      // Process in batches
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        
        try {
          const result = await this.upsert(batch, namespace);
          if (result.success) {
            totalProcessed += result.processedCount || 0;
          } else {
            errors.push(...(result.errors || []));
          }
        } catch (error) {
          errors.push({
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'BATCH_UPSERT_FAILED',
            details: { batchIndex: Math.floor(i / batchSize), batchSize: batch.length },
          });
        }
      }

      const executionTime = Date.now() - startTime;

      logger.info({
        totalVectors: vectors.length,
        processedVectors: totalProcessed,
        batchSize,
        batchCount: Math.ceil(vectors.length / batchSize),
        errorCount: errors.length,
        executionTime,
      }, 'Completed batch upsert to Qdrant');

      return {
        success: errors.length === 0,
        operation: VectorOperation.UPSERT,
        processedCount: totalProcessed,
        errors: errors.length > 0 ? errors : undefined,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        totalVectors: vectors.length,
        processedVectors: totalProcessed,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed batch upsert to Qdrant');

      return {
        success: false,
        operation: VectorOperation.UPSERT,
        processedCount: totalProcessed,
        errors: [{
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'BATCH_UPSERT_FAILED',
          details: error,
        }],
        executionTime,
      };
    }
  }

  async batchDelete(
    ids: string[],
    batchSize: number = 1000,
    namespace?: string
  ): Promise<VectorOperationResponse> {
    const startTime = Date.now();
    let totalProcessed = 0;
    const errors: VectorOperationError[] = [];

    try {
      // Process in batches
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        try {
          const result = await this.delete(batch, namespace);
          if (result.success) {
            totalProcessed += result.processedCount || 0;
          } else {
            errors.push(...(result.errors || []));
          }
        } catch (error) {
          errors.push({
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'BATCH_DELETE_FAILED',
            details: { batchIndex: Math.floor(i / batchSize), batchSize: batch.length },
          });
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        success: errors.length === 0,
        operation: VectorOperation.DELETE,
        processedCount: totalProcessed,
        errors: errors.length > 0 ? errors : undefined,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        operation: VectorOperation.DELETE,
        processedCount: totalProcessed,
        errors: [{
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'BATCH_DELETE_FAILED',
          details: error,
        }],
        executionTime,
      };
    }
  }

  async listNamespaces(): Promise<string[]> {
    // Qdrant does not have direct namespaces like Pinecone. 
    // If you need to simulate namespaces, you would typically use a metadata field.
    // For now, we return an empty array or a default namespace if applicable.
    return []; 
  }

  async deleteNamespace(namespace: string): Promise<void> {
    // Qdrant does not have direct namespaces to delete. 
    // If you need to delete points within a 'namespace' metadata field, you'd use a filter.
    // For now, this operation is a no-op or throws an error if not supported.
    logger.warn({ namespace }, 'Delete namespace operation is not directly supported in Qdrant. Consider deleting points by metadata filter.');
    throw new Error('Delete namespace not directly supported in Qdrant. Use delete with filter on metadata.');
  }

  // Helper to convert filter object to Qdrant format
  private convertFilter(filter: Record<string, any>): any {
    const must: any[] = [];
    for (const key in filter) {
      if (Object.prototype.hasOwnProperty.call(filter, key)) {
        const value = filter[key];
        must.push({
          key,
          match: { value },
        });
      }
    }
    return { must };
  }

  async update(
    id: string,
    options: {
      values?: number[];
      metadata?: Record<string, any>;
      namespace?: string; // Namespace is not directly used for update in Qdrant
    }
  ): Promise<void> {
    try {
      const { values, metadata } = options;

      await this.client.upsert(this.collectionName, {
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
        },
        'Vector updated successfully in Qdrant'
      );
    } catch (error) {
      logger.error({ error, id, options }, 'Failed to update vector in Qdrant');
      throw error;
    }
  }

  async getNamespaceStats(namespace: string): Promise<VectorStoreStats> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      
      return {
        totalVectors: info.points_count || 0,
        dimensions: typeof info.config?.params?.vectors?.size === 'number' 
          ? info.config.params.vectors.size 
          : (info.config?.params?.vectors?.size as any)?.size || 0,
        indexSize: 0, // Qdrant doesn't provide this directly
        namespaces: [namespace],
        lastUpdated: new Date(),
        metrics: {
          queriesPerSecond: 0,
          averageQueryLatency: 0,
          indexUtilization: 0,
        },
      };
    } catch (error) {
      logger.error({ error, namespace }, 'Failed to get namespace stats');
      throw error;
    }
  }
}


