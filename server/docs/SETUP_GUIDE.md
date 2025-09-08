# Hikma Setup Guide

This comprehensive guide will help you set up and run the Hikma Agentic Code Intelligence Platform locally for development and testing.

## 🎯 Quick Start

For the impatient developer:

```bash
git clone <repository-url>
cd hikma/server
cp .env.example .env
# Edit .env with your OpenAI API key
npm install
docker-compose up -d postgres redis neo4j qdrant
npm run db:generate
npm run db:push
npm run seed
npm run dev
```

Then visit `http://localhost:3000/api/v1/health` to verify everything is working.

**🔑 Login with seeded credentials:**
- Admin: `admin@hikma.com` / `admin123`
- User: `user@hikma.com` / `user123`
- Viewer: `viewer@hikma.com` / `viewer123`

---

## 🆕 Fresh Machine Setup

**Complete setup guide for a brand new machine or clean environment:**

### Prerequisites Check
```bash
# Verify required software versions
node --version    # Should be 18.x or higher
npm --version     # Should be 8.x or higher
docker --version  # Should be 20.x or higher
docker-compose --version  # Should be 2.x or higher
git --version     # Any recent version
```

### Step-by-Step Setup

```bash
# 1. Clone and navigate to project
git clone <repository-url>
cd hikma/server

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env file - REQUIRED: Add your OpenAI API key
# OPENAI_API_KEY=your_openai_api_key_here

# 4. Start infrastructure services
docker-compose up -d postgres redis neo4j qdrant

# 5. Wait for services to be ready (30-60 seconds)
docker-compose ps  # Verify all services show "Up" status

# 6. Initialize database schema
npm run db:generate
npm run migrate:dev  # Creates initial migration if needed

# 7. Create test data
npx tsx tests/debug/setup-test-data.ts

# 8. Verify setup
npx tsx tests/debug/setup-test-data.ts check
npx tsx tests/debug/sync-direct.ts

# 9. Start development server
npm run dev
```

### Verification Steps

After setup, verify everything works:

```bash
# Check API health
curl http://localhost:4000/api/v1/health

# Check database connection
npm run db:studio  # Opens Prisma Studio

# Check all services
docker-compose ps  # All should show "Up" status
```

### Fresh Database Reset (if needed)

If you need to completely reset your database:

```bash
# Stop the application
# Ctrl+C if running npm run dev

# Reset database with force flag
npx prisma migrate reset --force

# Recreate test data
npx tsx tests/debug/setup-test-data.ts

# Verify everything works
npx tsx tests/debug/setup-test-data.ts check
npx tsx tests/debug/sync-direct.ts
```

### Debug and Development Commands

Useful commands for development and debugging:

```bash
# Database Management
npm run db:studio              # Open Prisma Studio
npm run migrate:status          # Check migration status
npm run migrate:dev             # Apply new migrations
npm run migrate:reset --force   # Complete database reset

# Test Data Management
npx tsx tests/debug/setup-test-data.ts        # Create and verify test data (default)
npx tsx tests/debug/setup-test-data.ts create # Create/update test data only
npx tsx tests/debug/setup-test-data.ts check  # Verify test data only

# Sync Testing
npx tsx tests/debug/sync-direct.ts          # Direct project sync test (uses dynamic test data)

# Service Management
docker-compose ps                           # Check service status
docker-compose logs [service-name]          # View service logs
docker-compose restart [service-name]       # Restart specific service

# Development Server
npm run dev                     # Start development server with hot reload
npm run build                   # Build for production
npm run start                   # Start production server
```

**Note:** The debug scripts in `tests/debug/` are specifically designed for development and testing. They create consistent test data and verify system functionality.

### Troubleshooting Fresh Setup

**Services won't start:**
```bash
# Check if ports are already in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :7474  # Neo4j HTTP
lsof -i :7687  # Neo4j Bolt
lsof -i :6333  # Qdrant

# Stop conflicting services or change ports in docker-compose.yml
```

**Database connection issues:**
```bash
# Check Docker logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs neo4j
docker-compose logs qdrant

# Restart specific service
docker-compose restart postgres
```

