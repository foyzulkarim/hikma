import { vi } from 'vitest';

// Mock Qdrant responses
export const mockQdrantResponses = {
  upsert: {
    status: 'ok',
    result: { operation_id: 1, status: 'completed' },
  },
  
  search: [
    {
      id: 'doc-1',
      score: 0.95,
      vector: Array(1536).fill(0).map(() => Math.random() - 0.5),
      payload: {
        title: 'Test Document 1',
        content: 'This is test content for document 1',
        type: 'code',
        language: 'typescript',
        projectId: 'test-project',
      },
    },
    {
      id: 'doc-2',
      score: 0.87,
      vector: Array(1536).fill(0).map(() => Math.random() - 0.5),
      payload: {
        title: 'Test Document 2',
        content: 'This is test content for document 2',
        type: 'documentation',
        projectId: 'test-project',
      },
    },
  ],
  
  retrieve: [
    {
      id: 'doc-1',
      vector: Array(1536).fill(0).map(() => Math.random() - 0.5),
      payload: {
        title: 'Test Document 1',
        content: 'This is test content',
        type: 'code',
      },
    },
  ],
  
  delete: {
    status: 'ok',
    result: { operation_id: 2, status: 'completed' },
  },
  
  getCollection: {
    status: 'ok',
    result: {
      points_count: 100,
      config: {
        params: {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        },
      },
    },
  },
  
  getCollections: {
    status: 'ok',
    result: {
      collections: [
        {
          name: 'hikma-embeddings',
          points_count: 100,
        },
      ],
    },
  },
  
  healthCheck: {
    status: 'ok',
  },
};

// Mock Qdrant client
export const mockQdrantClient = {
  upsert: vi.fn().mockResolvedValue(mockQdrantResponses.upsert),
  search: vi.fn().mockResolvedValue(mockQdrantResponses.search),
  retrieve: vi.fn().mockResolvedValue(mockQdrantResponses.retrieve),
  delete: vi.fn().mockResolvedValue(mockQdrantResponses.delete),
  getCollection: vi.fn().mockResolvedValue(mockQdrantResponses.getCollection),
  getCollections: vi.fn().mockResolvedValue(mockQdrantResponses.getCollections),
  createCollection: vi.fn().mockResolvedValue({ status: 'ok' }),
  deleteCollection: vi.fn().mockResolvedValue({ status: 'ok' }),
  healthCheck: vi.fn().mockResolvedValue(mockQdrantResponses.healthCheck),
};

// Helper functions for test scenarios
export const qdrantMockHelpers = {
  // Mock successful upsert
  mockUpsertSuccess: () => {
    mockQdrantClient.upsert.mockResolvedValueOnce(mockQdrantResponses.upsert);
  },
  
  // Mock upsert error
  mockUpsertError: (error: Error = new Error('Qdrant upsert error')) => {
    mockQdrantClient.upsert.mockRejectedValueOnce(error);
  },
  
  // Mock successful search
  mockSearchSuccess: (matches: any[] = mockQdrantResponses.search) => {
    mockQdrantClient.search.mockResolvedValueOnce(matches);
  },
  
  // Mock empty search results
  mockSearchEmpty: () => {
    mockQdrantClient.search.mockResolvedValueOnce([]);
  },
  
  // Mock search error
  mockSearchError: (error: Error = new Error('Qdrant search error')) => {
    mockQdrantClient.search.mockRejectedValueOnce(error);
  },
  
  // Mock successful retrieve
  mockRetrieveSuccess: (points: any[] = mockQdrantResponses.retrieve) => {
    mockQdrantClient.retrieve.mockResolvedValueOnce(points);
  },
  
  // Mock retrieve error
  mockRetrieveError: (error: Error = new Error('Qdrant retrieve error')) => {
    mockQdrantClient.retrieve.mockRejectedValueOnce(error);
  },
  
  // Mock successful delete
  mockDeleteSuccess: () => {
    mockQdrantClient.delete.mockResolvedValueOnce(mockQdrantResponses.delete);
  },
  
  // Mock delete error
  mockDeleteError: (error: Error = new Error('Qdrant delete error')) => {
    mockQdrantClient.delete.mockRejectedValueOnce(error);
  },
  
  // Mock collection stats
  mockCollectionStats: (pointsCount: number = 100) => {
    mockQdrantClient.getCollection.mockResolvedValueOnce({
      status: 'ok',
      result: {
        points_count: pointsCount,
        config: {
          params: {
            vectors: {
              size: 1536,
              distance: 'Cosine',
            },
          },
        },
      },
    });
  },
  
  // Mock collection existence
  mockCollectionExists: (exists: boolean) => {
    mockQdrantClient.getCollections.mockResolvedValueOnce({
      status: 'ok',
      result: {
        collections: exists ? [{ name: 'hikma-embeddings' }] : [],
      },
    });
  },
  
  // Reset all mocks
  reset: () => {
    vi.clearAllMocks();
    mockQdrantClient.upsert.mockResolvedValue(mockQdrantResponses.upsert);
    mockQdrantClient.search.mockResolvedValue(mockQdrantResponses.search);
    mockQdrantClient.retrieve.mockResolvedValue(mockQdrantResponses.retrieve);
    mockQdrantClient.delete.mockResolvedValue(mockQdrantResponses.delete);
    mockQdrantClient.getCollection.mockResolvedValue(mockQdrantResponses.getCollection);
    mockQdrantClient.getCollections.mockResolvedValue(mockQdrantResponses.getCollections);
    mockQdrantClient.createCollection.mockResolvedValue({ status: 'ok' });
    mockQdrantClient.deleteCollection.mockResolvedValue({ status: 'ok' });
    mockQdrantClient.healthCheck.mockResolvedValue(mockQdrantResponses.healthCheck);
  },
  
  // Get call history
  getUpsertCalls: () => mockQdrantClient.upsert.mock.calls,
  getSearchCalls: () => mockQdrantClient.search.mock.calls,
  getRetrieveCalls: () => mockQdrantClient.retrieve.mock.calls,
  getDeleteCalls: () => mockQdrantClient.delete.mock.calls,
  
  // Verify calls
  expectUpsertCalled: (times: number = 1) => {
    expect(mockQdrantClient.upsert).toHaveBeenCalledTimes(times);
  },
  expectSearchCalled: (times: number = 1) => {
    expect(mockQdrantClient.search).toHaveBeenCalledTimes(times);
  },
  expectRetrieveCalled: (times: number = 1) => {
    expect(mockQdrantClient.retrieve).toHaveBeenCalledTimes(times);
  },
  expectDeleteCalled: (times: number = 1) => {
    expect(mockQdrantClient.delete).toHaveBeenCalledTimes(times);
  },
  
  // Create custom match
  createMatch: (id: string, score: number, payload: any = {}) => ({
    id,
    score,
    vector: Array(1536).fill(0).map(() => Math.random() - 0.5),
    payload: {
      title: `Document ${id}`,
      content: `Content for ${id}`,
      type: 'code',
      ...payload,
    },
  }),
};

// Export for use in tests
export { mockQdrantClient as qdrantMock };

