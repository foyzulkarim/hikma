# API Setup & Usage Guide

This comprehensive guide will walk you through setting up accounts, obtaining authentication tokens, and using all the API endpoints in the Hikma Agentic Code Intelligence Platform.

## 📚 Documentation Navigation

- **[← API Reference](./02-api-reference.md)** - Complete API endpoint reference
- **[← Back to Overview](./01-overview.md)** - API overview and getting started

## 🚀 Quick Start

### Prerequisites
- Hikma server running (see `SETUP_GUIDE.md`)
- `curl` or similar HTTP client
- A Git repository you want to analyze

### 30-Second Setup
```bash
# 1. Register a new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","username":"testuser","firstName":"Test","lastName":"User"}'

# 2. Login to get token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"test@example.com","password":"password123"}'

# 3. Extract token from response and use it
export TOKEN="your-access-token-here"

# 4. Create a project
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Repo","repositoryPath":"/path/to/repo"}'

# 5. Start embedding process
curl -X POST http://localhost:3000/api/v1/projects/{project-id}/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force":false}'
```

---

## 🔐 Authentication & Account Setup

### 1. User Registration

**Endpoint**: `POST /api/v1/auth/register`

**Request Body**:
```json
{
  "email": "your-email@example.com",
  "username": "your-username",
  "password": "your-secure-password",
  "firstName": "Your First Name",
  "lastName": "Your Last Name"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "username": "johndoe",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Response**:
```json
{
  "user": {
    "id": "cm123abc456",
    "email": "john.doe@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "role": "USER",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "User created successfully"
}
```

### 2. User Login

**Endpoint**: `POST /api/v1/auth/login`

**Request Body**:
```json
{
  "emailOrUsername": "your-email@example.com",
  "password": "your-password"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "john.doe@example.com",
    "password": "SecurePass123!"
  }'
```

**Response**:
```json
{
  "user": {
    "id": "cm123abc456",
    "email": "john.doe@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "role": "USER",
    "isActive": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Get User Profile

**Endpoint**: `GET /api/v1/auth/profile`

**Headers**: `Authorization: Bearer {token}`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "user": {
    "id": "cm123abc456",
    "email": "john.doe@example.com",
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

### 4. Update User Profile

**Endpoint**: `PUT /api/v1/auth/profile`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@example.com"
}
```

### 5. Using Access Tokens

Include the access token in the `Authorization` header for all protected endpoints:

```bash
curl -X GET http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 📁 Project Management

### 1. Create Project

**Endpoint**: `POST /api/v1/projects`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "name": "My Code Repository",
  "description": "AI analysis of my React application",
  "repositoryPath": "/Users/john/projects/my-app",
  "repositoryUrl": "https://github.com/john/my-app.git",
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

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My React App",
    "description": "Personal project for AI analysis",
    "repositoryPath": "/Users/john/projects/react-app"
  }'
```

**Response**:
```json
{
  "project": {
    "id": "proj_123abc456",
    "name": "My React App",
    "slug": "my-react-app",
    "description": "Personal project for AI analysis",
    "repositoryPath": "/Users/john/projects/react-app",
    "settings": {
      "branch": "main",
      "includePatterns": ["**/*"],
      "excludePatterns": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/coverage/**"],
      "maxFileSize": 1048576,
      "enableAutoSync": true,
      "syncInterval": 3600,
      "followSymlinks": false
    },
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 2. List Projects

**Endpoint**: `GET /api/v1/projects`

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `limit` (optional): Number of projects to return (default: 50, max: 100)
- `offset` (optional): Number of projects to skip (default: 0)
- `status` (optional): Filter by status (`ACTIVE`, `INACTIVE`)

**Example**:
```bash
curl -X GET "http://localhost:3000/api/v1/projects?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "projects": [
    {
      "id": "proj_123abc456",
      "name": "My React App",
      "slug": "my-react-app",
      "description": "Personal project for AI analysis",
      "repositoryPath": "/Users/john/projects/react-app",
      "settings": {
        "branch": "main",
        "includePatterns": ["**/*"],
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

### 3. Get Project Details

**Endpoint**: `GET /api/v1/projects/{projectId}`

**Headers**: `Authorization: Bearer {token}`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/projects/proj_123abc456 \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Update Project

**Endpoint**: `PUT /api/v1/projects/{projectId}`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
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

**Example**:
```bash
curl -X PUT http://localhost:3000/api/v1/projects/proj_123abc456 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated React App",
    "description": "Updated description"
  }'
```

### 5. Delete Project

**Endpoint**: `DELETE /api/v1/projects/{projectId}`

**Headers**: `Authorization: Bearer {token}`

**Example**:
```bash
curl -X DELETE http://localhost:3000/api/v1/projects/proj_123abc456 \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "Project deleted successfully",
  "deletedProject": {
    "id": "proj_123abc456",
    "name": "My React App",
    "slug": "my-react-app"
  }
}
```

---

## 🔄 Repository Embedding Process

### 1. Start Embedding/Sync

**Endpoint**: `POST /api/v1/projects/{projectId}/sync`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "force": false
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/projects/proj_123abc456/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

**Response**:
```json
{
  "status": "success",
  "message": "Sync started successfully",
  "syncId": "sync_789xyz",
  "project": {
    "id": "proj_123abc456",
    "name": "My React App",
    "lastSyncAt": "2024-01-15T10:35:00Z"
  }
}
```

---

## 🤖 AI Query Processing

### 1. Ask Questions

**Endpoint**: `POST /api/v1/query/ask`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "query": "How does user authentication work in this codebase?",
  "projectId": "proj_123abc456",
  "context": {
    "conversationHistory": [],
    "userPreferences": {
      "responseStyle": "detailed",
      "includeCodeExamples": true
    }
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/query/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main components of this React application?",
    "projectId": "proj_123abc456"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "response": {
      "id": "resp_456def789",
      "queryId": "query_123abc456",
      "intent": "CODE_EXPLANATION",
      "pipeline": "CODE_ANALYSIS",
      "response": "Based on your React application, the main components are...",
      "sources": [
        {
          "id": "doc_789xyz123",
          "type": "code",
          "title": "App.jsx",
          "content": "import React from 'react'...",
          "path": "src/App.jsx",
          "score": 0.95
        }
      ],
      "confidence": 0.92,
      "executionTime": 1250
    }
  },
  "correlationId": "req_123456"
}
```

### 2. Batch Queries

**Endpoint**: `POST /api/v1/query/batch`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "queries": [
    {
      "query": "What is the main entry point?",
      "projectId": "proj_123abc456"
    },
    {
      "query": "How is routing handled?",
      "projectId": "proj_123abc456"
    }
  ]
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/query/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {"query": "What is the main entry point?", "projectId": "proj_123abc456"},
      {"query": "How is routing handled?", "projectId": "proj_123abc456"}
    ]
  }'
```

### 3. Conversation Mode

**Endpoint**: `POST /api/v1/query/conversation`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
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
  "projectId": "proj_123abc456"
}
```

### 4. Query History

**Endpoint**: `GET /api/v1/query/history`

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `projectId` (optional): Filter by project
- `sessionId` (optional): Filter by session
- `limit` (optional): Number of queries to return (default: 50, max: 100)
- `offset` (optional): Number of queries to skip (default: 0)

**Example**:
```bash
curl -X GET "http://localhost:3000/api/v1/query/history?projectId=proj_123abc456&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Provide Feedback

**Endpoint**: `POST /api/v1/query/{queryId}/feedback`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "rating": 5,
  "feedback": "Very helpful response!",
  "helpful": true
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/query/query_123abc456/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "feedback": "Very helpful response!",
    "helpful": true
  }'
```

---

## 🏥 Health & Monitoring

### 1. System Health

**Endpoint**: `GET /api/v1/health`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/health
```

**Response**:
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
  "correlationId": "req_123456"
}
```

### 2. Liveness Probe

**Endpoint**: `GET /api/v1/health/live`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/health/live
```

### 3. Readiness Probe

**Endpoint**: `GET /api/v1/health/ready`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/health/ready
```

### 4. System Metrics

**Endpoint**: `GET /api/v1/health/metrics`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/health/metrics
```

### 5. Version Information

**Endpoint**: `GET /api/v1/health/version`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/health/version
```

---

## 📊 Enhanced Monitoring

### 1. Monitoring Health

**Endpoint**: `GET /api/v1/monitoring/health`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/monitoring/health
```

### 2. Quick Health Check

**Endpoint**: `GET /api/v1/monitoring/health/quick`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/monitoring/health/quick
```

### 3. Detailed Metrics

**Endpoint**: `GET /api/v1/monitoring/metrics`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/monitoring/metrics
```

### 4. Prometheus Metrics

**Endpoint**: `GET /api/v1/monitoring/metrics/prometheus`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/monitoring/metrics/prometheus
```

### 5. Monitoring Status

**Endpoint**: `GET /api/v1/monitoring/status`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/monitoring/status
```

### 6. Active Alerts

**Endpoint**: `GET /api/v1/monitoring/alerts`

**Example**:
```bash
curl -X GET http://localhost:3000/api/v1/monitoring/alerts
```

---

## 🔧 Complete Workflow Example

Here's a complete example of setting up an account and analyzing a codebase:

```bash
#!/bin/bash

# Configuration
API_BASE="http://localhost:3000/api/v1"
EMAIL="developer@example.com"
USERNAME="developer"
PASSWORD="SecurePass123!"
REPO_PATH="/Users/dev/projects/my-app"

echo "🚀 Starting Hikma API workflow..."

# Step 1: Register user
echo "📝 Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"username\": \"$USERNAME\",
    \"password\": \"$PASSWORD\",
    \"firstName\": \"Developer\",
    \"lastName\": \"User\"
  }")

echo "Registration response: $REGISTER_RESPONSE"

# Step 2: Login to get token
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"emailOrUsername\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "✅ User logged in. Token: ${ACCESS_TOKEN:0:20}..."

# Step 3: Create project
echo "📁 Creating project..."
PROJECT_RESPONSE=$(curl -s -X POST "$API_BASE/projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"My Application\",
    \"description\": \"AI analysis of my codebase\",
    \"repositoryPath\": \"$REPO_PATH\"
  }")

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.project.id')
echo "✅ Project created. ID: $PROJECT_ID"

# Step 4: Start embedding process
echo "🔄 Starting embedding process..."
SYNC_RESPONSE=$(curl -s -X POST "$API_BASE/projects/$PROJECT_ID/sync" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": false}')

echo "✅ Embedding process started"
echo "Sync response: $SYNC_RESPONSE"

# Step 5: Wait a moment then ask a question
echo "⏳ Waiting for embedding to process..."
sleep 5

echo "🤖 Asking AI about the codebase..."
QUERY_RESPONSE=$(curl -s -X POST "$API_BASE/query/ask" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"What is the main purpose of this codebase?\",
    \"projectId\": \"$PROJECT_ID\"
  }")

echo "💬 AI Response:"
echo $QUERY_RESPONSE | jq -r '.data.response.response // "No response available yet"'

# Step 6: Check system health
echo "🏥 Checking system health..."
HEALTH_RESPONSE=$(curl -s -X GET "$API_BASE/health")
HEALTH_STATUS=$(echo $HEALTH_RESPONSE | jq -r '.status')
echo "📊 System status: $HEALTH_STATUS"

echo "🎉 Workflow completed successfully!"
```

---

## 🚨 Error Handling

### Common HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Error Response Format

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Email is required",
  "correlationId": "req_123456",
  "details": {
    "field": "email",
    "code": "REQUIRED"
  }
}
```

---

## 🔒 Security Best Practices

1. **Store tokens securely**: Never log or expose access tokens
2. **Use HTTPS**: Always use HTTPS in production
3. **Token expiration**: Access tokens expire in 1 hour by default
4. **Rate limiting**: Respect rate limits (100 requests per 15 minutes by default)
5. **Strong passwords**: Use strong passwords for user accounts
6. **Environment variables**: Store sensitive configuration in environment variables

---

## 📚 Interactive Documentation

For interactive API exploration, visit the Swagger UI when the server is running:

**URL**: `http://localhost:3000/documentation`

