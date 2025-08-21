# API Documentation (OpenAPI/Swagger)

This document outlines how to generate and access the API documentation for the Hikma backend service. The API is designed to be self-documenting using Fastify's built-in OpenAPI/Swagger capabilities.

## 1. Generating the OpenAPI Specification

The Fastify application is configured to automatically generate an OpenAPI (Swagger) specification based on the defined routes and their schemas (using Zod for validation).

To generate the OpenAPI specification, you need to run the application and access a specific endpoint.

### Endpoint for OpenAPI JSON:

```
GET /documentation/json
```

This endpoint will return the full OpenAPI 3.0 specification in JSON format. You can save this JSON to a file (e.g., `openapi.json`) and use it with any OpenAPI-compatible tool.

## 2. Accessing the Swagger UI

For a user-friendly, interactive API documentation interface, the application integrates with Swagger UI. This allows you to visualize the API, understand its endpoints, and even make test requests directly from your browser.

### Endpoint for Swagger UI:

```
GET /documentation
```

Once the server is running, navigate to this URL in your browser to access the interactive Swagger UI. You will see a list of all available API endpoints, their methods, parameters, and expected responses.

## 3. Key Sections in Swagger UI

When you access the Swagger UI, you will find documentation for the following main API sections:

*   **Authentication**: Endpoints for user registration, login, token refresh, logout, profile management, and password changes.
*   **Query Processing**: Endpoints for asking questions, batch queries, managing conversations, and providing feedback.
*   **Project Management**: Endpoints for creating, retrieving, updating, and deleting projects.
*   **Health Checks**: Endpoints for monitoring the health and metrics of the service.

Each endpoint will detail:
*   **HTTP Method** (GET, POST, PUT, DELETE)
*   **Path**
*   **Description**
*   **Request Parameters**: Query, Path, Header, and Body parameters with their types and descriptions.
*   **Request Body**: Expected JSON structure for POST/PUT requests.
*   **Responses**: Possible HTTP status codes (e.g., 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 500 Internal Server Error) and their corresponding JSON response structures.
*   **Security**: Indication of whether the endpoint requires authentication (e.g., JWT Bearer token).

## 4. Making Test Requests via Swagger UI

Swagger UI allows you to directly interact with the API:

1.  **Authorize**: Click the 

