# API Reference

## Overview

This document provides a complete reference for all Hikma API endpoints. The Hikma Agentic Code Intelligence Platform provides a comprehensive REST API for code analysis, project management, user authentication, and AI-powered query processing.

## 📚 Documentation Navigation

- **[← Back to Overview](./01-overview.md)** - API overview and getting started
- **[Setup Guide →](./03-setup-guide.md)** - Step-by-step setup and usage examples

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.hikma.dev`

## API Version

Current API version: `v1`

All endpoints are prefixed with `/api/v1` unless otherwise specified.

## Authentication

The API supports JWT-based authentication with Bearer tokens.

### Authentication Header
```
Authorization: Bearer <your-jwt-token>
```

### Token Expiration
- Access tokens expire in 1 hour by default
- Refresh tokens can be used to obtain new access tokens

---

## API Endpoints

### 🔐 Authentication & User Management

#### POST `/api/v1/auth/login`
Authenticate a user with email/username and password.

**Request Body:**
```json
{
  "emailOrUsername": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "role": "USER",
    "isActive": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/v1/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "secure-password",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "role": "USER",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "User created successfully"
}
```

#### GET `/api/v1/auth/profile`
Get the current user's profile information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "displayName": "John Doe",
    "role": "USER",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT `/api/v1/auth/profile`
Update the current user's profile information.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@example.com"
}
```

---

### 📁 Project Management

#### GET `/api/v1/projects`
List all projects for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (optional): Number of projects to return (default: 50, max: 100)
- `offset` (optional): Number of projects to skip (default: 0)
- `status` (optional): Filter by status (`ACTIVE`, `INACTIVE`)

**Response:**
```json
{
  "projects": [
    {
      "id": "proj_123",
      "name": "My React App",
      "slug": "my-react-app",
      "description": "A sample React application",
      "repositoryUrl": "https://github.com/user/react-app",
      "repositoryPath": "/path/to/repo",
      "settings": {
        "branch": "main",
        "includePatterns": ["**/*.{js,ts,jsx,tsx}"],
        "excludePatterns": ["**/node_modules/**"],
        "maxFileSize": 1048576,
        "enableAutoSync": true,
        "syncInterval": 3600,
        "followSymlinks": false
      },
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "metadata": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

#### POST `/api/v1/projects`
Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "My New Project",
  "description": "A new code analysis project",
  "repositoryUrl": "https://github.com/user/new-project",
  "repositoryPath": "/path/to/local/repo",
  "branch": "main",
  "settings": {
    "includePatterns": ["**/*.{js,ts,jsx,tsx,py}"],
    "excludePatterns": ["**/node_modules/**", "**/dist/**"],
    "maxFileSize": 1048576,
    "enableAutoSync": true,
    "syncInterval": 3600,
    "followSymlinks": false
  }
}
```

**Response:**
```json
{
  "project": {
    "id": "proj_456",
    "name": "My New Project",
    "slug": "my-new-project",
    "description": "A new code analysis project",
    "repositoryUrl": "https://github.com/user/new-project",
    "repositoryPath": "/path/to/local/repo",
    "settings": {
      "branch": "main",
      "includePatterns": ["**/*.{js,ts,jsx,tsx,py}"],
      "excludePatterns": ["**/node_modules/**", "**/dist/**"],
      "maxFileSize": 1048576,
      "enableAutoSync": true,
      "syncInterval": 3600,
      "followSymlinks": false
    },
    "status": "ACTIVE",
    "createdAt": "2024-01-15T11:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

#### GET `/api/v1/projects/{id}`
Get details of a specific project.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project UUID

#### PUT `/api/v1/projects/{id}`
Update a project.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project UUID

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "settings": {
    "branch": "develop",
    "enableAutoSync": false
  },
  "status": "INACTIVE"
}
```

