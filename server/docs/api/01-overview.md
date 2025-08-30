# API Overview

Welcome to the Hikma Agentic Code Intelligence Platform API documentation. This guide will help you understand and integrate with our comprehensive REST API.

## 📖 Documentation Structure

This API documentation is organized in a logical reading sequence:

1. **[01-overview.md](./01-overview.md)** *(You are here)* - API overview and getting started
2. **[02-api-reference.md](./02-api-reference.md)** - Complete API reference with all endpoints
3. **[03-setup-guide.md](./03-setup-guide.md)** - Step-by-step setup and usage examples

## 🚀 What is Hikma?

Hikma is an Agentic Code Intelligence Platform that provides AI-powered code analysis, project management, and intelligent query processing capabilities. The API allows you to:

- **Analyze codebases** with AI-powered insights
- **Manage projects** and repositories
- **Query code** using natural language
- **Monitor system health** and performance
- **Automate workflows** with intelligent triggers

## 🌐 Base URLs

- **Development**: `http://localhost:3000`
- **Production**: `https://api.hikma.dev`

## 📋 API Version

Current API version: **v1**

All endpoints are prefixed with `/api/v1` unless otherwise specified.

## 🔐 Authentication

The API uses **JWT-based authentication** with Bearer tokens:

```http
Authorization: Bearer <your-jwt-token>
```

### Quick Authentication Flow
1. **Register**: `POST /api/v1/auth/register`
2. **Login**: `POST /api/v1/auth/login` → Get JWT token
3. **Use Token**: Include in `Authorization` header for protected endpoints

## 🗂️ Main API Categories

### 🔐 Authentication & User Management
Manage user accounts, authentication, and profiles.
- User registration and login
- Profile management
- JWT token handling

### 📁 Project Management  
Create and manage code analysis projects.
- Project CRUD operations
- Repository synchronization
- Project settings and configuration

### 🤖 AI Query Processing
Interact with AI agents to analyze and understand code.
- Natural language queries
- Conversation-based interactions
- Batch processing
- Query history and feedback

### 🏥 Health & Monitoring
Monitor system health and performance.
- Health checks for Kubernetes
- System metrics and statistics
- Alert management
- Service status monitoring

## 🚦 HTTP Status Codes

The API uses standard HTTP status codes:

- **2xx Success**: Request successful
- **4xx Client Error**: Invalid request or authentication
- **5xx Server Error**: Server-side error

## 📊 Response Format

All API responses follow a consistent JSON structure:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "correlationId": "req_123456"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "correlationId": "req_123456",
  "details": {
    // Additional error details
  }
}
```

## 🔄 Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated**: Higher limits for authenticated users
- **Headers**: Rate limit info included in response headers

## 📄 Pagination

List endpoints support pagination:

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

## 🌐 CORS Support

- **Development**: All origins allowed
- **Production**: Configured for specific origins

## 🔌 WebSocket Support

Real-time features available via WebSocket:
- **Endpoint**: `ws://localhost:3000/ws`
- **Authentication**: JWT token required
- **Features**: Real-time query updates, notifications

## 🧪 Interactive Documentation

### Swagger UI
Access interactive API documentation at:
- **URL**: `http://localhost:3000/documentation`
- **Features**: Live testing, request/response examples, schema validation

### API Information Endpoint
Get basic API info:
```bash
curl -X GET http://localhost:3000/api/v1/docs
```

## 🚀 Quick Start Example

Here's a complete example to get you started:

```bash
# 1. Register a user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "username": "developer",
    "password": "SecurePass123!",
    "firstName": "Developer",
    "lastName": "User"
  }'

# 2. Login to get token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "developer@example.com",
    "password": "SecurePass123!"
  }'

# 3. Use the token from login response
export TOKEN="your-jwt-token-here"

# 4. Create a project
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "repositoryPath": "/path/to/your/repo"
  }'

# 5. Ask AI about your code
curl -X POST http://localhost:3000/api/v1/query/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the main purpose of this codebase?",
    "projectId": "your-project-id"
  }'
```

## 📚 Next Steps

1. **[Read the API Reference](./02-api-reference.md)** - Complete endpoint documentation
2. **[Follow the Setup Guide](./03-setup-guide.md)** - Detailed setup instructions
3. **[Try the Swagger UI](http://localhost:3000/documentation)** - Interactive testing

## 🆘 Getting Help

- **Health Check**: `GET /api/v1/health`
- **System Status**: `GET /api/v1/monitoring/status`
- **Documentation**: `GET /api/v1/docs`
- **Interactive UI**: `http://localhost:3000/documentation`

## 🔄 Recent Updates

This documentation reflects the current state after recent architectural refactoring:

### ✅ New Features
- Domain-driven architecture
- Enhanced JWT authentication
- Conversation-based AI queries
- Comprehensive monitoring
- Real-time WebSocket support

### 🔄 Changed Structure
- Organized endpoint grouping
- Improved error handling
- Enhanced security
- Better performance monitoring

---

**Ready to get started?** Continue to the **[API Reference](./02-api-reference.md)** for complete endpoint documentation, or jump to the **[Setup Guide](./03-setup-guide.md)** for hands-on examples.

---

*Last updated: January 2024*
