import { FastifyInstance } from 'fastify';
import { build } from '@/server.js';
import { testConfig } from '../setup/test-env.js';

// Test server instance
let testServer: FastifyInstance | null = null;

// Create test server
export async function createTestServer(): Promise<FastifyInstance> {
  if (testServer) {
    return testServer;
  }

  // Build server with test configuration
  testServer = await build({
    logger: {
      level: 'error', // Reduce log noise in tests
    },
    // Override configuration for testing
    ...testConfig,
  });

  return testServer;
}

// Start test server
export async function startTestServer(): Promise<FastifyInstance> {
  const server = await createTestServer();
  
  try {
    await server.listen({
      port: 0, // Use random available port
      host: '127.0.0.1',
    });
    
    return server;
  } catch (error) {
    throw new Error(`Failed to start test server: ${error}`);
  }
}

// Stop test server
export async function stopTestServer(): Promise<void> {
  if (testServer) {
    try {
      await testServer.close();
      testServer = null;
    } catch (error) {
      console.error('Error stopping test server:', error);
    }
  }
}

// Get test server URL
export function getTestServerUrl(): string {
  if (!testServer) {
    throw new Error('Test server not started');
  }
  
  const address = testServer.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Invalid server address');
  }
  
  return `http://127.0.0.1:${address.port}`;
}

// Test client for making requests
export class TestClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Set authentication token
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  // Clear authentication token
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  // Make authenticated request
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  // HTTP methods
  async get(path: string, query?: Record<string, any>): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });
  }

  async post(path: string, body?: any): Promise<Response> {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put(path: string, body?: any): Promise<Response> {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(path: string): Promise<Response> {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  // Convenience methods for common operations
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await this.post('/api/v1/auth/login', { email, password });
    const data = await response.json();
    
    if (response.ok && data.success) {
      this.setAuthToken(data.data.accessToken);
      return {
        token: data.data.accessToken,
        user: data.data.user,
      };
    }
    
    throw new Error(`Login failed: ${data.message || 'Unknown error'}`);
  }

  async register(userData: { email: string; password: string; name: string }): Promise<{ token: string; user: any }> {
    const response = await this.post('/api/v1/auth/register', userData);
    const data = await response.json();
    
    if (response.ok && data.success) {
      this.setAuthToken(data.data.accessToken);
      return {
        token: data.data.accessToken,
        user: data.data.user,
      };
    }
    
    throw new Error(`Registration failed: ${data.message || 'Unknown error'}`);
  }

  async createProject(projectData: { name: string; description?: string; repositoryPath?: string }): Promise<any> {
    const response = await this.post('/api/v1/projects', projectData);
    const data = await response.json();
    
    if (response.ok && data.success) {
      return data.data.project;
    }
    
    throw new Error(`Project creation failed: ${data.message || 'Unknown error'}`);
  }

  async submitQuery(queryData: { query: string; projectId?: string }): Promise<any> {
    const response = await this.post('/api/v1/query/ask', queryData);
    const data = await response.json();
    
    if (response.ok && data.success) {
      return data.data;
    }
    
    throw new Error(`Query failed: ${data.message || 'Unknown error'}`);
  }

  async getHealth(): Promise<any> {
    const response = await this.get('/api/v1/health');
    const data = await response.json();
    
    if (response.ok) {
      return data;
    }
    
    throw new Error(`Health check failed: ${response.statusText}`);
  }
}

// Create test client
export function createTestClient(baseUrl?: string): TestClient {
  const url = baseUrl || getTestServerUrl();
  return new TestClient(url);
}

// Test utilities
export const testServerUtils = {
  // Wait for server to be ready
  async waitForServer(maxAttempts: number = 10, delay: number = 100): Promise<void> {
    const client = createTestClient();
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await client.getHealth();
        return; // Server is ready
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw new Error(`Server not ready after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  },

  // Reset server state
  async resetServerState(): Promise<void> {
    // This would reset any server state between tests
    // Implementation depends on your specific needs
  },

  // Get server metrics
  async getServerMetrics(): Promise<any> {
    const client = createTestClient();
    const response = await client.get('/api/v1/health/metrics');
    return response.json();
  },
};

