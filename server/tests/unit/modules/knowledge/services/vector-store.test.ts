import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QdrantVectorStore } from '@/modules/knowledge/services/vector-store.js';
import { qdrantMock, mockQdrantResponses } from '@tests/mocks/qdrant.mock.js';
import { ExternalServiceError } from '@/core/errors/app-error.js';

// Mock the Qdrant client
vi.mock('@qdrant/qdrant-client', () => ({
  QdrantClient: vi.fn(() => qdrantMock),
}));

describe('QdrantVectorStore', () => {
  let vectorStore: QdrantVectorStore;
  const mockConfig = {
    indexName: 'test-collection',
    dimensions: 1536,
    metric: 'Cosine',
    url: 'http://localhost:6333',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vectorStore = new QdrantVectorStore(mockConfig);
  });

  describe('connect', () => {
    it('should connect to Qdrant and create collection if it does not exist', async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [] });
      qdrantMock.createCollection.mockResolvedValueOnce({ status: 'ok' });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}}); // For test connection

      await vectorStore.connect();

      expect(qdrantMock.getCollections).toHaveBeenCalledTimes(1);
      expect(qdrantMock.createCollection).toHaveBeenCalledWith(mockConfig.indexName, {
        vectors: {
          size: mockConfig.dimensions,
          distance: mockConfig.metric as any,
        },
      });
      expect(qdrantMock.getCollection).toHaveBeenCalledWith(mockConfig.indexName);
      expect(vectorStore.isConnected()).toBe(true);
    });

    it('should connect to Qdrant if collection already exists', async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}}); // For test connection

      await vectorStore.connect();

      expect(qdrantMock.getCollections).toHaveBeenCalledTimes(1);
      expect(qdrantMock.createCollection).not.toHaveBeenCalled();
      expect(qdrantMock.getCollection).toHaveBeenCalledWith(mockConfig.indexName);
      expect(vectorStore.isConnected()).toBe(true);
    });

    it('should throw ExternalServiceError on connection failure', async () => {
      qdrantMock.getCollections.mockRejectedValueOnce(new Error('Network error'));

      await expect(vectorStore.connect()).rejects.toThrow(ExternalServiceError);
      expect(vectorStore.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should set connected status to false', async () => {
      await vectorStore.connect(); // Ensure connected first
      expect(vectorStore.isConnected()).toBe(true);

      await vectorStore.disconnect();
      expect(vectorStore.isConnected()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return true for a healthy connection', async () => {
      qdrantMock.healthCheck.mockResolvedValueOnce({ status: 'ok' });
      const result = await vectorStore.testConnection();
      expect(result).toBe(true);
    });

    it('should return false for an unhealthy connection', async () => {
      qdrantMock.healthCheck.mockResolvedValueOnce({ status: 'error' });
      const result = await vectorStore.testConnection();
      expect(result).toBe(false);
    });

    it('should return false on connection test error', async () => {
      qdrantMock.healthCheck.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await vectorStore.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('createIndex', () => {
    it('should create a new collection', async () => {
      qdrantMock.createCollection.mockResolvedValueOnce({ status: 'ok' });
      const newConfig = { ...mockConfig, indexName: 'new-collection' };
      await vectorStore.createIndex(newConfig);
      expect(qdrantMock.createCollection).toHaveBeenCalledWith(newConfig.indexName, {
        vectors: {
          size: newConfig.dimensions,
          distance: newConfig.metric as any,
        },
      });
    });

    it('should throw ExternalServiceError on createIndex failure', async () => {
      qdrantMock.createCollection.mockRejectedValueOnce(new Error('Failed to create'));
      const newConfig = { ...mockConfig, indexName: 'new-collection' };
      await expect(vectorStore.createIndex(newConfig)).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('deleteIndex', () => {
    it('should delete an existing collection', async () => {
      qdrantMock.deleteCollection.mockResolvedValueOnce({ status: 'ok' });
      await vectorStore.deleteIndex('collection-to-delete');
      expect(qdrantMock.deleteCollection).toHaveBeenCalledWith('collection-to-delete');
    });

    it('should throw ExternalServiceError on deleteIndex failure', async () => {
      qdrantMock.deleteCollection.mockRejectedValueOnce(new Error('Failed to delete'));
      await expect(vectorStore.deleteIndex('collection-to-delete')).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('listIndexes', () => {
    it('should list existing collections', async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: 'col1' }, { name: 'col2' }] });
      const result = await vectorStore.listIndexes();
      expect(result).toEqual(['col1', 'col2']);
    });

    it('should return empty array if no collections', async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [] });
      const result = await vectorStore.listIndexes();
      expect(result).toEqual([]);
    });

    it('should throw ExternalServiceError on listIndexes failure', async () => {
      qdrantMock.getCollections.mockRejectedValueOnce(new Error('API error'));
      await expect(vectorStore.listIndexes()).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('getIndexStats', () => {
    it('should return collection stats', async () => {
      qdrantMock.getCollection.mockResolvedValueOnce({
        status: 'ok',
        result: {
          points_count: 123,
          config: {
            params: {
              vectors: { size: 1536, distance: 'Cosine' },
            },
          },
        },
      });
      const stats = await vectorStore.getIndexStats();
      expect(stats.totalVectors).toBe(123);
      expect(stats.dimensions).toBe(1536);
      expect(stats.namespaces).toEqual([]); // Qdrant doesn't have direct namespaces
    });

    it('should throw ExternalServiceError on getIndexStats failure', async () => {
      qdrantMock.getCollection.mockRejectedValueOnce(new Error('Stats error'));
      await expect(vectorStore.getIndexStats()).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('upsert', () => {
    const mockVectors = [
      { id: '1', values: [0.1, 0.2], metadata: { key: 'value1' } },
      { id: '2', values: [0.3, 0.4], metadata: { key: 'value2' } },
    ];

    beforeEach(async () => {
      // Ensure connected state for upsert tests
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}});
      await vectorStore.connect();
    });

    it('should upsert vectors successfully', async () => {
      qdrantMock.upsert.mockResolvedValueOnce(mockQdrantResponses.upsert);
      const result = await vectorStore.upsert(mockVectors);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(mockVectors.length);
      expect(qdrantMock.upsert).toHaveBeenCalledTimes(1);
      expect(qdrantMock.upsert).toHaveBeenCalledWith(mockConfig.indexName, {
        wait: true,
        batch: {
          ids: ['1', '2'],
          vectors: [[0.1, 0.2], [0.3, 0.4]],
          payloads: [{ key: 'value1' }, { key: 'value2' }],
        },
      });
    });

    it('should return success: false on upsert failure', async () => {
      qdrantMock.upsert.mockRejectedValueOnce(new Error('Upsert failed'));
      const result = await vectorStore.upsert(mockVectors);
      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('UPSERT_FAILED');
    });

    it('should throw error if not connected', async () => {
      vi.clearAllMocks(); // Disconnect
      await expect(vectorStore.upsert(mockVectors)).rejects.toThrow('Vector store not connected');
    });
  });

  describe('delete', () => {
    const mockIds = ['1', '2'];

    beforeEach(async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}});
      await vectorStore.connect();
    });

    it('should delete vectors successfully', async () => {
      qdrantMock.delete.mockResolvedValueOnce(mockQdrantResponses.delete);
      const result = await vectorStore.delete(mockIds);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(mockIds.length);
      expect(qdrantMock.delete).toHaveBeenCalledTimes(1);
      expect(qdrantMock.delete).toHaveBeenCalledWith(mockConfig.indexName, {
        points: mockIds,
        wait: true,
      });
    });

    it('should return success: false on delete failure', async () => {
      qdrantMock.delete.mockRejectedValueOnce(new Error('Delete failed'));
      const result = await vectorStore.delete(mockIds);
      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('DELETE_FAILED');
    });

    it('should throw error if not connected', async () => {
      vi.clearAllMocks(); // Disconnect
      await expect(vectorStore.delete(mockIds)).rejects.toThrow('Vector store not connected');
    });
  });

  describe('fetch', () => {
    const mockIds = ['1', '2'];
    const mockPoints = [
      { id: '1', vector: [0.1, 0.2], payload: { key: 'value1' } },
      { id: '2', vector: [0.3, 0.4], payload: { key: 'value2' } },
    ];

    beforeEach(async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}});
      await vectorStore.connect();
    });

    it('should fetch vectors successfully', async () => {
      qdrantMock.retrieve.mockResolvedValueOnce(mockPoints);
      const result = await vectorStore.fetch(mockIds);
      expect(result.length).toBe(mockPoints.length);
      expect(result[0].id).toBe('1');
      expect(result[0].values).toEqual([0.1, 0.2]);
      expect(result[0].metadata).toEqual({ key: 'value1' });
      expect(qdrantMock.retrieve).toHaveBeenCalledWith(mockConfig.indexName, {
        ids: mockIds,
        with_payload: true,
        with_vectors: true,
      });
    });

    it('should throw ExternalServiceError on fetch failure', async () => {
      qdrantMock.retrieve.mockRejectedValueOnce(new Error('Fetch failed'));
      await expect(vectorStore.fetch(mockIds)).rejects.toThrow(ExternalServiceError);
    });

    it('should throw error if not connected', async () => {
      vi.clearAllMocks(); // Disconnect
      await expect(vectorStore.fetch(mockIds)).rejects.toThrow('Vector store not connected');
    });
  });

  describe('query', () => {
    const mockQuery = {
      vector: [0.5, 0.6],
      topK: 5,
      filter: { type: 'code' },
      includeMetadata: true,
      includeValues: false,
    };
    const mockSearchResults = [
      { id: '1', score: 0.9, vector: [0.1, 0.2], payload: { type: 'code' } },
      { id: '3', score: 0.8, vector: [0.5, 0.6], payload: { type: 'code' } },
    ];

    beforeEach(async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}});
      await vectorStore.connect();
    });

    it('should query vectors successfully', async () => {
      qdrantMock.search.mockResolvedValueOnce(mockSearchResults);
      const result = await vectorStore.query(mockQuery);
      expect(result.results.length).toBe(mockSearchResults.length);
      expect(result.results[0].id).toBe('1');
      expect(result.results[0].score).toBe(0.9);
      expect(result.results[0].metadata).toEqual({ type: 'code' });
      expect(qdrantMock.search).toHaveBeenCalledWith(mockConfig.indexName, {
        vector: mockQuery.vector,
        limit: mockQuery.topK,
        filter: { must: [{ key: 'type', match: { value: 'code' } }] },
        with_payload: mockQuery.includeMetadata,
        with_vectors: mockQuery.includeValues,
      });
    });

    it('should throw ExternalServiceError on query failure', async () => {
      qdrantMock.search.mockRejectedValueOnce(new Error('Query failed'));
      await expect(vectorStore.query(mockQuery)).rejects.toThrow(ExternalServiceError);
    });

    it('should throw error if not connected', async () => {
      vi.clearAllMocks(); // Disconnect
      await expect(vectorStore.query(mockQuery)).rejects.toThrow('Vector store not connected');
    });
  });

  describe('batchUpsert', () => {
    const mockVectors = Array(250).fill(0).map((_, i) => ({ id: `vec-${i}`, values: [i / 1000], metadata: { idx: i } }));

    beforeEach(async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}});
      await vectorStore.connect();
    });

    it('should batch upsert vectors successfully', async () => {
      qdrantMock.upsert.mockResolvedValue(mockQdrantResponses.upsert);
      const result = await vectorStore.batchUpsert(mockVectors, 100);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(mockVectors.length);
      expect(qdrantMock.upsert).toHaveBeenCalledTimes(3); // 250 vectors, batchSize 100 -> 3 calls
    });

    it('should report errors for failed batches', async () => {
      qdrantMock.upsert.mockResolvedValueOnce(mockQdrantResponses.upsert); // First batch success
      qdrantMock.upsert.mockRejectedValueOnce(new Error('Batch upsert failed')); // Second batch fail
      qdrantMock.upsert.mockResolvedValueOnce(mockQdrantResponses.upsert); // Third batch success

      const result = await vectorStore.batchUpsert(mockVectors, 100);
      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(200); // 100 + 100 (first and third batch)
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(1);
      expect(result.errors?.[0].code).toBe('BATCH_UPSERT_FAILED');
    });
  });

  describe('batchDelete', () => {
    const mockIds = Array(250).fill(0).map((_, i) => `id-${i}`);

    beforeEach(async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}});
      await vectorStore.connect();
    });

    it('should batch delete vectors successfully', async () => {
      qdrantMock.delete.mockResolvedValue(mockQdrantResponses.delete);
      const result = await vectorStore.batchDelete(mockIds, 100);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(mockIds.length);
      expect(qdrantMock.delete).toHaveBeenCalledTimes(3); // 250 ids, batchSize 100 -> 3 calls
    });

    it('should report errors for failed batches', async () => {
      qdrantMock.delete.mockResolvedValueOnce(mockQdrantResponses.delete); // First batch success
      qdrantMock.delete.mockRejectedValueOnce(new Error('Batch delete failed')); // Second batch fail
      qdrantMock.delete.mockResolvedValueOnce(mockQdrantResponses.delete); // Third batch success

      const result = await vectorStore.batchDelete(mockIds, 100);
      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(200); // 100 + 100 (first and third batch)
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(1);
      expect(result.errors?.[0].code).toBe('BATCH_DELETE_FAILED');
    });
  });

  describe('listNamespaces', () => {
    it('should return an empty array as Qdrant does not have direct namespaces', async () => {
      const result = await vectorStore.listNamespaces();
      expect(result).toEqual([]);
    });
  });

  describe('deleteNamespace', () => {
    it('should throw an error as Qdrant does not have direct namespaces', async () => {
      await expect(vectorStore.deleteNamespace('some-namespace')).rejects.toThrow('Delete namespace not directly supported in Qdrant. Use delete with filter on metadata.');
    });
  });

  describe('update', () => {
    const mockUpdate = {
      id: '1',
      options: {
        values: [0.9, 0.8],
        metadata: { newKey: 'newValue' },
      },
    };

    beforeEach(async () => {
      qdrantMock.getCollections.mockResolvedValueOnce({ collections: [{ name: mockConfig.indexName }] });
      qdrantMock.getCollection.mockResolvedValueOnce({ status: 'ok', result: {}});
      await vectorStore.connect();
    });

    it('should update a vector successfully', async () => {
      qdrantMock.upsert.mockResolvedValueOnce(mockQdrantResponses.upsert);
      await vectorStore.update(mockUpdate.id, mockUpdate.options);
      expect(qdrantMock.upsert).toHaveBeenCalledTimes(1);
      expect(qdrantMock.upsert).toHaveBeenCalledWith(mockConfig.indexName, {
        wait: true,
        points: [
          {
            id: mockUpdate.id,
            vector: mockUpdate.options.values,
            payload: mockUpdate.options.metadata,
          },
        ],
      });
    });

    it('should throw ExternalServiceError on update failure', async () => {
      qdrantMock.upsert.mockRejectedValueOnce(new Error('Update failed'));
      await expect(vectorStore.update(mockUpdate.id, mockUpdate.options)).rejects.toThrow(ExternalServiceError);
    });

    it('should throw error if not connected', async () => {
      vi.clearAllMocks(); // Disconnect
      await expect(vectorStore.update(mockUpdate.id, mockUpdate.options)).rejects.toThrow('Vector store not connected');
    });
  });
});


