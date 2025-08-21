# Hikma Backend Architecture Documentation

## System Overview

Hikma is an **Agentic Code Intelligence Platform** built with a modern microservice architecture using **Fastify + TypeScript**. The system provides intelligent code assistance through advanced RAG (Retrieval-Augmented Generation) capabilities, combining vector search, LLM integration, and multi-source data ingestion.

### Core Value Proposition
- **Intelligent Code Understanding**: Semantic analysis of codebases using vector embeddings
- **Context-Aware Responses**: Multi-turn conversations with project context
- **Multi-Source Integration**: Git, GitHub, Jira, and other development tools
- **Production-Ready**: Scalable, secure, and observable architecture

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Web Interface]
        API_CLIENT[API Clients]
        CLI[CLI Tools]
    end

    subgraph "API Gateway Layer"
        FASTIFY[Fastify Server]
        AUTH[Authentication]
        RATE_LIMIT[Rate Limiting]
        VALIDATION[Request Validation]
    end

    subgraph "Application Layer"
        AGENT[Agent Service]
        KNOWLEDGE[Knowledge Service]
        PROJECT[Project Service]
        INGESTION[Ingestion Service]
    end

    subgraph "Core Services"
        LLM[LLM Service]
        VECTOR[Vector Search]
        INTENT[Intent Classifier]
        PIPELINE[Pipeline Manager]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis)]
        NEO4J[(Neo4j)]
        PINECONE[(Pinecone)]
    end

    subgraph "External Services"
        OPENAI[OpenAI API]
        GIT[Git Repositories]
        GITHUB[GitHub API]
        JIRA[Jira API]
    end

    UI --> FASTIFY
    API_CLIENT --> FASTIFY
    CLI --> FASTIFY

    FASTIFY --> AUTH
    FASTIFY --> RATE_LIMIT
    FASTIFY --> VALIDATION

    FASTIFY --> AGENT
    FASTIFY --> KNOWLEDGE
    FASTIFY --> PROJECT
    FASTIFY --> INGESTION

    AGENT --> LLM
    AGENT --> VECTOR
    AGENT --> INTENT
    AGENT --> PIPELINE

    KNOWLEDGE --> VECTOR
    KNOWLEDGE --> PINECONE

    INGESTION --> GIT
    INGESTION --> GITHUB
    INGESTION --> JIRA

    LLM --> OPENAI
    VECTOR --> PINECONE

    PROJECT --> POSTGRES
    AGENT --> REDIS
    KNOWLEDGE --> NEO4J
```

---

## Detailed Component Architecture

### 1. API Gateway Layer

#### Fastify Server (`src/server.ts`)
**Purpose**: Main HTTP server and request routing  
**Responsibilities**:
- HTTP request handling and routing
- Middleware orchestration
- CORS and security headers
- Graceful shutdown handling
- Health check endpoints

**Key Features**:
- Production-ready configuration
- Comprehensive middleware stack
- Environment-specific settings
- Request correlation tracking

#### Authentication Middleware (`src/modules/interfaces/api/middleware/auth.ts`)
**Purpose**: JWT-based authentication and authorization  
**Responsibilities**:
- JWT token validation
- User context extraction
- Role-based access control
- API key authentication

**Security Features**:
- Secure token verification
- User session management
- Rate limiting integration
- Audit logging

#### Request Validation (`src/modules/interfaces/api/middleware/validation.ts`)
**Purpose**: Input validation and sanitization  
**Responsibilities**:
- Zod schema validation
- Request body/query/params validation
- Error formatting
- Type safety enforcement

---

### 2. Application Services Layer

#### Agent Service (`src/modules/agents/services/agent-service.ts`)
**Purpose**: Main orchestrator for AI agent functionality  
**Responsibilities**:
- Query processing coordination
- Intent classification
- Pipeline execution
- Response generation
- Conversation management

**Architecture Pattern**: Orchestrator pattern with event-driven communication

```mermaid
graph LR
    QUERY[User Query] --> INTENT_CLASS[Intent Classification]
    INTENT_CLASS --> PIPELINE_SELECT[Pipeline Selection]
    PIPELINE_SELECT --> PIPELINE_EXEC[Pipeline Execution]
    PIPELINE_EXEC --> RESPONSE_GEN[Response Generation]
    RESPONSE_GEN --> USER_RESPONSE[User Response]

    subgraph "Pipeline Execution"
        SEARCH[Vector Search]
        LLM_CALL[LLM Generation]
        CONTEXT[Context Building]
    end

    PIPELINE_EXEC --> SEARCH
    SEARCH --> CONTEXT
    CONTEXT --> LLM_CALL
