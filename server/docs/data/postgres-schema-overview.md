# PostgreSQL Schema Overview

This document provides a comprehensive overview of Hikma's PostgreSQL database schema, including table structures, relationships, and design patterns.

## 🏗️ Schema Architecture

Hikma's PostgreSQL schema is organized around **project-based multi-tenancy** with clear domain boundaries:

```mermaid
erDiagram
    %% User Management Domain
    User {
        string id PK
        string email UK
        string username UK
        string password
        string firstName
        string lastName
        UserRole role
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    ApiKey {
        string id PK
        string name
        string keyHash UK
        string userId FK
        boolean isActive
        datetime expiresAt
        datetime lastUsedAt
        datetime createdAt
        datetime updatedAt
    }

    %% Project Management Domain
    Project {
        string id PK
        string name
        string description
        string slug UK
        ProjectStatus status
        json settings
        datetime createdAt
        datetime updatedAt
    }

    ProjectMember {
        string id PK
        string projectId FK
        string userId FK
        MemberRole role
        datetime createdAt
        datetime updatedAt
    }

    %% Data Source Domain
    DataSource {
        string id PK
        string projectId FK
        string name
        DataSourceType type
        json config
        DataSourceStatus status
        datetime lastSyncAt
        datetime nextSyncAt
        int errorCount
        string lastError
        datetime createdAt
        datetime updatedAt
    }

    SyncJob {
        string id PK
        string projectId FK
        string dataSourceId FK
        SyncJobType type
        SyncJobStatus status
        float progress
        int totalItems
        int processedItems
        int errorCount
        json errors
        json metadata
        datetime startedAt
        datetime completedAt
        datetime createdAt
        datetime updatedAt
    }

    %% Knowledge Domain
    KnowledgeBase {
        string id PK
        string projectId FK
        string name
        string description
        json config
        datetime createdAt
        datetime updatedAt
    }

    Document {
        string id PK
        string knowledgeBaseId FK
        string dataSourceId FK
        string externalId
        string title
        string content
        string summary
        json metadata
        DocumentType type
        DocumentStatus status
        string vectorId
        string graphNodeId
        string hash
        int size
        datetime createdAt
        datetime updatedAt
    }

    DocumentChunk {
        string id PK
        string documentId FK
        int chunkIndex
        string content
        json metadata
        string vectorId
        float[] embedding
        datetime createdAt
        datetime updatedAt
    }

    %% Query Domain
    QueryLog {
        string id PK
        string projectId FK
        string userId FK
        string sessionId
        string query
        string intent
        json entities
        string pipeline
        string response
        QueryStatus status
        int duration
        json tokenUsage
        json metadata
        datetime createdAt
        datetime updatedAt
    }

    ToolCall {
        string id PK
        string queryLogId FK
        string toolName
        json inputs
        json outputs
        int duration
        string status
        string error
        datetime createdAt
    }

    Feedback {
        string id PK
        string queryLogId FK
        string userId FK
        FeedbackType type
        int rating
        string comment
        json metadata
        datetime createdAt
    }

    %% System Domain
    Metric {
        string id PK
        string name
        float value
        json labels
        datetime timestamp
    }

    Configuration {
        string id PK
        string key UK
        json value
        datetime createdAt
        datetime updatedAt
    }

    Webhook {
        string id PK
        string projectId FK
        string name
        string url
        string secret
        string[] events
        WebhookStatus status
        datetime lastTriggeredAt
        datetime createdAt
        datetime updatedAt
    }

    WebhookDelivery {
        string id PK
        string webhookId FK
        string event
        json payload
        WebhookDeliveryStatus status
        int attempts
        datetime lastAttempt
        json response
        datetime createdAt
    }

    %% Relationships
    User ||--o{ ApiKey : "has"
    User ||--o{ ProjectMember : "belongs to"
    User ||--o{ QueryLog : "creates"
    User ||--o{ Feedback : "provides"

    Project ||--o{ ProjectMember : "has"
    Project ||--o{ DataSource : "contains"
    Project ||--o{ QueryLog : "receives"
    Project ||--o{ SyncJob : "runs"
    Project ||--o{ KnowledgeBase : "has"
    Project ||--o{ Webhook : "configures"

    DataSource ||--o{ SyncJob : "syncs via"
    DataSource ||--o{ Document : "produces"

    KnowledgeBase ||--o{ Document : "stores"

    Document ||--o{ DocumentChunk : "split into"

    QueryLog ||--o{ ToolCall : "executes"
    QueryLog ||--o{ Feedback : "receives"

    Webhook ||--o{ WebhookDelivery : "delivers"
```

