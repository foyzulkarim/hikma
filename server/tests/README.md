# Hikma Testing Guide

This document provides comprehensive information about the testing setup and practices for the Hikma project.

## Testing Framework

We use **Vitest** as our primary testing framework, chosen for its:
- Fast execution and hot reload
- Native TypeScript support
- Excellent integration with modern tooling
- Jest-compatible API
- Built-in coverage reporting

## Test Structure

```
tests/
├── setup/                    # Test configuration and setup
│   ├── global-setup.ts      # Global test setup (databases, services)
│   ├── global-teardown.ts   # Global test cleanup
│   └── test-env.ts          # Test environment configuration
├── 
├── mocks/                   # Mock implementations
│   ├── openai.mock.ts       # OpenAI service mocks
│   ├── pinecone.mock.ts     # Pinecone vector store mocks
│   └── database.mock.ts     # Database mocks
├── 
├── utils/                   # Test utilities
│   └── test-server.ts       # Test server and client utilities
├── 
├── unit/                    # Unit tests
│   ├── core/               # Core utilities tests
│   ├── modules/            # Module-specific tests
│   └── ...
├── 
├── integration/             # Integration tests
│   ├── api/                # API endpoint tests
│   ├── services/           # Service integration tests
│   └── ...
├── 
├── e2e/                     # End-to-end tests
│   ├── user-journey.test.ts # Complete user workflows
│   └── ...
├── 
├── performance/             # Performance tests
│   └── ...
└── 
└── fixtures/                # Test data and fixtures
    └── ...
```

## Test Types

### 1. Unit Tests
Test individual functions, classes, and modules in isolation.

**Location**: `tests/unit/`  
**Purpose**: Verify individual components work correctly  
**Scope**: Single function/class/module  

**Example**:
```typescript
// tests/unit/core/utils/crypto.test.ts
describe('PasswordUtils', () => {
  it('should hash password correctly', async () => {
    const password = 'testPassword123';
    const hash = await PasswordUtils.hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
  });
});
```

### 2. Integration Tests
Test how different components work together.

**Location**: `tests/integration/`  
**Purpose**: Verify component interactions  
**Scope**: Multiple components/services  

**Example**:
```typescript
// tests/integration/api/auth.test.ts
describe('Authentication API', () => {
  it('should register and login user', async () => {
    const userData = { email: 'test@example.com', password: 'password123' };
    
    // Register
    const registerResponse = await client.post('/api/v1/auth/register', userData);
    expect(registerResponse.status).toBe(201);
    
    // Login
    const loginResponse = await client.post('/api/v1/auth/login', userData);
    expect(loginResponse.status).toBe(200);
  });
});
```

### 3. End-to-End Tests
Test complete user workflows from start to finish.

**Location**: `tests/e2e/`  
**Purpose**: Verify complete user journeys  
**Scope**: Full application workflow  

**Example**:
```typescript
// tests/e2e/user-journey.test.ts
describe('Complete User Journey', () => {
  it('should complete registration to query processing', async () => {
    // 1. Register user
    await client.register(userData);
    
    // 2. Create project
    const project = await client.createProject(projectData);
    
    // 3. Submit query
    const response = await client.submitQuery({ query: 'test', projectId: project.id });
    
    // 4. Verify response
    expect(response.success).toBe(true);
  });
});
```

### 4. Performance Tests
Test system performance and load handling.

**Location**: `tests/performance/`  
**Purpose**: Verify performance requirements  
**Scope**: System performance metrics  

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/core/utils/crypto.test.ts

# Run tests matching pattern
npm test -- --grep "authentication"
```

### Advanced Options

```bash
# Run tests in parallel
npm test -- --threads

# Run tests with specific timeout
npm test -- --testTimeout=60000

# Run tests with verbose output
npm test -- --reporter=verbose

# Run tests and generate HTML report
npm test -- --reporter=html

# Run tests with specific environment
NODE_ENV=test npm test
```

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)

Key configuration options:
- **Environment**: Node.js environment for backend testing
- **Coverage**: V8 provider with 70% threshold
- **Timeout**: 30 seconds for test and hook timeouts
- **Parallel**: Multi-threaded execution for performance
- **Setup**: Global setup and teardown for test environment

### Environment Variables

Test-specific environment variables:
```bash
# Test database
TEST_DATABASE_URL=postgresql://hikma:hikma123@localhost:5432/hikma_test

# Test Redis
TEST_REDIS_URL=redis://localhost:6379/1

# Test external services
TEST_OPENAI_API_KEY=test-key
TEST_PINECONE_API_KEY=test-key
TEST_PINECONE_INDEX=test-index