```

#### Knowledge Service (`src/modules/knowledge/services/`)
**Purpose**: Knowledge base management and search  
**Responsibilities**:
- Document processing and chunking
- Embedding generation
- Vector storage and retrieval
- Semantic search
- Knowledge graph management

**Components**:
- **Embedding Service**: OpenAI embedding generation
- **Vector Store**: Pinecone integration
- **Document Processor**: Multi-strategy chunking
- **Vector Search**: Semantic and hybrid search

#### Project Service (`src/modules/interfaces/api/routes/project.ts`)
**Purpose**: Project lifecycle management  
**Responsibilities**:
- Project CRUD operations
- Repository configuration
- Sync job management
- Access control
- Project analytics

---

### 3. Core Intelligence Layer

#### Intent Classification Service (`src/modules/agents/services/intent-classifier.ts`)
**Purpose**: Understanding user query intent  
**Approach**: Hybrid rule-based + LLM classification

```mermaid
graph TD
    QUERY[User Query] --> RULE_BASED[Rule-Based Classification]
    QUERY --> LLM_BASED[LLM-Based Classification]
    
    RULE_BASED --> CONFIDENCE_CHECK{Confidence > 0.8?}
    CONFIDENCE_CHECK -->|Yes| RULE_RESULT[Use Rule Result]
    CONFIDENCE_CHECK -->|No| COMBINE[Combine Results]
    
    LLM_BASED --> COMBINE
    COMBINE --> FINAL_INTENT[Final Intent]
    
    subgraph "Intent Types"
        CODE_EXPLAIN[Code Explanation]
        CODE_SEARCH[Code Search]
        DOC_SEARCH[Documentation Search]
        COMMIT_ANALYSIS[Commit Analysis]
        GENERAL[General Query]
    end
```

**Intent Categories**:
- **Code Explanation**: Understanding how code works
- **Code Search**: Finding specific implementations
- **Documentation Search**: Locating guides and docs
- **Commit Analysis**: Understanding code changes
- **General Query**: Open-ended questions

#### Pipeline Manager (`src/modules/agents/services/pipeline-manager.ts`)
**Purpose**: Multi-step workflow execution  
**Architecture**: Pipeline pattern with configurable steps

```mermaid
graph LR
    subgraph "Code Analysis Pipeline"
        SEARCH_CODE[Search Code] --> ANALYZE[Analyze Code]
        ANALYZE --> EXPLAIN[Generate Explanation]
    end
    
    subgraph "Documentation Pipeline"
        SEARCH_DOCS[Search Docs] --> FORMAT[Format Response]
    end
    
    subgraph "Commit Analysis Pipeline"
        SEARCH_COMMITS[Search Commits] --> SUMMARIZE[Summarize Changes]
    end
    
    subgraph "General RAG Pipeline"
        SEARCH_ALL[Search All] --> SYNTHESIZE[Synthesize Response]
    end
```

**Pipeline Types**:
- **Search and Answer**: General RAG workflow
- **Code Analysis**: Code-specific analysis
- **Documentation Lookup**: Documentation retrieval
- **Commit Summary**: Change analysis

#### LLM Service (`src/modules/agents/services/llm-service.ts`)
**Purpose**: OpenAI integration and prompt management  
**Capabilities**:
- Chat completion with streaming
- Function calling support
- Token management and estimation
- Multiple model support
- Rate limiting and error handling

---

### 4. Data Ingestion Layer

#### Base Connector (`src/modules/ingestion/connectors/base-connector.ts`)
**Purpose**: Common connector framework  
**Pattern**: Template method pattern with event-driven architecture

```mermaid
graph TD
    CONNECTOR[Base Connector] --> INIT[Initialize]
    INIT --> VALIDATE[Validate Config]
    VALIDATE --> CONNECT[Connect to Source]
    CONNECT --> SYNC[Sync Data]
    SYNC --> PROCESS[Process Documents]
    PROCESS --> STORE[Store in Knowledge Base]
    STORE --> COMPLETE[Sync Complete]
    
    subgraph "Event Emissions"
        PROGRESS[Progress Events]
        ERROR[Error Events]
        STATUS[Status Events]
    end
    
    SYNC --> PROGRESS
    PROCESS --> PROGRESS
    CONNECT --> ERROR
    SYNC --> ERROR