#### DELETE `/api/v1/projects/{id}`
Delete a project.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project UUID

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully",
  "deletedProject": {
    "id": "proj_123",
    "name": "My Project",
    "slug": "my-project"
  }
}
```

#### POST `/api/v1/projects/{id}/sync`
Trigger synchronization/embedding process for a project.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project UUID

**Request Body:**
```json
{
  "force": false
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Sync started successfully",
  "syncId": "sync_789",
  "project": {
    "id": "proj_123",
    "name": "My Project",
    "lastSyncAt": "2024-01-15T12:00:00Z"
  }
}
```

---

### 🤖 AI Query Processing

#### POST `/api/v1/query/ask`
Submit a natural language query about your codebase.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "How does user authentication work in this codebase?",
  "projectId": "proj_123",
  "context": {
    "conversationHistory": [],
    "userPreferences": {
      "responseStyle": "detailed",
      "includeCodeExamples": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": {
      "id": "resp_456",
      "queryId": "query_123",
      "intent": "CODE_EXPLANATION",
      "pipeline": "CODE_ANALYSIS",
      "response": "The authentication system in this codebase uses JWT tokens...",
      "sources": [
        {
          "id": "doc_789",
          "type": "code",
          "title": "auth.service.ts",
          "content": "export class AuthService {...}",
          "path": "src/auth/auth.service.ts",
          "score": 0.95
        }
      ],
      "confidence": 0.92,
      "executionTime": 1250
    }
  },
  "correlationId": "req_123"
}
```

#### POST `/api/v1/query/batch`
Submit multiple queries in a batch.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "queries": [
    {
      "query": "What is the main entry point?",
      "projectId": "proj_123"
    },
    {
      "query": "How is routing handled?",
      "projectId": "proj_123"
    }
  ]
}
```

#### POST `/api/v1/query/conversation`
Continue a conversation with context.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Tell me about the authentication system"
    },
    {
      "role": "assistant",
      "content": "The authentication system uses JWT tokens..."
    },
    {
      "role": "user",
      "content": "How are passwords stored?"
    }
  ],
  "projectId": "proj_123"
}
```

#### GET `/api/v1/query/history`
Get query history for the user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `projectId` (optional): Filter by project
- `sessionId` (optional): Filter by session
- `limit` (optional): Number of queries to return (default: 50, max: 100)
- `offset` (optional): Number of queries to skip (default: 0)

#### POST `/api/v1/query/{queryId}/feedback`
Provide feedback on a query response.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `queryId`: Query UUID

**Request Body:**
```json
{
  "rating": 5,
  "feedback": "Very helpful response!",
  "helpful": true
}
```

---

### 🏥 Health & Monitoring

#### GET `/api/v1/health`
Comprehensive health check for all services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "development",
  "uptime": 3600,
  "services": {
    "knowledge": {
      "status": "healthy",
      "embedding": true,
      "vectorStore": true
    },
    "agent": {
      "status": "healthy",
      "llm": true
    },
    "database": {
      "status": "healthy",
      "postgresql": true,
      "redis": true,
      "neo4j": true
    }
  },
  "correlationId": "req_123"
}
```

#### GET `/api/v1/health/live`
Kubernetes liveness probe.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "correlationId": "req_123"
}
```