## 📊 Domain Organization

### 1. User Management Domain

**Purpose**: Authentication, authorization, and user lifecycle management

**Tables**:
- `users`: Core user information and authentication
- `api_keys`: API key management for programmatic access

**Key Features**:
- Unique email and username constraints
- Password hashing and security
- Role-based access control (ADMIN, USER, VIEWER)
- API key expiration and usage tracking

### 2. Project Management Domain

**Purpose**: Multi-tenant project organization and team collaboration

**Tables**:
- `projects`: Project metadata and configuration
- `project_members`: User-project relationships with roles

**Key Features**:
- Project-based data isolation
- Hierarchical role system (OWNER > ADMIN > MEMBER > VIEWER)
- Flexible project settings via JSON configuration
- Unique slug-based project identification

### 3. Data Source Domain

**Purpose**: External data integration and synchronization

**Tables**:
- `data_sources`: External system configurations
- `sync_jobs`: Synchronization task management

**Key Features**:
- Multiple data source types (GIT, GITHUB, JIRA, SLACK, etc.)
- Flexible configuration storage via JSON
- Comprehensive error tracking and retry logic
- Progress monitoring and performance metrics

### 4. Knowledge Domain

**Purpose**: Content storage, processing, and organization

**Tables**:
- `knowledge_bases`: Logical content containers
- `documents`: Processed content from data sources
- `document_chunks`: Searchable content segments

**Key Features**:
- Hierarchical content organization
- Content deduplication via hashing
- Vector embedding storage for semantic search
- Graph node references for relationship mapping

### 5. Query Domain

**Purpose**: User interaction tracking and AI agent orchestration

**Tables**:
- `query_logs`: User query history and responses
- `tool_calls`: AI agent tool execution tracking
- `feedback`: User feedback and quality metrics

**Key Features**:
- Session-based conversation tracking
- Intent classification and entity extraction
- Comprehensive performance monitoring
- User feedback loop for continuous improvement

### 6. System Domain

**Purpose**: System configuration, monitoring, and external integrations

**Tables**:
- `metrics`: Time-series performance data
- `configurations`: Dynamic system settings
- `webhooks`: External system integrations
- `webhook_deliveries`: Webhook delivery tracking

**Key Features**:
- Real-time metrics collection
- Dynamic configuration management
- Reliable webhook delivery with retry logic
- Comprehensive audit trails

## 🔑 Key Design Patterns

### 1. Multi-Tenancy Pattern

**Project-Based Isolation**:
```sql
-- All major tables include project_id for data isolation
SELECT * FROM documents d
JOIN knowledge_bases kb ON d.knowledge_base_id = kb.id
WHERE kb.project_id = $1;

-- User access controlled via project membership
SELECT p.* FROM projects p
JOIN project_members pm ON p.id = pm.project_id
WHERE pm.user_id = $1 AND pm.role IN ('OWNER', 'ADMIN', 'MEMBER');
```

### 2. Audit Trail Pattern

**Comprehensive Logging**:
```sql
-- All tables include created_at and updated_at
CREATE TABLE example_table (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ... other fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for automatic updated_at maintenance
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON example_table
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 3. Flexible Configuration Pattern

**JSON Configuration Storage**:
```sql
-- Data source configurations
INSERT INTO data_sources (project_id, name, type, config) VALUES (
    'proj_123',
    'Main Repository',
    'GIT',
    '{
        "url": "https://github.com/org/repo.git",
        "branch": "main",
        "auth": {
            "type": "token",
            "token": "encrypted_token"
        },
        "sync_schedule": "0 */6 * * *",
        "include_patterns": ["*.ts", "*.js", "*.md"],
        "exclude_patterns": ["node_modules/**", "dist/**"]
    }'::jsonb
);
```

### 4. Status Tracking Pattern

**Comprehensive Status Management**:
```sql
-- Enum-based status tracking with clear state transitions
CREATE TYPE sync_job_status AS ENUM (
    'PENDING',    -- Initial state
    'RUNNING',    -- Processing
    'COMPLETED',  -- Success
    'FAILED',     -- Error occurred
    'CANCELLED'   -- Manually stopped
);