```

#### Git Connector (`src/modules/ingestion/connectors/git-connector.ts`)
**Purpose**: Git repository analysis and ingestion  
**Capabilities**:
- File content extraction
- Commit history analysis
- Language detection
- Incremental sync support
- Smart filtering

**Processing Flow**:
1. Repository validation
2. File discovery and filtering
3. Content extraction and processing
4. Commit history analysis
5. Metadata enrichment
6. Knowledge base storage

---

### 5. Data Storage Layer

#### PostgreSQL (Primary Database)
**Purpose**: Relational data storage  
**Schema**: Comprehensive data model with 20+ entities

```mermaid
erDiagram
    User ||--o{ Project : owns
    User ||--o{ Query : submits
    Project ||--o{ DataSource : has
    Project ||--o{ Document : contains
    Document ||--o{ Chunk : split_into
    Query ||--|| Response : generates
    Response ||--o{ ResponseSource : references
    
    User {
        string id PK
        string email
        string name
        string role
        datetime created_at
    }
    
    Project {
        string id PK
        string name
        string owner_id FK
        json settings
        string status
        datetime created_at
    }
    
    Document {
        string id PK
        string project_id FK
        string title
        string content
        string type
        json metadata
    }
    
    Query {
        string id PK
        string user_id FK
        string project_id FK
        string query_text
        string intent
        datetime created_at
    }
```

#### Redis (Caching & Sessions)
**Purpose**: High-performance caching and session storage  
**Use Cases**:
- Authentication token caching
- Rate limiting counters
- Temporary data storage
- Pub/sub messaging

#### Neo4j (Graph Database)
**Purpose**: Relationship and graph data  
**Use Cases**:
- Code dependency graphs
- Knowledge relationships
- User interaction patterns
- Project relationships

#### Pinecone (Vector Database)
**Purpose**: Vector embeddings and semantic search  
**Configuration**:
- Dimensions: 1536 (OpenAI ada-002)
- Metric: Cosine similarity
- Namespace-based multi-tenancy

---

## Data Flow Architecture

### Query Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Agent
    participant Intent
    participant Pipeline
    participant Vector
    participant LLM
    participant DB

    User->>API: Submit Query
    API->>Agent: Process Query
    Agent->>Intent: Classify Intent
    Intent-->>Agent: Intent + Confidence
    Agent->>Pipeline: Execute Pipeline
    Pipeline->>Vector: Search Knowledge
    Vector-->>Pipeline: Relevant Documents
    Pipeline->>LLM: Generate Response
    LLM-->>Pipeline: AI Response
    Pipeline-->>Agent: Complete Response
    Agent->>DB: Store Query/Response
    Agent-->>API: Return Response
    API-->>User: JSON Response
```

### Data Ingestion Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Project
    participant Connector
    participant Processor
    participant Vector
    participant DB

    User->>API: Create Project
    API->>Project: Initialize Project
    Project->>Connector: Start Sync
    Connector->>Connector: Extract Files
    Connector->>Processor: Process Documents
    Processor->>Processor: Chunk Content
    Processor->>Vector: Generate Embeddings
    Vector->>Vector: Store Vectors
    Processor->>DB: Store Metadata
    Connector-->>Project: Sync Complete
    Project-->>API: Status Update
    API-->>User: Sync Status
```

---

## Security Architecture

### Authentication & Authorization

```mermaid
graph TD
    REQUEST[HTTP Request] --> AUTH_CHECK{Has Token?}
    AUTH_CHECK -->|No| REJECT[401 Unauthorized]
    AUTH_CHECK -->|Yes| VALIDATE[Validate JWT]
    VALIDATE --> VALID{Valid Token?}
    VALID -->|No| REJECT
    VALID -->|Yes| EXTRACT[Extract User Context]
    EXTRACT --> AUTHORIZE[Check Permissions]
    AUTHORIZE --> ALLOW[Allow Request]
```

**Security Layers**:
1. **Transport Security**: HTTPS enforcement
2. **Authentication**: JWT token validation
3. **Authorization**: Role-based access control
4. **Input Validation**: Request sanitization
5. **Rate Limiting**: Abuse prevention
6. **Audit Logging**: Security event tracking

### Data Protection
- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: TLS/HTTPS
- **Token Security**: Secure JWT handling
- **Input Sanitization**: XSS/injection prevention
- **CORS Configuration**: Cross-origin protection

---

## Scalability & Performance

### Horizontal Scaling Strategy

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Load Balancer]
    end
    
    subgraph "Application Tier"
        APP1[Hikma Instance 1]
        APP2[Hikma Instance 2]
        APP3[Hikma Instance N]
    end
    
    subgraph "Data Tier"
        POSTGRES_PRIMARY[(PostgreSQL Primary)]
        POSTGRES_REPLICA[(PostgreSQL Replica)]
        REDIS_CLUSTER[(Redis Cluster)]
        PINECONE[(Pinecone)]
    end
    
    LB --> APP1
    LB --> APP2
    LB --> APP3
    
    APP1 --> POSTGRES_PRIMARY
    APP2 --> POSTGRES_REPLICA
    APP3 --> POSTGRES_PRIMARY
    
    APP1 --> REDIS_CLUSTER
    APP2 --> REDIS_CLUSTER
    APP3 --> REDIS_CLUSTER
    
    APP1 --> PINECONE
    APP2 --> PINECONE
    APP3 --> PINECONE
```

### Performance Optimizations
- **Connection Pooling**: Database connection management
- **Caching Strategy**: Multi-layer caching
- **Batch Processing**: Efficient bulk operations
- **Async Processing**: Non-blocking operations
- **Rate Limiting**: Resource protection
- **Query Optimization**: Efficient database queries

---

## Observability & Monitoring

### Logging Architecture

```mermaid
graph LR
    subgraph "Application"
        APP[Hikma Service]
        LOGGER[Pino Logger]
    end
    
    subgraph "Log Processing"
        COLLECTOR[Log Collector]
        PROCESSOR[Log Processor]
    end
    
    subgraph "Storage & Analysis"
        STORAGE[Log Storage]
        DASHBOARD[Monitoring Dashboard]
        ALERTS[Alert Manager]
    end
    
    APP --> LOGGER
    LOGGER --> COLLECTOR
    COLLECTOR --> PROCESSOR
    PROCESSOR --> STORAGE
    STORAGE --> DASHBOARD
    STORAGE --> ALERTS
```

**Logging Features**:
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Debug, info, warn, error, fatal
- **Context Enrichment**: Request context and user information
- **Performance Tracking**: Execution time and resource usage
- **Error Tracking**: Detailed error information and stack traces

### Health Monitoring
- **Service Health**: Individual service status
- **Dependency Health**: External service monitoring
- **Performance Metrics**: Response times and throughput
- **Resource Monitoring**: CPU, memory, and disk usage
- **Business Metrics**: Query success rates and user activity

---

## Deployment Architecture

### Container Strategy

```mermaid
graph TB
    subgraph "Container Orchestration"
        K8S[Kubernetes Cluster]
    end
    
    subgraph "Application Containers"
        HIKMA[Hikma Service]
        NGINX[Nginx Proxy]
    end
    
    subgraph "Data Containers"
        POSTGRES[PostgreSQL]
        REDIS[Redis]
        NEO4J[Neo4j]
    end
    
    subgraph "External Services"
        PINECONE[Pinecone SaaS]
        OPENAI[OpenAI API]
    end
    
    K8S --> HIKMA
    K8S --> NGINX
    K8S --> POSTGRES
    K8S --> REDIS
    K8S --> NEO4J
    
    HIKMA --> PINECONE
    HIKMA --> OPENAI
```

### Environment Configuration
- **Development**: Local Docker Compose
- **Staging**: Kubernetes with reduced resources
- **Production**: Kubernetes with high availability
- **Testing**: Isolated test environments

---

## API Design Principles

### RESTful Design
- **Resource-Based URLs**: Clear resource identification
- **HTTP Methods**: Proper verb usage (GET, POST, PUT, DELETE)
- **Status Codes**: Meaningful HTTP status codes
- **Content Negotiation**: JSON API responses
- **Versioning**: API version management

### Error Handling
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  correlationId: string;
  details?: any;
}
```

### Response Format
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: any;
  correlationId: string;
}
```

---

## Technology Stack Summary

### Core Technologies
- **Runtime**: Node.js 20+
- **Framework**: Fastify 4+
- **Language**: TypeScript 5+
- **Database ORM**: Prisma
- **Validation**: Zod
- **Logging**: Pino

### External Services
- **Vector Database**: Pinecone
- **LLM Provider**: OpenAI
- **Primary Database**: PostgreSQL
- **Cache/Session**: Redis
- **Graph Database**: Neo4j

### Development Tools
- **Build Tool**: TypeScript Compiler
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Jest (planned)
- **Containerization**: Docker

---

## Future Architecture Considerations

### Microservices Evolution
- **Service Decomposition**: Split into focused microservices
- **Event-Driven Architecture**: Async communication patterns
- **API Gateway**: Centralized routing and cross-cutting concerns
- **Service Mesh**: Advanced networking and observability

### Advanced Features
- **Real-time Processing**: WebSocket integration
- **Stream Processing**: Event streaming with Kafka
- **Machine Learning**: Custom model training and deployment
- **Multi-tenancy**: Enhanced isolation and resource management

This architecture provides a solid foundation for a production-ready agentic code intelligence platform with room for future growth and enhancement.

