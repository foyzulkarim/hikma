# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in the Hikma platform, organized by functional area.

## 🚀 Server Configuration

### Basic Server Settings
```bash
# Server configuration
PORT=3000                           # Server port (default: 3000)
HOST=0.0.0.0                       # Server host (default: 0.0.0.0)
API_BASE_URL=http://localhost:3000  # API base URL
NODE_ENV=development                # Environment: development, production, test
LOG_LEVEL=info                      # Logging level: debug, info, warn, error
```

### Security Configuration
```bash
# Authentication & Security
JWT_SECRET=your-super-secret-jwt-key           # JWT signing secret
JWT_EXPIRES_IN=24h                             # JWT expiration time
ENCRYPTION_KEY=your-32-character-encryption-key # Data encryption key
BCRYPT_ROUNDS=12                               # Password hashing rounds
CORS_ORIGINS=http://localhost:3000,http://localhost:5173 # Allowed CORS origins (comma-separated)
```

### Rate Limiting
```bash
# Rate limiting configuration
RATE_LIMIT_MAX=100                  # Max requests per window (default: 100)
RATE_LIMIT_WINDOW=60000            # Rate limit window in ms (default: 60s)
RATE_LIMIT_SKIP_SUCCESS=false      # Skip successful requests in rate limiting
RATE_LIMIT_SKIP_FAILED=false       # Skip failed requests in rate limiting
```

## 🗄️ Database Configuration

### PostgreSQL
```bash
# PostgreSQL database
DATABASE_URL=postgresql://user:password@localhost:5432/hikma
DEV_LOG_SQL_QUERIES=false          # Log SQL queries in development
```

### Redis
```bash
# Redis configuration
REDIS_HOST=localhost                # Redis host
REDIS_PORT=6379                    # Redis port
REDIS_PASSWORD=                    # Redis password (optional)
REDIS_DB=0                         # Redis database number
REDIS_URL=redis://localhost:6379   # Full Redis URL (alternative to individual settings)
```

### Qdrant (Vector Database)
```bash
# Qdrant vector database
QDRANT_URL=http://localhost:6333    # Qdrant server URL
QDRANT_API_KEY=                     # Qdrant API key (optional for local)
QDRANT_COLLECTION_NAME=hikma-embeddings # Collection name
QDRANT_DIMENSION=1536               # Vector dimensions (OpenAI text-embedding-3-small)
QDRANT_DISTANCE=Cosine              # Distance metric: Cosine, Euclidean, Dot
VECTOR_DB_PROVIDER=qdrant           # Vector database provider
VECTOR_DIMENSION=1536               # Vector dimensions (alternative setting)
```

### Neo4j (Graph Database)
```bash
# Neo4j graph database
NEO4J_URL=bolt://localhost:7687     # Neo4j connection URL
NEO4J_USERNAME=neo4j                # Neo4j username
NEO4J_PASSWORD=password             # Neo4j password
NEO4J_DATABASE=neo4j                # Neo4j database name
NEO4J_MAX_POOL_SIZE=50             # Connection pool size
NEO4J_CONNECTION_TIMEOUT=60000      # Connection timeout in ms
NEO4J_RETRY_TIME=30000             # Transaction retry time in ms
```

## 🤖 AI/ML Configuration

### OpenAI
```bash
# OpenAI configuration
OPENAI_API_KEY=sk-...               # OpenAI API key
OPENAI_API_BASE=https://api.openai.com/v1 # OpenAI API base URL
OPENAI_MODEL=gpt-4-turbo-preview    # Default chat model
OPENAI_EMBEDDING_MODEL=text-embedding-3-small # Embedding model
OPENAI_MAX_TOKENS=4096              # Max tokens per request
OPENAI_TEMPERATURE=0.1              # Model temperature (0-2)
OPENAI_TIMEOUT=60000                # Request timeout in ms
OPENAI_MAX_RETRIES=3                # Max retry attempts
```

### Ollama (Alternative LLM)
```bash
# Ollama configuration (for local LLM)
OLLAMA_BASE_URL=http://localhost:11434 # Ollama server URL
OLLAMA_MODEL=llama2                 # Ollama model name
OLLAMA_TIMEOUT=120000               # Request timeout in ms
```

### LLM Provider Settings
```bash
# Generic LLM settings
LLM_PROVIDER=openai                 # LLM provider: openai, ollama
LLM_MODEL=gpt-4-turbo-preview      # Model name
LLM_TEMPERATURE=0.7                # Model temperature
LLM_MAX_TOKENS=4096                # Max tokens per request
```

## 🔄 Agent Configuration

### Agent Behavior
```bash
# Agent system configuration
AGENT_DEFAULT_PIPELINE=general_inquiry    # Default processing pipeline
AGENT_MAX_EXECUTION_TIME=300000          # Max execution time in ms (5 minutes)
AGENT_MAX_TOOL_CALLS=10                  # Max tool calls per query
AGENT_CONTEXT_WINDOW=8192                # Context window size
AGENT_ENABLE_MEMORY=true                 # Enable conversation memory
AGENT_MEMORY_TTL=3600                    # Memory TTL in seconds (1 hour)
```

### Search Configuration
```bash
# Search system settings
SEARCH_DEFAULT_TOP_K=10             # Default number of search results
SEARCH_MAX_TOP_K=50                 # Maximum number of search results
SEARCH_SIMILARITY_THRESHOLD=0.7     # Minimum similarity threshold
SEARCH_HYBRID_WEIGHT=0.7            # Vector vs keyword search weight
SEARCH_ENABLE_RERANKING=false       # Enable result reranking
```

## 📥 Data Ingestion

