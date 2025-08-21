import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestServer, stopTestServer, createTestClient, TestClient } from '@tests/utils/test-server.js';
import { testHelpers } from '@tests/setup/test-env.js';
import { FastifyInstance } from 'fastify';

describe('End-to-End User Journey Tests', () => {
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
    client.clearAuthToken();
    await testHelpers.cleanupDatabase();
  });

  describe('Complete User Journey: Registration to Query Processing', () => {
    it('should complete full user journey successfully', async () => {
      // Step 1: User Registration
      const userData = testHelpers.generateTestUser();
      const registerResponse = await client.post('/api/v1/auth/register', userData);
      const registerData = await registerResponse.json();

      expect(registerResponse.status).toBe(201);
      expect(registerData.success).toBe(true);
      expect(registerData.data.user.email).toBe(userData.email);
      expect(registerData.data.accessToken).toBeDefined();

      // Step 2: Verify Authentication Works
      const profileResponse = await client.get('/api/v1/auth/profile');
      const profileData = await profileResponse.json();

      expect(profileResponse.status).toBe(200);
      expect(profileData.data.user.email).toBe(userData.email);

      // Step 3: Create a Project
      const projectData = testHelpers.generateTestProject();
      const projectResponse = await client.post('/api/v1/projects', projectData);
      const projectResult = await projectResponse.json();

      expect(projectResponse.status).toBe(201);
      expect(projectResult.success).toBe(true);
      expect(projectResult.data.project.name).toBe(projectData.name);

      const projectId = projectResult.data.project.id;

      // Step 4: List Projects
      const projectsResponse = await client.get('/api/v1/projects');
      const projectsData = await projectsResponse.json();

      expect(projectsResponse.status).toBe(200);
      expect(projectsData.data.projects).toHaveLength(1);
      expect(projectsData.data.projects[0].id).toBe(projectId);

      // Step 5: Submit a Query
      const queryData = {
        ...testHelpers.generateTestQuery(),
        projectId,
      };
      const queryResponse = await client.post('/api/v1/query/ask', queryData);
      const queryResult = await queryResponse.json();

      expect(queryResponse.status).toBe(200);
      expect(queryResult.success).toBe(true);
      expect(queryResult.data.response).toBeDefined();
      expect(queryResult.data.intent).toBeDefined();

      // Step 6: Check Query History
      const historyResponse = await client.get('/api/v1/query/history');
      const historyData = await historyResponse.json();

      expect(historyResponse.status).toBe(200);
      expect(historyData.data.queries).toHaveLength(1);
      expect(historyData.data.queries[0].queryText).toBe(queryData.query);

      // Step 7: Submit Feedback
      const queryId = historyData.data.queries[0].id;
      const feedbackResponse = await client.post(`/api/v1/query/${queryId}/feedback`, {
        rating: 5,
        feedback: 'Great response!',
      });
      const feedbackData = await feedbackResponse.json();

      expect(feedbackResponse.status).toBe(200);
      expect(feedbackData.success).toBe(true);

      // Step 8: Update Project
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
      };
      const updateResponse = await client.put(`/api/v1/projects/${projectId}`, updateData);
      const updateResult = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updateResult.data.project.name).toBe(updateData.name);

      // Step 9: Check System Health
      const healthResponse = await client.get('/api/v1/health');
      const healthData = await healthResponse.json();

      expect(healthResponse.status).toBe(200);
      expect(healthData.status).toBe('healthy');

      // Step 10: Logout
      const logoutResponse = await client.post('/api/v1/auth/logout');
      const logoutData = await logoutResponse.json();

      expect(logoutResponse.status).toBe(200);
      expect(logoutData.success).toBe(true);

      // Step 11: Verify Logout (should fail to access protected resource)
      const protectedResponse = await client.get('/api/v1/auth/profile');
      expect(protectedResponse.status).toBe(401);
    });
  });

  describe('Multi-User Scenario', () => {
    it('should handle multiple users with separate data', async () => {
      // Create first user
      const user1Data = testHelpers.generateTestUser();
      const user1Client = createTestClient();
      await user1Client.register(user1Data);

      // Create second user
      const user2Data = testHelpers.generateTestUser();
      const user2Client = createTestClient();
      await user2Client.register(user2Data);

      // User 1 creates a project
      const user1Project = await user1Client.createProject(testHelpers.generateTestProject());

      // User 2 creates a project
      const user2Project = await user2Client.createProject(testHelpers.generateTestProject());

      // User 1 should only see their project
      const user1ProjectsResponse = await user1Client.get('/api/v1/projects');
      const user1ProjectsData = await user1ProjectsResponse.json();

      expect(user1ProjectsData.data.projects).toHaveLength(1);
      expect(user1ProjectsData.data.projects[0].id).toBe(user1Project.id);

      // User 2 should only see their project
      const user2ProjectsResponse = await user2Client.get('/api/v1/projects');
      const user2ProjectsData = await user2ProjectsResponse.json();

      expect(user2ProjectsData.data.projects).toHaveLength(1);
      expect(user2ProjectsData.data.projects[0].id).toBe(user2Project.id);

      // User 1 should not be able to access User 2's project
      const unauthorizedResponse = await user1Client.get(`/api/v1/projects/${user2Project.id}`);
      expect(unauthorizedResponse.status).toBe(404);

      // Both users submit queries
      await user1Client.submitQuery({
        query: 'User 1 query',
        projectId: user1Project.id,
      });

      await user2Client.submitQuery({
        query: 'User 2 query',
        projectId: user2Project.id,
      });

      // Check query history isolation
      const user1HistoryResponse = await user1Client.get('/api/v1/query/history');
      const user1HistoryData = await user1HistoryResponse.json();

      const user2HistoryResponse = await user2Client.get('/api/v1/query/history');
      const user2HistoryData = await user2HistoryResponse.json();

      expect(user1HistoryData.data.queries).toHaveLength(1);
      expect(user1HistoryData.data.queries[0].queryText).toBe('User 1 query');

      expect(user2HistoryData.data.queries).toHaveLength(1);
      expect(user2HistoryData.data.queries[0].queryText).toBe('User 2 query');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle authentication expiry gracefully', async () => {
      // Register user
      const userData = testHelpers.generateTestUser();
      await client.register(userData);

      // Simulate token expiry by setting invalid token
      client.setAuthToken('expired-token');

      // Try to access protected resource
      const response = await client.get('/api/v1/auth/profile');
      expect(response.status).toBe(401);

      // Re-authenticate
      client.clearAuthToken();
      await client.login(userData.email, userData.password);

      // Should work again
      const profileResponse = await client.get('/api/v1/auth/profile');
      expect(profileResponse.status).toBe(200);
    });

    it('should handle project deletion and cleanup', async () => {
      // Register user and create project
      const userData = testHelpers.generateTestUser();
      await client.register(userData);

      const project = await client.createProject(testHelpers.generateTestProject());

      // Submit query to project
      await client.submitQuery({
        query: 'Test query',
        projectId: project.id,
      });

      // Verify query exists
      const historyResponse = await client.get('/api/v1/query/history');
      const historyData = await historyResponse.json();
      expect(historyData.data.queries).toHaveLength(1);

      // Delete project
      const deleteResponse = await client.delete(`/api/v1/projects/${project.id}`);
      expect(deleteResponse.status).toBe(200);

      // Verify project is gone
      const projectsResponse = await client.get('/api/v1/projects');
      const projectsData = await projectsResponse.json();
      expect(projectsData.data.projects).toHaveLength(0);

      // Try to submit query to deleted project (should fail)
      const queryResponse = await client.post('/api/v1/query/ask', {
        query: 'Test query',
        projectId: project.id,
      });
      expect(queryResponse.status).toBe(404);
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch query processing', async () => {
      // Setup user and project
      const userData = testHelpers.generateTestUser();
      await client.register(userData);

      const project = await client.createProject(testHelpers.generateTestProject());

      // Submit batch queries
      const batchQueries = [
        { query: 'What does this function do?', projectId: project.id },
        { query: 'Find the login logic', projectId: project.id },
        { query: 'Show me the documentation', projectId: project.id },
      ];

      const batchResponse = await client.post('/api/v1/query/batch', {
        queries: batchQueries,
      });
      const batchData = await batchResponse.json();

      expect(batchResponse.status).toBe(200);
      expect(batchData.success).toBe(true);
      expect(batchData.data.responses).toHaveLength(3);

      // Verify all responses have required fields
      batchData.data.responses.forEach((response: any) => {
        expect(response.response).toBeDefined();
        expect(response.intent).toBeDefined();
        expect(response.confidence).toBeDefined();
      });

      // Check that all queries are in history
      const historyResponse = await client.get('/api/v1/query/history');
      const historyData = await historyResponse.json();
      expect(historyData.data.queries).toHaveLength(3);
    });
  });

  describe('Conversation Flow', () => {
    it('should handle multi-turn conversation', async () => {
      // Setup user and project
      const userData = testHelpers.generateTestUser();
      await client.register(userData);

      const project = await client.createProject(testHelpers.generateTestProject());

      // Start conversation
      const firstQuery = await client.post('/api/v1/query/conversation', {
        query: 'What is this project about?',
        projectId: project.id,
      });
      const firstData = await firstQuery.json();

      expect(firstQuery.status).toBe(200);
      expect(firstData.data.conversationId).toBeDefined();

      const conversationId = firstData.data.conversationId;

      // Continue conversation
      const secondQuery = await client.post('/api/v1/query/conversation', {
        query: 'Can you explain more about the main components?',
        projectId: project.id,
        conversationId,
      });
      const secondData = await secondQuery.json();

      expect(secondQuery.status).toBe(200);
      expect(secondData.data.conversationId).toBe(conversationId);

      // Third turn
      const thirdQuery = await client.post('/api/v1/query/conversation', {
        query: 'How do I get started with development?',
        projectId: project.id,
        conversationId,
      });
      const thirdData = await thirdQuery.json();

      expect(thirdQuery.status).toBe(200);
      expect(thirdData.data.conversationId).toBe(conversationId);

      // Verify conversation history
      const historyResponse = await client.get('/api/v1/query/history', {
        conversationId,
      });
      const historyData = await historyResponse.json();

      expect(historyData.data.queries).toHaveLength(3);
      expect(historyData.data.queries.every((q: any) => q.conversationId === conversationId)).toBe(true);
    });
  });

  describe('System Monitoring', () => {
    it('should provide comprehensive system metrics', async () => {
      // Register user and create some activity
      const userData = testHelpers.generateTestUser();
      await client.register(userData);

      const project = await client.createProject(testHelpers.generateTestProject());
      await client.submitQuery({
        query: 'Test query for metrics',
        projectId: project.id,
      });

      // Check health endpoint
      const healthResponse = await client.get('/api/v1/health');
      const healthData = await healthResponse.json();

      expect(healthResponse.status).toBe(200);
      expect(healthData.status).toBe('healthy');
      expect(healthData.services).toBeDefined();
      expect(healthData.services.knowledge).toBeDefined();
      expect(healthData.services.agent).toBeDefined();
      expect(healthData.services.database).toBeDefined();

      // Check metrics endpoint
      const metricsResponse = await client.get('/api/v1/health/metrics');
      const metricsData = await metricsResponse.json();

      expect(metricsResponse.status).toBe(200);
      expect(metricsData.system).toBeDefined();
      expect(metricsData.application).toBeDefined();
      expect(metricsData.application.queries).toBeDefined();
      expect(metricsData.application.users).toBeDefined();
      expect(metricsData.application.projects).toBeDefined();
    });
  });
});

