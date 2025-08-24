# PostgreSQL Table Explanations

This document provides detailed explanations of each table in Hikma's PostgreSQL database, including their purpose, key fields, and usage patterns.

## 👥 User Management Tables

### users
**Purpose**: Core user authentication and profile information

**Key Fields**:
- `id`: Unique identifier (CUID)
- `email`: Unique email address for authentication
- `username`: Unique username for display
- `password`: Hashed password using bcrypt
- `role`: System-wide role (ADMIN, USER, VIEWER)
- `isActive`: Account status flag

**Usage Patterns**:
- Authentication queries by email/username
- Role-based access control checks
- User profile management

**Indexes**:
```sql
CREATE UNIQUE INDEX users_email_idx ON users(email);
CREATE UNIQUE INDEX users_username_idx ON users(username);
CREATE INDEX users_role_active_idx ON users(role, isActive);
```

### api_keys
**Purpose**: API key management for programmatic access

**Key Fields**:
- `keyHash`: SHA-256 hash of the actual API key
- `userId`: Foreign key to users table
- `expiresAt`: Optional expiration timestamp
- `lastUsedAt`: Track usage for analytics

**Security Notes**:
- Actual API keys are never stored, only hashes
- Keys can be revoked by setting `isActive = false`
- Automatic cleanup of expired keys

## 🏢 Project Management Tables

### projects
**Purpose**: Project containers for multi-tenant data organization

**Key Fields**:
- `slug`: URL-friendly unique identifier
- `status`: Project lifecycle status
- `settings`: JSON configuration for project-specific settings

**Common Settings**:
```json
{
  "syncSchedule": "0 */6 * * *",
  "embeddingModel": "text-embedding-3-small",
  "maxDocuments": 100000,
  "retentionDays": 365,
  "features": {
    "vectorSearch": true,
    "graphAnalysis": true,
    "realTimeSync": false
  }
}
```

### project_members
**Purpose**: User-project relationships with role-based permissions

**Key Fields**:
- `role`: Project-specific role (OWNER, ADMIN, MEMBER, VIEWER)
- Composite unique constraint on `(projectId, userId)`

**Permission Matrix**:
| Role | View | Query | Sync | Manage Members | Delete |
|------|------|-------|------|----------------|--------|
| VIEWER | ✓ | ✓ | ✗ | ✗ | ✗ |
| MEMBER | ✓ | ✓ | ✓ | ✗ | ✗ |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✗ |
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ |

## 🔌 Data Source Tables

### data_sources
**Purpose**: External system integration configurations

**Key Fields**:
- `type`: Source type enum (GIT, GITHUB, JIRA, etc.)
- `config`: JSON configuration specific to source type
- `lastSyncAt`/`nextSyncAt`: Sync scheduling timestamps
- `errorCount`: Failure tracking for reliability

**Configuration Examples**:

**Git Repository**:
```json
{
  "url": "https://github.com/org/repo.git",
  "branch": "main",
  "authType": "token",
  "token": "encrypted_token",
  "includePatterns": ["*.ts", "*.js", "*.md"],
  "excludePatterns": ["node_modules/**", "dist/**"],
  "syncSchedule": "0 */2 * * *"
}
```

**GitHub API**:
```json
{
  "owner": "organization",
  "repo": "repository",
  "token": "encrypted_token",
  "includePRs": true,
  "includeIssues": true,
  "includeComments": true,
  "maxAge": "6M"
}
```

### sync_jobs
**Purpose**: Track synchronization tasks and their progress

**Key Fields**:
- `type`: Sync strategy (FULL_SYNC, INCREMENTAL_SYNC, REINDEX, CLEANUP)
- `progress`: Completion percentage (0.0 to 1.0)
- `totalItems`/`processedItems`: Progress tracking
- `errors`: JSON array of error details
- `metadata`: Sync-specific information

**Metadata Examples**:
```json
{
  "commitRange": "abc123..def456",
  "changedFiles": ["src/app.ts", "README.md"],
  "apiCalls": 45,
  "rateLimitRemaining": 4955,
  "processingStats": {
    "documentsCreated": 12,
    "documentsUpdated": 8,
    "documentsDeleted": 2
  }
}
```

## 📚 Knowledge Base Tables

### knowledge_bases
**Purpose**: Logical containers for organizing documents within projects

**Key Fields**:
- `name`: Human-readable name (unique within project)
- `config`: Processing and search configuration

**Common Configurations**:
```json
{
  "chunkSize": 1000,
  "chunkOverlap": 200,
  "embeddingModel": "text-embedding-3-small",
  "indexingEnabled": true,
  "searchWeights": {
    "semantic": 0.7,
    "keyword": 0.3
  }
}
```

