# Route Management System

This directory contains the centralized route management system for the Hikma API. The system provides organized, scalable route management with clear separation between public and private routes.

## Architecture Overview

```
src/app/routes/
├── README.md              # This documentation
├── types.ts               # Type definitions
├── registry.ts            # Route registry implementation  
├── manager.ts             # Central route manager
├── index.ts              # Public exports
├── groups/
│   ├── public.ts         # Public routes (no auth required)
│   └── private.ts        # Private routes (auth required)
└── [existing route files]
```

## Key Components

### 1. Route Manager (`manager.ts`)
The central orchestrator that coordinates all route registration:
- Initializes the route registry
- Discovers and registers routes automatically
- Provides a clean interface for server integration
- Handles route grouping and authentication

### 2. Route Registry (`registry.ts`)
Handles route discovery and registration:
- Auto-discovers route files from configured directories
- Manages route metadata and configuration
- Provides route inspection and debugging capabilities
- Handles dynamic route loading

### 3. Route Groups (`groups/`)
Organizes routes by access level:
- **Public Routes**: Health checks, monitoring, authentication endpoints
- **Private Routes**: User-specific functionality that requires authentication

## Route Categories

### Public Routes (No Authentication Required)
- **Health**: `/api/v1/health/*` - System health and status endpoints
- **Monitoring**: `/api/v1/monitoring/*` - Metrics and monitoring endpoints  
- **Auth**: `/api/v1/auth/*` - Login, registration, and authentication endpoints
- **Documentation**: `/api/v1/docs`, `/docs` - API documentation

### Private Routes (Authentication Required)
- **Query**: `/api/v1/query/*` - AI query and search endpoints
- **Projects**: `/api/v1/projects/*` - Project management endpoints
- **User Profile**: `/api/v1/user/*` - User profile and session management

## Usage

### Server Integration
The route manager is automatically integrated in `server.ts`:

```typescript
import { routeManager } from './routes/manager';

async function registerRoutes(server: FastifyInstance): Promise<void> {
  await routeManager.initialize();
  await routeManager.registerRoutes(server);
}
```

### Adding New Routes

#### Option 1: Create New Route File
1. Create a new route file following the naming convention: `*.routes.ts`
2. Export a Fastify plugin as default export
3. Add the file path to the known routes list in `registry.ts`

Example:
```typescript
// src/domains/analytics/api/analytics.routes.ts
import { FastifyPluginAsync } from 'fastify';

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    // Route implementation
  });
};
```

#### Option 2: Manual Registration
```typescript
import { routeManager } from '@/app/routes/manager';

await routeManager.registerAdditionalRoute(
  fastify,
  'analytics',
  analyticsRoutes,
  {
    prefix: '/api/v1/analytics',
    requiresAuth: true,
    tags: ['analytics']
  }
);
```

### Authentication Handling
Routes are automatically configured with authentication based on:
1. Route group classification (public vs private)
2. Route name matching against configured lists
3. Manual configuration in route options

## Benefits of This System

### 1. **Scalability**
- Easy to add new domain modules without modifying server.ts
- Automatic route discovery as the project grows
- Clear separation of concerns

### 2. **Security**  
- Centralized authentication handling
- Clear distinction between public and private routes
- Consistent security policy application

### 3. **Maintainability**
- Organized route structure
- Standardized route patterns
- Easy debugging and inspection

### 4. **Developer Experience**
- Auto-discovery reduces boilerplate
- Clear conventions and patterns
- Comprehensive error handling

## Migration from Old System

The refactoring addressed several issues from the previous system:

### Before:
- Routes scattered between `src/app/routes/` and `src/domains/*/api/`
- Manual registration in `server.ts`
- Inconsistent authentication handling
- No clear organization strategy

### After:
- Centralized route management through `RouteManager`
- Automatic route discovery and registration
- Clear public/private route separation
- Scalable architecture for growing domains

## Configuration

The route manager can be configured with options:

```typescript
const routeManager = new RouteManager({
  autoDiscovery: true,
  routeDirectories: [
    'src/app/routes',
    'src/domains/*/api'
  ],
  publicRoutes: ['health', 'monitoring', 'user'],
  privateRoutes: ['query', 'projects']
});
```

## Debugging

Get route information for debugging:

```typescript
// Get complete route summary
const summary = routeManager.getRouteSummary();
console.log(summary);

// Get registry for detailed inspection  
const registry = routeManager.getRegistry();
const allRoutes = registry.getRoutes();
const publicRoutes = registry.getPublicRoutes();
const privateRoutes = registry.getPrivateRoutes();
```

## Future Enhancements

- **Rate Limiting**: Per-route rate limiting configuration
- **Caching**: Route-level caching strategies
- **Versioning**: API version management
- **Documentation**: Automatic OpenAPI spec generation
- **Middleware**: Route-specific middleware chains
- **Metrics**: Route-level performance metrics
