# Hikma Database Schema

This document contains the database schema diagram for the Hikma platform, generated from the Prisma schema file.

## Entity Relationship Diagram

```mermaid
erDiagram
    %% User Management
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

    %% Project Management
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

    %% Data Sources
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

    %% Knowledge Base
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

    %% Query and Analytics
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

    %% System Configuration
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

    %% Webhooks
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

## Key Features

### Multi-Database Architecture
The Hikma platform uses a hybrid database approach:
- **PostgreSQL**: Primary relational data (shown in this diagram)
- **Redis**: Caching and session storage
- **Neo4j**: Relationship graphs between entities
- **Pinecone**: Vector embeddings for semantic search

### Core Entity Groups

1. **User Management**: Users, API keys, and authentication
2. **Project Management**: Projects, members, and permissions
3. **Data Ingestion**: Data sources and synchronization jobs
4. **Knowledge Base**: Documents, chunks, and content storage
5. **Query Processing**: Query logs, tool calls, and responses
6. **Feedback System**: User feedback and ratings
7. **System Management**: Metrics, configuration, and webhooks

### Key Relationships

- **Users** can be members of multiple **Projects** with different roles
- **Projects** can have multiple **Data Sources** (Git, GitHub, Jira, etc.)
- **Data Sources** are synchronized via **Sync Jobs** to produce **Documents**
- **Documents** are stored in **Knowledge Bases** and split into **Document Chunks**
- **Query Logs** track user interactions and can execute **Tool Calls**
- **Webhooks** enable real-time integrations with external systems

### Enums and Status Types

The schema includes several enums for type safety:
- `UserRole`: ADMIN, USER, VIEWER
- `ProjectStatus`: ACTIVE, INACTIVE, ARCHIVED
- `DataSourceType`: GIT, GITHUB, JIRA, SLACK, CONFLUENCE, FILE_UPLOAD
- `DocumentType`: CODE_FILE, COMMIT, PULL_REQUEST, ISSUE, etc.
- `QueryStatus`: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED

This design supports the platform's goal of providing intelligent code analysis and workflow integration across multiple data sources.