**Migration issues:**
```bash
# Check migration status
npx prisma migrate status

# Reset and reapply migrations
npx prisma migrate reset --force
npx prisma migrate dev --name initial_migration
```

---

## 📋 Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 18.x or higher | Runtime environment |
| **npm** | 8.x or higher | Package manager |
| **Docker** | 20.x or higher | Container runtime |
| **Docker Compose** | 2.x or higher | Multi-container orchestration |
| **Git** | Latest | Version control |

### Required API Keys

| Service | Required | Purpose | Free Tier |
|---------|----------|---------|-----------|
| **OpenAI API** | ✅ Yes | LLM and embeddings | Limited |
| **GitHub Token** | 🔶 Optional | Repository integration | Yes |
| **Jira API** | 🔶 Optional | Issue tracking integration | Yes |
| **Slack Bot** | 🔶 Optional | ChatOps integration | Yes |

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **Network**: Internet connection for API calls

---

## 🚀 Installation

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd hikma/server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

> **Note**: The package.json includes Fastify 5.x and compatible plugin versions. If you encounter version conflicts, ensure you're using the latest version of the repository.

### Step 2: Configure Environment

The `.env` file is pre-configured with correct database passwords that match the Docker setup. You only need to add your API keys:

```bash
# Core Application (pre-configured)
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database URLs (pre-configured - no changes needed)
DATABASE_URL="postgresql://hikma:hikma123@localhost:5432/hikma"
REDIS_URL="redis://:redis123@localhost:6379"
NEO4J_URL="bolt://localhost:7687"
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=neo4j123

# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Optional Integrations
GITHUB_TOKEN=your_github_token_here
JIRA_URL=https://your-org.atlassian.net
JIRA_API_TOKEN=your_jira_token_here
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
```

**🔑 Getting API Keys:**

- **OpenAI**: Visit [platform.openai.com](https://platform.openai.com/api-keys)
- **GitHub**: Go to Settings → Developer settings → Personal access tokens
- **Jira**: Visit your Jira instance → Settings → System → API tokens
- **Slack**: Create a Slack app at [api.slack.com](https://api.slack.com/apps)

### Step 3: Start Infrastructure

```bash
# Start only the infrastructure services (not the app)
docker-compose up -d postgres redis neo4j qdrant

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                STATUS              PORTS
hikma-postgres-1    Up 30 seconds      0.0.0.0:5432->5432/tcp
hikma-redis-1       Up 30 seconds      0.0.0.0:6379->6379/tcp
hikma-neo4j-1       Up 30 seconds      0.0.0.0:7474->7474/tcp, 0.0.0.0:7687->7687/tcp
hikma-qdrant-1      Up 30 seconds      0.0.0.0:6333->6333/tcp
```

### Step 4: Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Apply database schema
npm run db:push

# (Optional) Open Prisma Studio to inspect database
npm run db:studio
```

### Step 5: Seed Development Data

To get started quickly with test users and projects, run the seeding scripts:

```bash
# Seed with default development data (recommended for first-time setup)
npm run seed

# Or use versioned seeding with specific datasets
npm run seed:version -- --version development
```

**Available Seed Versions:**

```bash
# List all available seed versions
npm run seed:list
```

| Version | Description | Users | Projects |
|---------|-------------|-------|----------|
| `minimal` | Just admin user | 1 | 0 |
| `development` | Full dev setup (default) | 3 | 1 |
| `testing` | Complex test scenarios | 4 | 2 |

**🔑 Default Login Credentials:**

After running the seed script, you can login with these accounts:

| Role | Email | Username | Password | Access Level |
|------|-------|----------|----------|-------------|
| **Admin** | `admin@hikma.com` | `admin` | `admin123` | Full system access |
| **User** | `user@hikma.com` | `demo-user` | `user123` | Standard user features |
| **Viewer** | `viewer@hikma.com` | `viewer` | `viewer123` | Read-only access |

> **⚠️ Security Note**: These are development credentials only. Change them before deploying to production!

**Seeding Options:**

```bash
# Seed specific version
npm run seed:version -- --version minimal
npm run seed:version -- --version development  
npm run seed:version -- --version testing

# Custom credentials via environment variables
SEED_ADMIN_EMAIL=admin@mycompany.com SEED_ADMIN_PASSWORD=mypassword npm run seed
```

### Step 6: Start the Application

```bash
# Development mode with hot reload
npm run dev

# Or build and run in production mode
npm run build
npm start
```

The server will start at `http://localhost:3000`

---

## ✅ Verification

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  \"status\": \"healthy\",
  \"timestamp\": \"2024-01-01T00:00:00.000Z\",
  \"services\": {
    \"database\": { \"status\": \"healthy\" },
    \"redis\": { \"status\": \"healthy\" },
    \"neo4j\": { \"status\": \"healthy\" },
    \"qdrant\": { \"status\": \"healthy\" },
    \"openai\": { \"status\": \"healthy\" }
  }
}
```

### API Documentation

Visit `http://localhost:3000/docs` to see the interactive API documentation.

