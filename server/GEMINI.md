# GEMINI.md

## Project Overview

This project is a TypeScript-based backend service for an "Agentic Code Intelligence Platform" called Hikma. It uses the Fastify framework and follows a modular monolithic architecture. The platform integrates with various data sources like Git repositories, GitHub PRs, and Jira tickets to provide intelligent insights into a codebase.

The system uses a polyglot persistence approach, leveraging multiple databases for different purposes:
*   **PostgreSQL:** For structured data like user information, query logs, and metadata.
*   **Redis:** For caching, session storage, and message queuing.
*   **Neo4j:** For storing and querying graph-based data, representing relationships between code, PRs, tickets, and developers.
*   **Qdrant/Pinecone:** For storing vector embeddings to enable semantic search and other AI-powered features.

The application is containerized using Docker and can be orchestrated with Docker Compose.

## Building and Running

### Prerequisites

*   Node.js (>=18.0.0)
*   npm (>=8.0.0)
*   Docker

### Installation

```bash
npm install
```

### Development

To run the server in development mode with hot-reloading:

```bash
npm run dev
```

### Building for Production

To build the application for production:

```bash
npm run build
```

This will create a `dist` directory with the compiled JavaScript files.

### Running in Production

To start the server in production:

```bash
npm start
```

### Testing

The project uses `vitest` for testing. The following commands are available:

*   Run all tests:
    ```bash
    npm test
    ```
*   Run unit tests:
    ```bash
    npm run test:unit
    ```
*   Run integration tests:
    ```bash
    npm run test:integration
    ```
*   Run end-to-end tests:
    ```bash
    npm run test:e2e
    ```

### Database

The project uses Prisma for database migrations.

*   Generate Prisma client:
    ```bash
    npm run db:generate
    ```
*   Apply database migrations:
    ```bash
    npm run migrate
    ```
*   Run migrations in development:
    ```bash
    npm run migrate:dev
    ```

## Development Conventions

*   **Linting:** The project uses ESLint for static code analysis. To run the linter:
    ```bash
    npm run lint
    ```
*   **Formatting:** Prettier is used for code formatting. To format the codebase:
    ```bash
    npm run format
    ```
*   **Type Checking:** To check for TypeScript errors:
    ```bash
    npm run typecheck
    ```
*   **Architecture:** The codebase is organized into a modular monolithic architecture. The main directories are:
    *   `src/app`: Fastify server, routes, and middleware.
    *   `src/domains`: Domain-specific logic (e.g., users, projects).
    *   `src/knowledge`: Knowledge base and data ingestion.
    *   `src/agents`: AI agents and orchestration.
    *   `src/workflow`: Workflow automation.
    *   `src/analytics`: Analytics and evaluation.
    *   `src/infrastructure`: Databases, external APIs, and monitoring.
    *   `src/shared`: Shared utilities and decorators.
*   **Entry Point:** The main entry point for the application is `src/app/server.ts`.
*   **Build Tool:** `esbuild` is used for building the project. The configuration is in `esbuild.config.js`.
*   **TypeScript Execution:** `tsx` is used to run TypeScript files directly in development.
