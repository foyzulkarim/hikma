# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - ESLint code style checking
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Database Operations
- `npm run db:generate` - Generate Prisma client (run after schema changes)
- `npm run db:push` - Push schema to database (development)
- `npm run migrate:dev` - Create and apply migrations (development)
- `npm run migrate` - Apply migrations (production)
- `npm run db:studio` - Open Prisma Studio database browser

### Testing
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ui` - Run tests with Vitest UI

### Docker Services
- `docker-compose up -d postgres redis neo4j qdrant` - Start required databases
- `npm run docker:up` - Start all services with Docker Compose
- `npm run docker:down` - Stop all Docker services

### Setup
- `npm run setup` - Install dependencies, generate Prisma client, and run migrations

## Architecture Overview

Hikma follows a **modular monolithic architecture** with onion architecture principles:

### Core Layers
1. **Core Layer** (`src/core/`) - Types, errors, utilities, constants
2. **Infrastructure Layer** (`src/infrastructure/`) - Databases, external APIs, monitoring  
3. **Domain Layer** (`src/domains/`) - Business logic for users, projects
4. **Module Layer** - Cross-cutting concerns:
   - `src/knowledge/` - Knowledge base, ingestion, vector search
   - `src/agents/` - AI agents and orchestration
   - `src/workflow/` - Workflow automation
   - `src/analytics/` - Analytics and evaluation
5. **Interface Layer** (`src/app/`) - API routes, WebSocket, middleware

### Key Technology Stack
- **Backend**: Fastify + TypeScript (ESM modules)
- **Databases**: 
  - PostgreSQL with Prisma ORM (structured data)
  - Redis (caching, sessions)  
  - Neo4j (knowledge graphs, relationships)
  - Qdrant (vector embeddings for semantic search)
- **AI/ML**: OpenAI API, LangChain, Tree-sitter AST parsing
- **External**: GitHub CLI, simple-git for repository operations

### Database Architecture
The system uses a multi-database approach:
- **PostgreSQL**: Users, projects, query logs, structured metadata
- **Redis**: Caching, session storage, background job queues
- **Neo4j**: Relationship graphs between code entities, PRs, tickets, developers
- **Qdrant**: Vector embeddings for semantic code search

## Development Workflow

### Environment Setup
1. Copy `.env.example` to `.env` and configure:
   - `OPENAI_API_KEY` (required)
   - Database connection strings
   - JWT secrets
2. Start database services: `docker-compose up -d postgres redis neo4j qdrant`
3. Run setup: `npm run setup`
4. Start development: `npm run dev`

### Code Organization Principles
- Use **path aliases**: `@/` maps to `src/`, `@tests/` maps to `tests/`
- Follow **domain-driven design** in `src/domains/`
- Keep **infrastructure concerns** separate in `src/infrastructure/`
- Use **dependency injection** and **repository pattern**
- Implement proper **error handling** with custom error types

### Testing Strategy  
- **Unit tests**: `tests/unit/` - Test individual functions/classes
- **Integration tests**: `tests/integration/` - Test API endpoints with real databases
- **E2E tests**: `tests/e2e/` - Test complete user journeys
- Test files use `.test.ts` or `.spec.ts` suffix
- Uses Vitest with global test utilities and mocking

### Key Architectural Patterns
- **Event-driven architecture**: Uses internal event bus for decoupled communication
- **Repository pattern**: Data access abstraction in domain layers
- **Service layer**: Business logic encapsulation
- **Middleware chain**: Request processing pipeline in Fastify
- **Graceful shutdown**: Proper cleanup of connections and services

## Important Implementation Notes

### AST Parsing
The system uses Tree-sitter for intelligent code analysis across multiple languages (TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, C#). AST parsing enables semantic understanding beyond simple text search.

### Vector Search Integration
Qdrant vector database provides semantic search capabilities. Documents are embedded using OpenAI embeddings and stored for similarity search alongside traditional keyword search.

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control for projects and resources  
- Auth middleware at `src/domains/users/auth/`

### API Documentation
- Swagger/OpenAPI documentation available at `/documentation`
- API schema at `/docs/json`
- All routes should include proper schemas and documentation

### Monitoring & Health Checks
- Health endpoint at `/api/v1/health` with database connectivity checks
- Structured JSON logging with correlation IDs
- Prometheus metrics support (optional monitoring stack in docker-compose)

### Always run these commands before committing:
1. `npm run typecheck` - Ensure TypeScript compiles
2. `npm run lint` - Check code style  
3. `npm test` - Ensure tests pass