### Service UIs

- **Prisma Studio**: `http://localhost:5555` (run `npm run db:studio`)
- **Neo4j Browser**: `http://localhost:7474` (neo4j/neo4j123)
- **Qdrant Dashboard**: `http://localhost:6333/dashboard`

---

## 🧪 Testing the System

### 1. Login with Seeded Users

If you've run the seed scripts (recommended), you can immediately login with these accounts:

```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H \"Content-Type: application/json\" \\
  -d '{\n    \"email\": \"admin@hikma.com\",\n    \"password\": \"admin123\"\n  }'

# Login as regular user  
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H \"Content-Type: application/json\" \\
  -d '{\n    \"email\": \"user@hikma.com\",\n    \"password\": \"user123\"\n  }'
```

### 1a. Create a User (Alternative)

If you haven't run the seed scripts, you can manually create a user:

```bash
curl -X POST http://localhost:4000/api/v1/users \\
  -H \"Content-Type: application/json\" \\
  -d '{\n    \"email\": \"test@example.com\",\n    \"username\": \"testuser\",\n    \"password\": \"password123\",\n    \"firstName\": \"Test\",\n    \"lastName\": \"User\"\n  }'
```

### 2. Create a Project

```bash
curl -X POST http://localhost:4000/api/v1/projects \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"name\": \"Test Project\",\n    \"description\": \"My first Hikma project\",\n    \"slug\": \"test-project\"\n  }'
```

### 3. Test Query Processing

```bash
curl -X POST http://localhost:4000/api/v1/query \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"query\": \"What is this system about?\",\n    \"projectId\": \"your-project-id\"\n  }'
```

---

## 🛠️ Development Workflow

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run setup` | Complete setup (install + generate + migrate) |
| `npm test` | Run test suite |
| `npm run lint` | Check code style |
| `npm run format` | Format code |
| `npm run typecheck` | TypeScript type checking |
| `npm run seed` | Seed database with development data |
| `npm run seed:version` | Seed with specific version (minimal/development/testing) |
| `npm run seed:list` | List available seed versions |

### Database Management

```bash
# View database in browser
npm run db:studio

# Reset database (WARNING: deletes all data)
npm run migrate:reset

# Generate Prisma client after schema changes
npm run db:generate

# Apply schema changes
npm run db:push
```

### Docker Management

```bash
# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart postgres

# Stop all services
docker-compose down

# Clean restart (removes volumes - WARNING: deletes data)
docker-compose down -v && docker-compose up -d
```

---

## 🔧 Troubleshooting

### Common Issues

#### ❌ \"Database connection failed\"

**Symptoms**: Application fails to start with database connection errors

**Solutions**:
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection manually
docker exec -it hikma-postgres-1 psql -U hikma -d hikma -c \"SELECT 1;\"
```

#### ❌ \"OpenAI API key invalid\"

**Symptoms**: Queries fail with authentication errors

