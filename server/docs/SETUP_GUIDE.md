# Hikma Setup & Running Guide

This guide will help you set up and run the Hikma system locally for testing and development.

## Prerequisites

### Required Software
- **Node.js**: Version 20.x or higher
- **npm**: Version 9.x or higher (comes with Node.js)
- **Docker**: Version 20.x or higher
- **Docker Compose**: Version 2.x or higher
- **Git**: Latest version

### Required Accounts/Services
- **OpenAI API Account**: For LLM and embedding services
- **Pinecone Account**: For vector database (free tier available)

---

## Part 1: Infrastructure Setup

### Step 1: Clone and Setup Project

```bash
# Clone the repository (or extract the provided files)
cd hikma

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Step 2: Configure Environment Variables

Edit the `.env` file with your configuration:

```bash
# Application Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL="postgresql://hikma:hikma123@localhost:5432/hikma"
REDIS_URL="redis://localhost:6379"
NEO4J_URI="bolt://localhost:7687"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="hikma123"

# Vector Database
# Pinecone is no longer used - using alternative vector store

# LLM Configuration (OpenAI)
OPENAI_API_KEY="your-openai-api-key"
OPENAI_API_BASE="https://api.openai.com/v1"
LLM_MODEL="gpt-3.5-turbo"
EMBEDDING_MODEL="text-embedding-ada-002"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Logging
LOG_LEVEL="debug"
```

### Step 3: Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and Neo4j using Docker Compose
docker-compose up -d

# Wait for services to be ready (about 30-60 seconds)
docker-compose ps
```

### Step 4: Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# (Optional) Seed database with sample data
npx prisma db seed
```

### Step 5: Vector Database Setup

The application now uses an alternative vector store (no longer Pinecone).
Vector database configuration will be handled automatically.
   - **Dimensions**: `1536` (for OpenAI ada-002 embeddings)
   - **Metric**: `cosine`
   - **Pod Type**: `p1.x1` (free tier)

### Step 6: Verify Infrastructure

```bash
# Check database connection
npx prisma studio
# This should open Prisma Studio at http://localhost:5555

# Check Docker services
docker-compose logs
# Should show healthy logs for postgres, redis, and neo4j
```

---

## Part 2: Running the Application

### Step 1: Build the Application

```bash
# Compile TypeScript
npm run build

# Or for development with watch mode
npm run dev
```

### Step 2: Start the Server

```bash
# Production mode
npm start

# Development mode with hot reload
npm run dev

# The server will start on http://localhost:3000
```

### Step 3: Verify Server is Running

```bash
# Check health endpoint
curl http://localhost:3000/api/v1/health

# Check API documentation
curl http://localhost:3000/api/v1/docs

# Check root endpoint
curl http://localhost:3000/
```

Expected response from health check:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "uptime": 123.456,
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
  }
}
```

---

## Part 3: Testing the System

### Step 1: Register a User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Step 2: Login and Get Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the `accessToken` from the response for subsequent requests.

### Step 3: Create a Project

```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Test Project",
    "description": "A test project for Hikma",
    "repositoryPath": "/path/to/your/git/repo"
  }'
```

### Step 4: Test Query Processing

```bash
curl -X POST http://localhost:3000/api/v1/query/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "query": "What is this codebase about?",
    "projectId": "YOUR_PROJECT_ID"
  }'
```

---

## Development Commands

### Database Management
```bash
# Reset database
npx prisma db push --force-reset

# View database
npx prisma studio

# Generate client after schema changes
npx prisma generate
```

### Code Quality
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### Docker Management
```bash
# Stop all services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Clean up volumes (WARNING: This will delete all data)
docker-compose down -v
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

#### 2. Pinecone Connection Failed
- Verify your API key in `.env`
- Check if the index exists in Pinecone console
- Ensure the index dimensions match (1536 for ada-002)

#### 3. OpenAI API Errors
- Verify your API key in `.env`
- Check your OpenAI account has sufficient credits
- Ensure the model names are correct

#### 4. Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change the port in .env
PORT=3001
```

#### 5. TypeScript Compilation Errors
```bash
# Clean build
rm -rf dist/
npm run build

# Check for type errors
npm run type-check
```

### Health Check Endpoints

Use these endpoints to diagnose issues:

- **Overall Health**: `GET /api/v1/health`
- **Knowledge Service**: `GET /api/v1/health/services/knowledge`
- **Agent Service**: `GET /api/v1/health/services/agent`
- **System Metrics**: `GET /api/v1/health/metrics`
- **Liveness Probe**: `GET /api/v1/health/live`
- **Readiness Probe**: `GET /api/v1/health/ready`

### Log Analysis

```bash
# View application logs in development
npm run dev

# View Docker service logs
docker-compose logs -f

# View specific service logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs neo4j
```

---

## Performance Optimization

### For Development
- Use `npm run dev` for hot reload
- Keep Docker services running between sessions
- Use Prisma Studio for database inspection

### For Production Testing
- Use `npm run build && npm start`
- Monitor health endpoints
- Check system metrics regularly

---

## Security Notes

### Development Environment
- The provided JWT secret is for development only
- Database passwords are simple for local testing
- CORS is configured for development (allows all origins)

### Before Production
- Change all default passwords
- Use strong JWT secrets
- Configure proper CORS origins
- Enable HTTPS
- Set up proper environment variable management
- Configure rate limiting appropriately

---

## Next Steps

Once you have the system running:

1. **Test the API endpoints** using the provided curl examples
2. **Create a simple frontend** to interact with the API
3. **Add your own Git repositories** for testing
4. **Experiment with different queries** to test the agent system
5. **Monitor the health endpoints** to understand system behavior

The system is now ready for development and testing!

