# API Documentation (OpenAPI/Swagger)

This document outlines how to access the API documentation for the Hikma backend service. The API is self-documenting using Fastify's built-in OpenAPI/Swagger capabilities with @fastify/swagger and @fastify/swagger-ui.

## 1. Accessing the Swagger UI

For a user-friendly, interactive API documentation interface, the application integrates with Swagger UI. This allows you to visualize the API, understand its endpoints, and even make test requests directly from your browser.

### Endpoint for Swagger UI:

```
GET /documentation
```

Once the server is running, navigate to this URL in your browser to access the interactive Swagger UI:

**Development:** http://localhost:3000/documentation
**Production:** https://api.hikma.ai/documentation

You will see a list of all available API endpoints, their methods, parameters, and expected responses.

### Alternative Access:

```
GET /docs
```

This endpoint redirects to `/documentation` for convenience.

## 2. Getting the OpenAPI Specification

To get the raw OpenAPI (Swagger) specification in JSON format:

### Endpoint for OpenAPI JSON:

```
GET /documentation/json
```

This endpoint returns the full OpenAPI 3.0 specification in JSON format. You can save this JSON to a file (e.g., `openapi.json`) and use it with any OpenAPI-compatible tool.

## 3. API Information Endpoint

For basic API information and available endpoints:

```
GET /api/v1/docs
```

This returns a JSON object with:
- API name and version
- Available endpoint prefixes
- Links to documentation

## 4. Key Sections in Swagger UI

When you access the Swagger UI, you will find documentation for the following main API sections:

### Authentication
- **POST /api/v1/auth/register** - User registration
- **POST /api/v1/auth/login** - User login
- **POST /api/v1/auth/refresh** - Token refresh
- **POST /api/v1/auth/logout** - User logout
- **GET /api/v1/auth/profile** - Get user profile
- **PUT /api/v1/auth/profile** - Update user profile
- **POST /api/v1/auth/change-password** - Change password

### Query Processing
- **POST /api/v1/query** - Submit a natural language query
- **GET /api/v1/query/{id}** - Get query result
- **POST /api/v1/query/batch** - Submit batch queries
- **GET /api/v1/query/conversations** - Get conversation history
- **POST /api/v1/query/feedback** - Provide feedback on responses

### Project Management
- **GET /api/v1/projects** - List projects
- **POST /api/v1/projects** - Create a new project
- **GET /api/v1/projects/{id}** - Get project details
- **PUT /api/v1/projects/{id}** - Update project
- **DELETE /api/v1/projects/{id}** - Delete project
- **POST /api/v1/projects/{id}/sync** - Trigger data synchronization

### Health Checks
- **GET /api/v1/health** - Comprehensive health check
- **GET /api/v1/health/live** - Liveness probe (Kubernetes)
- **GET /api/v1/health/ready** - Readiness probe (Kubernetes)
- **GET /api/v1/health/metrics** - System metrics
- **GET /api/v1/health/version** - Version information
- **GET /api/v1/health/services/knowledge** - Knowledge service health
- **GET /api/v1/health/services/agent** - Agent service health

## 5. Authentication in Swagger UI

The API supports two authentication methods:

### Bearer Token (JWT)
1. Click the "Authorize" button in Swagger UI
2. Enter your JWT token in the "bearerAuth" field
3. Format: `Bearer your-jwt-token-here`

### API Key
1. Click the "Authorize" button in Swagger UI
2. Enter your API key in the "apiKey" field
3. The key will be sent in the `X-API-Key` header

## 6. Making Test Requests via Swagger UI

Swagger UI allows you to directly interact with the API:

1. **Authorize**: Click the "Authorize" button and enter your authentication credentials
2. **Select Endpoint**: Click on any endpoint to expand its details
3. **Try it out**: Click the "Try it out" button
4. **Fill Parameters**: Enter required parameters and request body
5. **Execute**: Click "Execute" to make the request
6. **View Response**: See the response body, headers, and status code

## 7. Response Details

Each endpoint in Swagger UI shows:
- **HTTP Method** (GET, POST, PUT, DELETE)
- **Path** with parameter placeholders
- **Description** of what the endpoint does
- **Parameters**: Query, Path, Header, and Body parameters with types and descriptions
- **Request Body**: Expected JSON structure for POST/PUT requests
- **Responses**: Possible HTTP status codes and their JSON response structures
- **Security**: Authentication requirements

## 8. Development vs Production

### Development
- Swagger UI is fully enabled
- All endpoints are documented
- CORS allows all origins
- Detailed error messages

### Production
- Swagger UI is available but may have restricted access
- CORS is configured for specific origins
- Error messages are sanitized
- Additional security headers are applied

## 9. Troubleshooting

### Swagger UI not loading
- Ensure the server is running
- Check that `/documentation` returns the Swagger UI page
- Verify Content Security Policy allows Swagger UI assets
- Check browser console for JavaScript errors

### Authentication issues
- Verify your JWT token is valid and not expired
- Check that the token includes the `Bearer ` prefix
- Ensure API keys are correctly formatted

### CORS errors
- In development, all origins are allowed
- In production, ensure your domain is in the CORS allowlist

## 10. OpenAPI Specification Details

The generated OpenAPI specification includes:
- **Version**: OpenAPI 3.0.0
- **Info**: API title, description, version, contact, and license
- **Servers**: Development and production server URLs
- **Security Schemes**: JWT Bearer and API Key authentication
- **Components**: Reusable schemas and security definitions
- **Paths**: All API endpoints with full documentation

This comprehensive documentation ensures that developers can easily understand and integrate with the Hikma API.