#### GET `/api/v1/health/ready`
Kubernetes readiness probe.

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": true,
    "redis": true,
    "vectorStore": true,
    "llm": true
  },
  "correlationId": "req_123"
}
```

#### GET `/api/v1/health/metrics`
System and application metrics.

**Response:**
```json
{
  "system": {
    "memory": {
      "used": 512000000,
      "total": 2048000000,
      "percentage": 25
    },
    "cpu": {
      "usage": 15.5
    }
  },
  "agent": {
    "totalQueries": 1250,
    "successfulQueries": 1200,
    "averageResponseTime": 850
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "correlationId": "req_123"
}
```

#### GET `/api/v1/health/version`
Application version and build information.

**Response:**
```json
{
  "name": "Hikma API",
  "version": "1.0.0",
  "description": "Agentic Code Intelligence Platform",
  "environment": "development",
  "buildTime": "2024-01-15T09:00:00Z",
  "gitCommit": "abc123def456",
  "nodeVersion": "18.17.0",
  "dependencies": {
    "fastify": "4.24.3",
    "prisma": "5.6.0"
  },
  "correlationId": "req_123"
}
```

---

### 📊 Monitoring

#### GET `/api/v1/monitoring/health`
Enhanced health check with detailed monitoring data.

#### GET `/api/v1/monitoring/health/quick`
Quick health check using cached data.

#### GET `/api/v1/monitoring/metrics`
Detailed application metrics.

#### GET `/api/v1/monitoring/metrics/prometheus`
Prometheus-formatted metrics.

**Response:** Plain text Prometheus metrics format

#### GET `/api/v1/monitoring/status`
Comprehensive monitoring status including alerts.

#### GET `/api/v1/monitoring/alerts`
Active alerts in the system.

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_123",
      "name": "High Memory Usage",
      "severity": "medium",
      "message": "Memory usage is above 80%",
      "timestamp": "2024-01-15T10:25:00Z",
      "source": "system-monitor",
      "resolved": false
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### POST `/api/v1/monitoring/alerts`
Create a manual alert.

**Request Body:**
```json
{
  "name": "Custom Alert",
  "severity": "high",
  "message": "Custom alert message",
  "source": "manual"
}
```

---

### 📚 API Information

#### GET `/api/v1/docs`
Get basic API information and available endpoints.

**Response:**
```json
{
  "name": "Hikma API",
  "version": "1.0.0",
  "description": "Agentic Code Intelligence Platform API",
  "endpoints": {
    "health": "/api/v1/health",
    "auth": "/api/v1/auth",
    "query": "/api/v1/query",
    "projects": "/api/v1/projects"
  },
  "documentation": {
    "swagger": "/documentation",
    "openapi": "/documentation/json"
  }
}
```

#### GET `/documentation`
Interactive Swagger UI documentation.

#### GET `/documentation/json`
OpenAPI 3.0 specification in JSON format.

#### GET `/docs`
Redirects to `/documentation` for convenience.

---

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "correlationId": "req_123456",
  "details": {
    "field": "email",
    "code": "REQUIRED"
  }
}
```

### HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

### Common Error Types

- `ValidationError`: Request validation failed
- `AuthenticationError`: Authentication required or failed
- `AuthorizationError`: Insufficient permissions
- `NotFoundError`: Resource not found
- `ConflictError`: Resource conflict (e.g., duplicate email)
- `RateLimitError`: Rate limit exceeded
- `InternalServerError`: Unexpected server error

---

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Default**: 100 requests per 15 minutes per IP address
- **Authenticated users**: Higher limits based on user tier
- **Rate limit headers** are included in responses:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time (Unix timestamp)

---

## Pagination

List endpoints support pagination with the following parameters:

- `limit`: Number of items to return (default: 50, max: 100)
- `offset`: Number of items to skip (default: 0)

Paginated responses include metadata:

```json
{
  "data": [...],
  "metadata": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## CORS

The API supports Cross-Origin Resource Sharing (CORS):

- **Development**: All origins allowed
- **Production**: Specific origins configured

---

## WebSocket Support

The API includes WebSocket support for real-time features:

- **Endpoint**: `ws://localhost:3000/ws` (development)
- **Authentication**: JWT token via query parameter or header
- **Features**: Real-time query processing updates, system notifications

---

## SDK and Client Libraries

Official SDKs are available for:

- **JavaScript/TypeScript**: `@hikma/sdk-js`
- **Python**: `hikma-sdk-python`
- **Go**: `hikma-sdk-go`

---

## Support

For API support and questions:

- **Documentation**: [https://docs.hikma.ai](https://docs.hikma.ai)
- **GitHub Issues**: [https://github.com/hikma/server/issues](https://github.com/hikma/server/issues)
- **Community**: [https://discord.gg/hikma](https://discord.gg/hikma)

---

*Last updated: January 2024*