**Solutions**:
1. Verify your API key at [platform.openai.com](https://platform.openai.com/api-keys)
2. Check your account has sufficient credits
3. Ensure the key is correctly set in `.env`
4. Restart the application after changing the key

#### ❌ \"Port 3000 already in use\"

**Symptoms**: Server fails to start with port binding error

**Solutions**:
```bash
# Find process using port 4000
lsof -i :4000

# Kill the process (replace PID)
kill -9 <PID>

# Or change port in .env
echo "PORT=4001" >> .env
```

#### ❌ \"Docker services won't start\"

**Symptoms**: `docker-compose up` fails or services are unhealthy

**Solutions**:
```bash
# Check Docker is running
docker info

# Clean up and restart
docker-compose down -v
docker system prune -f
docker-compose up -d postgres redis neo4j qdrant

# Check individual service logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs neo4j
docker-compose logs qdrant
```

#### ❌ \"Docker build fails with missing directories\"

**Symptoms**: `COPY config/ ./config/: not found` or similar errors

**Solutions**:
```bash
# Create missing directories (if they don't exist)
mkdir -p config scripts deployments

# Add placeholder files to keep directories in git
touch config/.gitkeep scripts/.gitkeep deployments/.gitkeep

# Try building again
docker-compose up -d
```

#### ❌ \"TypeScript compilation errors\"

**Symptoms**: Build fails with type errors

**Solutions**:
```bash
# Clean build
rm -rf dist/ node_modules/.cache
npm run build

# Check for type errors
npm run typecheck

# Regenerate Prisma client
npm run db:generate
```

### Health Check Endpoints

Use these endpoints to diagnose specific issues:

- **Overall Health**: `GET /health`
- **Database Health**: `GET /health/database`
- **Services Health**: `GET /health/services`
- **Metrics**: `GET /health/metrics`

### Log Analysis

```bash
# Application logs (development)
npm run dev

# Docker service logs
docker-compose logs -f

# Specific service logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs neo4j
docker-compose logs qdrant

# Follow logs in real-time
docker-compose logs -f app
```

---

## 🚀 Advanced Configuration

### Environment-Specific Settings

#### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
DEV_SEED_DATA=true
```

#### Production
```bash
NODE_ENV=production
LOG_LEVEL=info
RATE_LIMIT_MAX=1000
```

### Optional Monitoring Stack

Enable Prometheus and Grafana for advanced monitoring:

```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin123)
```

### Custom Vector Database

If you prefer a different vector database:

```bash
# Disable Qdrant
docker-compose stop qdrant

# Configure alternative in .env
VECTOR_DB_TYPE=pinecone
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=hikma
```

---

## 🔒 Security Considerations

### Development Environment

The default configuration is optimized for development:

- ✅ Simple passwords for local databases
- ✅ Permissive CORS settings
- ✅ Detailed error messages
- ✅ Debug logging enabled

### Production Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS/TLS
- [ ] Set up proper environment variable management
- [ ] Configure rate limiting
- [ ] Enable security headers
- [ ] Set up monitoring and alerting

---

## 📚 Next Steps

Once you have Hikma running:

1. **📖 Explore the Documentation**
   - [Project Overview & Features](../README.md) - Learn about Hikma's capabilities
   - [Data Architecture](./data/README.md) - Understanding the data model
   - [API Documentation](http://localhost:3000/docs) - Interactive API reference

2. **🔌 Add Data Sources**
   - Connect your Git repositories
   - Integrate with GitHub/Jira
   - Upload documents

3. **🤖 Test AI Features**
   - Ask questions about your code
   - Try different query types
   - Provide feedback to improve responses

4. **🔧 Customize Configuration**
   - Adjust embedding models
   - Configure sync schedules
   - Set up webhooks

5. **📊 Monitor Performance**
   - Check health endpoints
   - Review query analytics
   - Monitor resource usage

---

## 🆘 Getting Help

- **Setup Issues**: Check troubleshooting steps above
- **Documentation**: Browse the complete `docs/` directory  
- **Health Checks**: Use `/health` endpoints for diagnostics
- **Application Logs**: Review application and Docker logs
- **Project Support**: See [README.md](../README.md#-support) for issue reporting and discussions

The system is now ready for development and testing! 🎉