### Ingestion Pipeline
```bash
# Data ingestion settings
INGESTION_BATCH_SIZE=100            # Batch size for processing
INGESTION_CHUNK_SIZE=1000           # Document chunk size in characters
INGESTION_CHUNK_OVERLAP=200         # Chunk overlap in characters
INGESTION_MAX_FILE_SIZE=52428800    # Max file size in bytes (50MB)
INGESTION_ENABLE_AUTO_SYNC=true     # Enable automatic synchronization
INGESTION_SYNC_INTERVAL=3600000     # Sync interval in ms (1 hour)
```

### File Upload
```bash
# File upload configuration
UPLOAD_MAX_SIZE=10485760            # Max upload size in bytes (10MB)
UPLOAD_ALLOWED_TYPES=.pdf,.txt,.md,.doc,.docx # Allowed file types (comma-separated)
UPLOAD_DIR=./data/uploads           # Upload directory path
```

## 🔗 External Integrations

### GitHub
```bash
# GitHub integration
GITHUB_TOKEN=ghp_...                # GitHub personal access token
GITHUB_CLI_PATH=/usr/bin/gh         # GitHub CLI path
GITHUB_API_URL=https://api.github.com # GitHub API URL
```

### Jira
```bash
# Jira integration
JIRA_URL=https://your-org.atlassian.net # Jira instance URL
JIRA_EMAIL=user@example.com         # Jira user email
JIRA_API_TOKEN=...                  # Jira API token
JIRA_CLI_PATH=/usr/local/bin/acli   # Jira CLI path
```

### Slack
```bash
# Slack integration
SLACK_BOT_TOKEN=xoxb-...            # Slack bot token
SLACK_SIGNING_SECRET=...            # Slack signing secret
SLACK_APP_TOKEN=xapp-...            # Slack app token
```

## 📊 Monitoring & Observability

### Metrics & Health Checks
```bash
# Monitoring configuration
METRICS_ENABLED=true                # Enable metrics collection
TRACING_ENABLED=false               # Enable distributed tracing
HEALTH_CHECK_INTERVAL=30000         # Health check interval in ms
METRICS_PATH=/metrics               # Metrics endpoint path
HEALTH_PATH=/health                 # Health check endpoint path
```

## 📬 Queue System

### Job Queue Configuration
```bash
# Queue system settings
QUEUE_REDIS_URL=redis://localhost:6379 # Queue Redis URL
QUEUE_CONCURRENCY=5                 # Queue concurrency level
QUEUE_MAX_RETRIES=3                 # Max job retry attempts
QUEUE_REMOVE_COMPLETE=100           # Keep N completed jobs
QUEUE_REMOVE_FAILED=50              # Keep N failed jobs
QUEUE_BACKOFF_DELAY=2000            # Backoff delay in ms
```

## 🛠️ Development Settings

### Development Mode
```bash
# Development configuration
DEV_SEED_DATA=false                 # Seed database with test data
DEV_MOCK_EXTERNAL_APIS=false        # Mock external API calls
DEV_LOG_SQL_QUERIES=false           # Log SQL queries
DEV_ENABLE_DEBUG_ROUTES=false       # Enable debug endpoints
DEV_HOT_RELOAD=true                 # Enable hot reload
```

## 📝 Environment File Examples

### Development (.env.development)
```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://hikma:password@localhost:5432/hikma_dev
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
NEO4J_URL=bolt://localhost:7687

# AI
OPENAI_API_KEY=sk-your-key-here
OPENAI_TEMPERATURE=0.1

# Development
DEV_LOG_SQL_QUERIES=true
DEV_ENABLE_DEBUG_ROUTES=true
```

### Production (.env.production)
```bash
# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database (use secure connection strings)
DATABASE_URL=postgresql://user:pass@prod-db:5432/hikma
REDIS_URL=redis://user:pass@prod-redis:6379/0
QDRANT_URL=https://your-qdrant-cluster.com
NEO4J_URL=bolt+s://prod-neo4j:7687

# Security
JWT_SECRET=your-super-secure-jwt-secret-here
ENCRYPTION_KEY=your-32-char-encryption-key-here
CORS_ORIGINS=https://your-app.com,https://api.your-app.com

# AI
OPENAI_API_KEY=sk-your-production-key
OPENAI_TEMPERATURE=0.1

# Monitoring
METRICS_ENABLED=true
TRACING_ENABLED=true

# External APIs
GITHUB_TOKEN=ghp_your-token
SLACK_BOT_TOKEN=xoxb-your-token
```

### Testing (.env.test)
```bash
# Server
NODE_ENV=test
PORT=3001
LOG_LEVEL=warn

# Database (use test databases)
DATABASE_URL=postgresql://hikma:password@localhost:5432/hikma_test
REDIS_URL=redis://localhost:6379/1
QDRANT_URL=http://localhost:6333
NEO4J_URL=bolt://localhost:7687

# AI (use test keys or mocks)
OPENAI_API_KEY=sk-test-key
DEV_MOCK_EXTERNAL_APIS=true

# Development
DEV_SEED_DATA=true
```

## 🔒 Security Best Practices

### Environment Variable Security
1. **Never commit `.env` files** to version control
2. **Use different keys** for each environment
3. **Rotate secrets regularly** in production
4. **Use secret management systems** for production (AWS Secrets Manager, HashiCorp Vault, etc.)
5. **Validate required environment variables** on startup
6. **Use strong, randomly generated secrets** for JWT and encryption keys

### Required Variables
The following variables are **required** for the application to start:
- `DATABASE_URL`
- `OPENAI_API_KEY` (unless using mock mode)
- `JWT_SECRET` (in production)
- `ENCRYPTION_KEY` (in production)

### Optional Variables
All other variables have sensible defaults and are optional, though recommended for production use.

---

*This document should be kept up-to-date as new environment variables are added to the system.*