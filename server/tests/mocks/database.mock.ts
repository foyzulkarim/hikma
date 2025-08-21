import { vi } from 'vitest';

// Mock Prisma client responses
export const mockDatabaseResponses = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  project: {
    id: 'project-123',
    name: 'Test Project',
    description: 'A test project',
    ownerId: 'user-123',
    repositoryUrl: 'https://github.com/test/repo',
    repositoryPath: '/path/to/repo',
    settings: {
      includePatterns: ['**/*.ts', '**/*.js'],
      excludePatterns: ['node_modules/**'],
      maxFileSize: 1024000,
      enableAutoSync: false,
      syncInterval: 3600,
    },
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  document: {
    id: 'doc-123',
    projectId: 'project-123',
    title: 'Test Document',
    content: 'This is test document content',
    type: 'CODE',
    language: 'typescript',
    filePath: '/src/test.ts',
    metadata: {
      size: 1024,
      lastModified: new Date().toISOString(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  query: {
    id: 'query-123',
    userId: 'user-123',
    projectId: 'project-123',
    queryText: 'What does this code do?',
    intent: 'CODE_EXPLANATION',
    createdAt: new Date(),
  },
  
  response: {
    id: 'response-123',
    queryId: 'query-123',
    content: 'This code implements a test function.',
    confidence: 0.9,
    executionTime: 1500,
    metadata: {
      model: 'gpt-3.5-turbo',
      tokens: 150,
    },
    createdAt: new Date(),
  },
};

// Mock Prisma client
export const mockPrismaClient = {
  user: {
    create: vi.fn().mockResolvedValue(mockDatabaseResponses.user),
    findUnique: vi.fn().mockResolvedValue(mockDatabaseResponses.user),
    findMany: vi.fn().mockResolvedValue([mockDatabaseResponses.user]),
    update: vi.fn().mockResolvedValue(mockDatabaseResponses.user),
    delete: vi.fn().mockResolvedValue(mockDatabaseResponses.user),
    count: vi.fn().mockResolvedValue(1),
  },
  
  project: {
    create: vi.fn().mockResolvedValue(mockDatabaseResponses.project),
    findUnique: vi.fn().mockResolvedValue(mockDatabaseResponses.project),
    findMany: vi.fn().mockResolvedValue([mockDatabaseResponses.project]),
    update: vi.fn().mockResolvedValue(mockDatabaseResponses.project),
    delete: vi.fn().mockResolvedValue(mockDatabaseResponses.project),
    count: vi.fn().mockResolvedValue(1),
  },
  
  document: {
    create: vi.fn().mockResolvedValue(mockDatabaseResponses.document),
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUnique: vi.fn().mockResolvedValue(mockDatabaseResponses.document),
    findMany: vi.fn().mockResolvedValue([mockDatabaseResponses.document]),
    update: vi.fn().mockResolvedValue(mockDatabaseResponses.document),
    delete: vi.fn().mockResolvedValue(mockDatabaseResponses.document),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    count: vi.fn().mockResolvedValue(1),
  },
  
  query: {
    create: vi.fn().mockResolvedValue(mockDatabaseResponses.query),
    findUnique: vi.fn().mockResolvedValue(mockDatabaseResponses.query),
    findMany: vi.fn().mockResolvedValue([mockDatabaseResponses.query]),
    update: vi.fn().mockResolvedValue(mockDatabaseResponses.query),
    delete: vi.fn().mockResolvedValue(mockDatabaseResponses.query),
    count: vi.fn().mockResolvedValue(1),
  },
  
  response: {
    create: vi.fn().mockResolvedValue(mockDatabaseResponses.response),
    findUnique: vi.fn().mockResolvedValue(mockDatabaseResponses.response),
    findMany: vi.fn().mockResolvedValue([mockDatabaseResponses.response]),
    update: vi.fn().mockResolvedValue(mockDatabaseResponses.response),
    delete: vi.fn().mockResolvedValue(mockDatabaseResponses.response),
    count: vi.fn().mockResolvedValue(1),
  },
  
  // Transaction support
  $transaction: vi.fn().mockImplementation((callback) => {
    return callback(mockPrismaClient);
  }),
  
  // Connection management
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  
  // Raw queries
  $queryRaw: vi.fn().mockResolvedValue([]),
  $executeRaw: vi.fn().mockResolvedValue(1),
};

// Helper functions for test scenarios
export const databaseMockHelpers = {
  // User helpers
  mockUserCreate: (userData: Partial<typeof mockDatabaseResponses.user> = {}) => {
    const user = { ...mockDatabaseResponses.user, ...userData };
    mockPrismaClient.user.create.mockResolvedValueOnce(user);
    return user;
  },
  
  mockUserFind: (userData: Partial<typeof mockDatabaseResponses.user> | null = mockDatabaseResponses.user) => {
    mockPrismaClient.user.findUnique.mockResolvedValueOnce(userData);
    return userData;
  },
  
  mockUserNotFound: () => {
    mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);
  },
  
  // Project helpers
  mockProjectCreate: (projectData: Partial<typeof mockDatabaseResponses.project> = {}) => {
    const project = { ...mockDatabaseResponses.project, ...projectData };
    mockPrismaClient.project.create.mockResolvedValueOnce(project);
    return project;
  },
  
  mockProjectFind: (projectData: Partial<typeof mockDatabaseResponses.project> | null = mockDatabaseResponses.project) => {
    mockPrismaClient.project.findUnique.mockResolvedValueOnce(projectData);
    return projectData;
  },
  
  mockProjectNotFound: () => {
    mockPrismaClient.project.findUnique.mockResolvedValueOnce(null);
  },
  
  mockProjectList: (projects: any[] = [mockDatabaseResponses.project]) => {
    mockPrismaClient.project.findMany.mockResolvedValueOnce(projects);
    return projects;
  },
  
  // Document helpers
  mockDocumentCreate: (documentData: Partial<typeof mockDatabaseResponses.document> = {}) => {
    const document = { ...mockDatabaseResponses.document, ...documentData };
    mockPrismaClient.document.create.mockResolvedValueOnce(document);
    return document;
  },
  
  mockDocumentBatchCreate: (count: number = 1) => {
    mockPrismaClient.document.createMany.mockResolvedValueOnce({ count });
  },
  
  mockDocumentList: (documents: any[] = [mockDatabaseResponses.document]) => {
    mockPrismaClient.document.findMany.mockResolvedValueOnce(documents);
    return documents;
  },
  
  // Query helpers
  mockQueryCreate: (queryData: Partial<typeof mockDatabaseResponses.query> = {}) => {
    const query = { ...mockDatabaseResponses.query, ...queryData };
    mockPrismaClient.query.create.mockResolvedValueOnce(query);
    return query;
  },
  
  mockQueryFind: (queryData: Partial<typeof mockDatabaseResponses.query> | null = mockDatabaseResponses.query) => {
    mockPrismaClient.query.findUnique.mockResolvedValueOnce(queryData);
    return queryData;
  },
  
  // Response helpers
  mockResponseCreate: (responseData: Partial<typeof mockDatabaseResponses.response> = {}) => {
    const response = { ...mockDatabaseResponses.response, ...responseData };
    mockPrismaClient.response.create.mockResolvedValueOnce(response);
    return response;
  },
  
  // Error helpers
  mockDatabaseError: (operation: string, error: Error = new Error('Database error')) => {
    const [model, method] = operation.split('.');
    if (mockPrismaClient[model] && mockPrismaClient[model][method]) {
      mockPrismaClient[model][method].mockRejectedValueOnce(error);
    }
  },
  
  mockConnectionError: () => {
    const error = new Error('Connection failed');
    mockPrismaClient.$connect.mockRejectedValueOnce(error);
  },
  
  mockTransactionError: (error: Error = new Error('Transaction failed')) => {
    mockPrismaClient.$transaction.mockRejectedValueOnce(error);
  },
  
  // Reset all mocks
  reset: () => {
    vi.clearAllMocks();
    
    // Reset to default responses
    mockPrismaClient.user.create.mockResolvedValue(mockDatabaseResponses.user);
    mockPrismaClient.user.findUnique.mockResolvedValue(mockDatabaseResponses.user);
    mockPrismaClient.user.findMany.mockResolvedValue([mockDatabaseResponses.user]);
    
    mockPrismaClient.project.create.mockResolvedValue(mockDatabaseResponses.project);
    mockPrismaClient.project.findUnique.mockResolvedValue(mockDatabaseResponses.project);
    mockPrismaClient.project.findMany.mockResolvedValue([mockDatabaseResponses.project]);
    
    mockPrismaClient.document.create.mockResolvedValue(mockDatabaseResponses.document);
    mockPrismaClient.document.findMany.mockResolvedValue([mockDatabaseResponses.document]);
    
    mockPrismaClient.query.create.mockResolvedValue(mockDatabaseResponses.query);
    mockPrismaClient.response.create.mockResolvedValue(mockDatabaseResponses.response);
    
    mockPrismaClient.$transaction.mockImplementation((callback) => callback(mockPrismaClient));
  },
  
  // Verification helpers
  expectUserCreated: (times: number = 1) => {
    expect(mockPrismaClient.user.create).toHaveBeenCalledTimes(times);
  },
  
  expectProjectCreated: (times: number = 1) => {
    expect(mockPrismaClient.project.create).toHaveBeenCalledTimes(times);
  },
  
  expectQueryCreated: (times: number = 1) => {
    expect(mockPrismaClient.query.create).toHaveBeenCalledTimes(times);
  },
  
  expectResponseCreated: (times: number = 1) => {
    expect(mockPrismaClient.response.create).toHaveBeenCalledTimes(times);
  },
  
  // Get call history
  getUserCalls: () => ({
    create: mockPrismaClient.user.create.mock.calls,
    findUnique: mockPrismaClient.user.findUnique.mock.calls,
    findMany: mockPrismaClient.user.findMany.mock.calls,
  }),
  
  getProjectCalls: () => ({
    create: mockPrismaClient.project.create.mock.calls,
    findUnique: mockPrismaClient.project.findUnique.mock.calls,
    findMany: mockPrismaClient.project.findMany.mock.calls,
  }),
};

// Export for use in tests
export { mockPrismaClient as prismaMock };