This provides:
- Interactive API testing
- Request/response examples
- Schema validation
- Authentication testing

---

## 🆘 Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check if your access token is valid and not expired
2. **404 Not Found**: Verify the endpoint URL and resource IDs
3. **429 Rate Limited**: Wait before making more requests
4. **500 Server Error**: Check server logs and health endpoints

### Getting Help

- Check the health endpoints: `/api/v1/health`
- Review server logs for detailed error information
- Verify your environment configuration
- Ensure all required services (PostgreSQL, Redis, Qdrant) are running

### Debug Commands

```bash
# Check API status
curl -X GET http://localhost:3000/api/v1/docs

# Check system health
curl -X GET http://localhost:3000/api/v1/health

# Check monitoring status
curl -X GET http://localhost:3000/api/v1/monitoring/status

# Get version information
curl -X GET http://localhost:3000/api/v1/health/version
```

---

## 📖 Additional Resources

- **API Reference**: `docs/API_REFERENCE.md`
- **Architecture Documentation**: `docs/ARCHITECTURE.md`
- **Setup Guide**: `docs/SETUP_GUIDE.md`
- **Swagger UI**: `http://localhost:3000/documentation`
- **OpenAPI Spec**: `http://localhost:3000/documentation/json`

---

*This guide covers all the essential API endpoints and workflows for the Hikma platform. For more detailed technical information, refer to the other documentation files in the `docs/` directory.*