# Mock services (recommended for CI)
USE_MOCK_OPENAI=true
USE_MOCK_PINECONE=true
```

## Mocking Strategy

### External Services
We mock external services to ensure:
- Tests run reliably without external dependencies
- Tests run quickly
- Tests don't consume external API quotas
- Tests can simulate error conditions

### Mock Implementations

#### OpenAI Mock
```typescript
import { openAIMockHelpers } from '@tests/mocks/openai.mock.js';

// Mock successful response
openAIMockHelpers.mockChatSuccess('Test AI response');

// Mock error
openAIMockHelpers.mockChatError(new Error('API error'));

// Verify calls
openAIMockHelpers.expectChatCalled(1);
```

#### Pinecone Mock
```typescript
import { pineconeMockHelpers } from '@tests/mocks/pinecone.mock.js';

// Mock successful query
pineconeMockHelpers.mockQuerySuccess([
  { id: 'doc1', score: 0.9, metadata: { title: 'Test Doc' } }
]);

// Verify calls
pineconeMockHelpers.expectQueryCalled(1);
```

#### Database Mock
```typescript
import { databaseMockHelpers } from '@tests/mocks/database.mock.js';

// Mock user creation
databaseMockHelpers.mockUserCreate({ email: 'test@example.com' });

// Mock user not found
databaseMockHelpers.mockUserNotFound();
```

## Test Utilities

### Test Server
Utility for creating and managing test server instances:

```typescript
import { createTestServer, createTestClient } from '@tests/utils/test-server.js';

// Create test server
const server = await createTestServer();

// Create test client
const client = createTestClient();

// Authenticate client
await client.register(userData);
await client.login(email, password);

// Make requests
const response = await client.get('/api/v1/projects');
```

### Test Helpers
Common test utilities and data generators:

```typescript
import { testHelpers } from '@tests/setup/test-env.js';

// Generate test data
const user = testHelpers.generateTestUser();
const project = testHelpers.generateTestProject();
const query = testHelpers.generateTestQuery();

// Generate test token
const token = await testHelpers.generateTestToken('user-id');

// Wait for async operations
await testHelpers.wait(1000);
```

## Best Practices

### 1. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow the AAA pattern: Arrange, Act, Assert

### 2. Test Independence
- Each test should be independent and not rely on other tests
- Use `beforeEach` and `afterEach` for setup and cleanup
- Reset mocks between tests

### 3. Mock Usage
- Mock external dependencies (APIs, databases, file system)
- Use real implementations for internal components when possible
- Verify mock interactions when testing integration points

### 4. Assertions
- Use specific assertions that clearly express expectations
- Test both success and error scenarios
- Verify all important aspects of the response

### 5. Test Data
- Use factories or generators for test data
- Make test data realistic but minimal
- Avoid hardcoded values that might break over time

## Coverage Requirements

We maintain the following coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Excluded from Coverage
- Configuration files
- Test files
- Type definitions
- Main entry points
- Scripts and tools

## Continuous Integration

### GitHub Actions
Tests run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled runs (daily)

### Test Environment
CI uses:
- Node.js 20.x
- PostgreSQL 15
- Redis 7
- Mock external services

## Debugging Tests

### VS Code Configuration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "--threads", "false"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Debugging Techniques
1. Use `console.log` for quick debugging
2. Use `debugger` statements with Node.js inspector
3. Run single test files for isolation
4. Use `--reporter=verbose` for detailed output
5. Check test setup and teardown for issues

## Performance Testing

### Load Testing
```typescript
describe('Performance Tests', () => {
  it('should handle concurrent requests', async () => {
    const promises = Array(100).fill(null).map(() => 
      client.post('/api/v1/query/ask', queryData)
    );
    
    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
```

### Memory Testing
Monitor memory usage during tests:
```typescript
it('should not leak memory', async () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Perform operations
  for (let i = 0; i < 1000; i++) {
    await performOperation();
  }
  
  // Force garbage collection
  if (global.gc) global.gc();
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = finalMemory - initialMemory;
  
  expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
});
```

## Troubleshooting

### Common Issues

1. **Tests timeout**: Increase timeout or check for hanging promises
2. **Database connection errors**: Ensure test database is running
3. **Mock not working**: Verify mock is imported before the module being tested
4. **Flaky tests**: Check for race conditions or shared state

### Getting Help

1. Check test logs for detailed error messages
2. Run tests in isolation to identify problematic tests
3. Verify test environment setup
4. Check mock configurations
5. Review test dependencies and setup order

This testing framework provides comprehensive coverage and ensures the reliability of the Hikma platform.