-- Progress tracking for long-running operations
ALTER TABLE sync_jobs ADD COLUMN progress FLOAT DEFAULT 0.0;
ALTER TABLE sync_jobs ADD COLUMN total_items INTEGER;
ALTER TABLE sync_jobs ADD COLUMN processed_items INTEGER;
```

## 📈 Performance Optimizations

### 1. Strategic Indexing

**Query Performance Indexes**:
```sql
-- Project-based queries (most common access pattern)
CREATE INDEX idx_documents_project_id ON documents 
USING btree (knowledge_base_id) 
WHERE status = 'INDEXED';

-- Time-based queries for analytics
CREATE INDEX idx_query_logs_project_time ON query_logs 
USING btree (project_id, created_at DESC);

-- Hash-based deduplication
CREATE INDEX idx_documents_hash ON documents 
USING hash (hash);

-- Vector search optimization
CREATE INDEX idx_document_chunks_vector_id ON document_chunks 
USING btree (vector_id) 
WHERE vector_id IS NOT NULL;
```

### 2. Partitioning Strategy

**Time-Based Partitioning for Large Tables**:
```sql
-- Partition query_logs by month for better performance
CREATE TABLE query_logs_y2024m01 PARTITION OF query_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE query_logs_y2024m02 PARTITION OF query_logs
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automatic partition management
SELECT partman.create_parent(
    p_parent_table => 'public.query_logs',
    p_control => 'created_at',
    p_type => 'range',
    p_interval => 'monthly'
);
```

### 3. Connection Pooling

**Optimized Database Connections**:
```typescript
// Prisma connection configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

// Connection pool settings
DATABASE_URL="postgresql://user:pass@localhost:5432/hikma?connection_limit=20&pool_timeout=20"
```

## 🔒 Security Considerations

### 1. Data Encryption

**Sensitive Data Protection**:
```sql
-- Encrypted password storage
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- API key hashing
UPDATE api_keys SET key_hash = crypt(api_key, gen_salt('bf', 12));

-- Sensitive configuration encryption
UPDATE data_sources SET config = pgp_sym_encrypt(
    config::text, 
    current_setting('app.encryption_key')
)::jsonb;
```

### 2. Row-Level Security

**Project-Based Access Control**:
```sql
-- Enable RLS on sensitive tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy for project-based access
CREATE POLICY documents_project_access ON documents
FOR ALL TO authenticated_users
USING (
    knowledge_base_id IN (
        SELECT kb.id FROM knowledge_bases kb
        JOIN project_members pm ON kb.project_id = pm.project_id
        WHERE pm.user_id = current_user_id()
    )
);
```

### 3. Input Validation

**SQL Injection Prevention**:
```typescript
// Parameterized queries via Prisma
const documents = await prisma.document.findMany({
  where: {
    knowledgeBase: {
      project: {
        members: {
          some: {
            userId: userId,
            role: {
              in: ['OWNER', 'ADMIN', 'MEMBER']
            }
          }
        }
      }
    },
    type: documentType,
    status: 'INDEXED'
  },
  include: {
    chunks: true,
    dataSource: true
  }
});
```

## 📊 Monitoring & Analytics

### 1. Query Performance Monitoring

**Slow Query Detection**:
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;

-- Query performance analysis
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

### 2. Table Size Monitoring

**Storage Usage Tracking**:
```sql
-- Table size analysis
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Index usage analysis
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 🔄 Migration Strategy

### 1. Schema Versioning

**Prisma Migration Management**:
```bash
# Generate migration
npx prisma migrate dev --name add_vector_embeddings

# Deploy to production
npx prisma migrate deploy

# Reset development database
npx prisma migrate reset
```

### 2. Data Migration Scripts

**Safe Data Transformations**:
```sql
-- Example: Add new column with default value
ALTER TABLE documents ADD COLUMN summary TEXT;

-- Backfill data in batches
DO $$
DECLARE
    batch_size INTEGER := 1000;
    offset_val INTEGER := 0;
    row_count INTEGER;
BEGIN
    LOOP
        UPDATE documents 
        SET summary = LEFT(content, 200) || '...'
        WHERE id IN (
            SELECT id FROM documents 
            WHERE summary IS NULL 
            ORDER BY id 
            LIMIT batch_size OFFSET offset_val
        );
        
        GET DIAGNOSTICS row_count = ROW_COUNT;
        EXIT WHEN row_count = 0;
        
        offset_val := offset_val + batch_size;
        COMMIT;
    END LOOP;
END $$;
```

---

This PostgreSQL schema provides a robust foundation for Hikma's multi-tenant, AI-powered code intelligence platform while maintaining performance, security, and scalability.