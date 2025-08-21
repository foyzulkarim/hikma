import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestServer, stopTestServer, createTestClient, TestClient } from '@tests/utils/test-server.js';
import { testHelpers } from '@tests/setup/test-env.js';
import { FastifyInstance } from 'fastify';

describe('Authentication API Integration Tests', () => {
  let server: FastifyInstance;
  let client: TestClient;

  beforeAll(async () => {
    server = await createTestServer();
    await server.listen({ port: 0, host: '127.0.0.1' });
    client = createTestClient();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    // Clear authentication state
    client.clearAuthToken();
    
    // Clean up test data
    await testHelpers.cleanupDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = testHelpers.generateTestUser();
      
      const response = await client.post('/api/v1/auth/register', userData);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(userData.email);
      expect(data.data.user.name).toBe(userData.name);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        ...testHelpers.generateTestUser(),
        email: 'invalid-email',
      };

      const response = await client.post('/api/v1/auth/register', userData);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        ...testHelpers.generateTestUser(),
        password: '123', // Too weak
      };

      const response = await client.post('/api/v1/auth/register', userData);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });

    it('should reject registration with duplicate email', async () => {
      const userData = testHelpers.generateTestUser();

      // Register first user
      await client.post('/api/v1/auth/register', userData);

      // Try to register with same email
      const response = await client.post('/api/v1/auth/register', userData);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Conflict');
    });

    it('should reject registration with missing required fields', async () => {
      const incompleteData = {
        email: 'test@example.com',
        // Missing password and name
      };

      const response = await client.post('/api/v1/auth/register', incompleteData);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let registeredUser: any;

    beforeEach(async () => {
      // Register a user for login tests
      const userData = testHelpers.generateTestUser();
      const registerResponse = await client.post('/api/v1/auth/register', userData);
      const registerData = await registerResponse.json();
      
      registeredUser = {
        ...userData,
        id: registerData.data.user.id,
      };
      
      // Clear token after registration
      client.clearAuthToken();
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: registeredUser.email,
        password: registeredUser.password,
      };

      const response = await client.post('/api/v1/auth/login', loginData);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(registeredUser.email);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.user.password).toBeUndefined();
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: registeredUser.password,
      };

      const response = await client.post('/api/v1/auth/login', loginData);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Failed');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: registeredUser.email,
        password: 'wrongpassword',
      };

      const response = await client.post('/api/v1/auth/login', loginData);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Failed');
    });

    it('should reject login with malformed email', async () => {
      const loginData = {
        email: 'invalid-email',
        password: registeredUser.password,
      };

      const response = await client.post('/api/v1/auth/login', loginData);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });

    it('should reject login with missing credentials', async () => {
      const loginData = {
        email: registeredUser.email,
        // Missing password
      };

      const response = await client.post('/api/v1/auth/login', loginData);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let userTokens: any;

    beforeEach(async () => {
      // Register and login to get tokens
      const userData = testHelpers.generateTestUser();
      const { token } = await client.register(userData);
      
      const loginResponse = await client.post('/api/v1/auth/login', {
        email: userData.email,
        password: userData.password,
      });
      const loginData = await loginResponse.json();
      
      userTokens = {
        accessToken: loginData.data.accessToken,
        refreshToken: loginData.data.refreshToken,
      };
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await client.post('/api/v1/auth/refresh', {
        refreshToken: userTokens.refreshToken,
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.accessToken).not.toBe(userTokens.accessToken);
    });

    it('should reject refresh with invalid refresh token', async () => {
      const response = await client.post('/api/v1/auth/refresh', {
        refreshToken: 'invalid-refresh-token',
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Failed');
    });

    it('should reject refresh with missing refresh token', async () => {
      const response = await client.post('/api/v1/auth/refresh', {});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let authenticatedClient: TestClient;

    beforeEach(async () => {
      authenticatedClient = createTestClient();
      const userData = testHelpers.generateTestUser();
      await authenticatedClient.register(userData);
    });

    it('should logout successfully with valid token', async () => {
      const response = await authenticatedClient.post('/api/v1/auth/logout');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');
    });

    it('should reject logout without authentication', async () => {
      const response = await client.post('/api/v1/auth/logout');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Required');
    });

    it('should reject logout with invalid token', async () => {
      client.setAuthToken('invalid-token');
      
      const response = await client.post('/api/v1/auth/logout');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Failed');
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    let authenticatedClient: TestClient;
    let userData: any;

    beforeEach(async () => {
      authenticatedClient = createTestClient();
      userData = testHelpers.generateTestUser();
      await authenticatedClient.register(userData);
    });

    it('should get user profile with valid token', async () => {
      const response = await authenticatedClient.get('/api/v1/auth/profile');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(userData.email);
      expect(data.data.user.name).toBe(userData.name);
      expect(data.data.user.password).toBeUndefined();
    });

    it('should reject profile request without authentication', async () => {
      const response = await client.get('/api/v1/auth/profile');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Required');
    });

    it('should reject profile request with invalid token', async () => {
      client.setAuthToken('invalid-token');
      
      const response = await client.get('/api/v1/auth/profile');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Failed');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let authenticatedClient: TestClient;
    let userData: any;

    beforeEach(async () => {
      authenticatedClient = createTestClient();
      userData = testHelpers.generateTestUser();
      await authenticatedClient.register(userData);
    });

    it('should change password with valid current password', async () => {
      const changePasswordData = {
        currentPassword: userData.password,
        newPassword: 'newPassword123!',
      };

      const response = await authenticatedClient.post('/api/v1/auth/change-password', changePasswordData);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Password changed successfully');

      // Verify new password works
      authenticatedClient.clearAuthToken();
      const loginResponse = await authenticatedClient.post('/api/v1/auth/login', {
        email: userData.email,
        password: changePasswordData.newPassword,
      });
      
      expect(loginResponse.status).toBe(200);
    });

    it('should reject password change with invalid current password', async () => {
      const changePasswordData = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123!',
      };

      const response = await authenticatedClient.post('/api/v1/auth/change-password', changePasswordData);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid Password');
    });

    it('should reject password change with weak new password', async () => {
      const changePasswordData = {
        currentPassword: userData.password,
        newPassword: '123', // Too weak
      };

      const response = await authenticatedClient.post('/api/v1/auth/change-password', changePasswordData);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });

    it('should reject password change without authentication', async () => {
      const changePasswordData = {
        currentPassword: userData.password,
        newPassword: 'newPassword123!',
      };

      const response = await client.post('/api/v1/auth/change-password', changePasswordData);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication Required');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Make multiple failed login attempts
      const promises = Array(10).fill(null).map(() => 
        client.post('/api/v1/auth/login', loginData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply rate limiting to registration attempts', async () => {
      // Make multiple registration attempts
      const promises = Array(10).fill(null).map((_, i) => 
        client.post('/api/v1/auth/register', {
          email: `test${i}@example.com`,
          password: 'password123',
          name: `Test User ${i}`,
        })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});