### documents
**Purpose**: Processed content from data sources

**Key Fields**:
- `externalId`: Original identifier from source system
- `hash`: Content hash for deduplication
- `vectorId`: Reference to vector database entry
- `graphNodeId`: Reference to graph database node
- `size`: Content size in bytes for analytics

**Document Types and Processing**:
- `CODE_FILE`: Parsed with AST analysis
- `COMMIT`: Git commit with diff analysis
- `PULL_REQUEST`: PR with review analysis
- `ISSUE`: Issue with comment threading
- `MARKDOWN`: Structured document parsing

### document_chunks
**Purpose**: Searchable segments of documents for vector search

**Key Fields**:
- `chunkIndex`: Sequential position within document
- `embedding`: Vector embedding (PostgreSQL array)
- `vectorId`: External vector database reference
- `metadata`: Chunk-specific context

**Chunk Metadata Examples**:
```json
{
  "type": "function",
  "name": "authenticateUser",
  "startLine": 45,
  "endLine": 67,
  "complexity": 8.5,
  "language": "typescript",
  "context": "authentication module"
}
```

## 🔍 Query and Analytics Tables

### query_logs
**Purpose**: Complete audit trail of user interactions

**Key Fields**:
- `sessionId`: Groups related queries in conversation
- `intent`: Classified user intent
- `entities`: Extracted entities from query
- `pipeline`: Processing pipeline used
- `tokenUsage`: LLM token consumption tracking

**Token Usage Tracking**:
```json
{
  "model": "gpt-4-turbo-preview",
  "promptTokens": 1250,
  "completionTokens": 380,
  "totalTokens": 1630,
  "cost": 0.0195
}
```

### tool_calls
**Purpose**: Track AI agent tool execution for debugging and optimization

**Key Fields**:
- `toolName`: Specific tool executed
- `inputs`/`outputs`: Tool parameters and results
- `duration`: Execution time in milliseconds
- `status`: Success/failure status

**Common Tools**:
- `vector_search`: Semantic similarity search
- `graph_traversal`: Relationship exploration
- `code_analysis`: AST-based code understanding
- `context_builder`: Information synthesis

### feedback
**Purpose**: User feedback for continuous improvement

**Key Fields**:
- `type`: Feedback mechanism (THUMBS_UP, THUMBS_DOWN, RATING, COMMENT)
- `rating`: Numerical rating (1-5)
- `metadata`: Additional feedback context

**Feedback Analysis**:
- Response quality trends
- User satisfaction metrics
- Feature improvement identification

## 📊 System Tables

### metrics
**Purpose**: Time-series performance and usage data

**Key Fields**:
- `name`: Metric identifier
- `value`: Numerical measurement
- `labels`: Dimensional metadata (JSON)
- `timestamp`: Measurement time

**Common Metrics**:
- `query_duration`: Response time tracking
- `cache_hit_rate`: Cache performance
- `sync_success_rate`: Data source reliability
- `user_activity`: Engagement metrics

### configurations
**Purpose**: Dynamic system configuration

**Key Fields**:
- `key`: Configuration identifier (unique)
- `value`: JSON configuration value

**Configuration Categories**:
- Feature flags
- API rate limits
- Model parameters
- Integration settings

### webhooks / webhook_deliveries
**Purpose**: External system integration and delivery tracking

**Key Fields**:
- `events`: Array of event types to trigger on
- `secret`: Webhook signature secret
- `attempts`: Delivery retry count
- `response`: HTTP response from webhook endpoint

**Reliability Features**:
- Automatic retry with exponential backoff
- Delivery status tracking
- Failed delivery alerting
- Webhook signature verification

## 🔧 Maintenance and Optimization

### Table Partitioning
Large tables use time-based partitioning:

```sql
-- Partition query_logs by month
CREATE TABLE query_logs_y2024m01 PARTITION OF query_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Cleanup Procedures
Automated cleanup for data retention:

```sql
-- Archive old query logs
DELETE FROM query_logs 
WHERE created_at < NOW() - INTERVAL '1 year';

-- Clean up expired API keys
DELETE FROM api_keys 
WHERE expires_at < NOW() AND expires_at IS NOT NULL;
```

### Performance Monitoring
Key performance indicators:

- Table sizes and growth rates
- Index usage statistics
- Query execution times
- Connection pool utilization

This table structure provides a robust foundation for Hikma's multi-tenant, AI-powered code intelligence platform while maintaining data integrity, performance, and scalability.