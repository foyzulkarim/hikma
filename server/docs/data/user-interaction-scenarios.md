# User Interaction Scenarios

This document outlines the end-to-end data flow for various user interaction scenarios in Hikma, showing how data moves through the system from user action to response.

## 🎯 Scenario Categories

### 1. Project Onboarding Scenarios
### 2. Query & Search Scenarios  
### 3. Data Synchronization Scenarios
### 4. Collaboration Scenarios
### 5. Analytics & Monitoring Scenarios

---

## 1. Project Onboarding Scenarios

### Scenario 1.1: New Project Creation

**User Journey**: Developer creates a new project and connects data sources

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Layer
    participant PS as Project Service
    participant DB as PostgreSQL
    participant DS as DataSource Service
    participant SJ as Sync Job Manager
    participant KB as Knowledge Base
    
    U->>API: POST /api/v1/projects
    API->>PS: createProject(data)
    PS->>DB: INSERT INTO projects
    PS->>DB: INSERT INTO project_members (OWNER role)
    PS->>KB: createDefaultKnowledgeBase()
    KB->>DB: INSERT INTO knowledge_bases
    PS-->>API: Project created
    API-->>U: 201 Created
    
    Note over U,KB: Project setup complete, now add data sources
    
    U->>API: POST /api/v1/projects/{id}/datasources
    API->>DS: createDataSource(config)
    DS->>DB: INSERT INTO data_sources
    DS->>SJ: scheduleInitialSync()
    SJ->>DB: INSERT INTO sync_jobs (FULL_SYNC)
    DS-->>API: DataSource created
    API-->>U: 201 Created
```

**Data Flow Details:**

1. **Project Creation**:
   - User data validated and project record created
   - User automatically becomes project owner
   - Default knowledge base containers created
   - Project settings initialized with defaults

2. **Data Source Configuration**:
   - External system credentials validated
   - Connection tested and configuration stored
   - Initial sync job scheduled
   - Webhook endpoints configured (if applicable)

**Database Changes**:
```sql
-- Project creation
INSERT INTO projects (id, name, slug, status, settings) VALUES (...);
INSERT INTO project_members (project_id, user_id, role) VALUES (..., 'OWNER');
INSERT INTO knowledge_bases (project_id, name, description) VALUES (..., 'Main Codebase', ...);

-- Data source addition
INSERT INTO data_sources (project_id, name, type, config, status) VALUES (...);
INSERT INTO sync_jobs (project_id, data_source_id, type, status) VALUES (..., 'FULL_SYNC', 'PENDING');
```

### Scenario 1.2: Team Member Invitation

**User Journey**: Project owner invites team members with specific roles

```mermaid
sequenceDiagram
    participant O as Owner
    participant API as API Layer
    participant PS as Project Service
    participant NS as Notification Service
    participant M as Member
    participant DB as PostgreSQL
    
    O->>API: POST /api/v1/projects/{id}/members
    API->>PS: inviteMember(email, role)
    PS->>DB: SELECT user WHERE email = ?
    
    alt User exists
        PS->>DB: INSERT INTO project_members
        PS->>NS: sendInvitationNotification()
        NS-->>M: Email/Slack notification
    else User doesn't exist
        PS->>DB: INSERT INTO pending_invitations
        PS->>NS: sendSignupInvitation()
        NS-->>M: Signup invitation email
    end
    
    PS-->>API: Invitation sent
    API-->>O: 200 OK
    
    M->>API: GET /api/v1/projects (after login)
    API->>PS: getUserProjects(userId)
    PS->>DB: SELECT projects via project_members
    PS-->>API: Project list
    API-->>M: Projects with access
```

---

## 2. Query & Search Scenarios

### Scenario 2.1: Natural Language Code Query

**User Journey**: Developer asks "How does authentication work in this codebase?"

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Layer
    participant AO as Agent Orchestrator
    participant IC as Intent Classifier
    participant VS as Vector Search
    participant GS as Graph Search
    participant LLM as LLM Service
    participant DB as PostgreSQL
    participant VDB as Qdrant
    participant GDB as Neo4j
    participant Cache as Redis
    
    U->>API: POST /api/v1/query
    API->>AO: processQuery(query, context)
    AO->>DB: INSERT INTO query_logs (PENDING)
    
    AO->>IC: classifyIntent(query)
    IC->>LLM: analyzeQuery(query)
    LLM-->>IC: Intent: "code_explanation", Entities: ["authentication"]
    IC-->>AO: QueryIntent
    
    AO->>VS: searchSimilar("authentication", project_id)
    VS->>Cache: GET cached_results
    Cache-->>VS: Cache miss
    VS->>VDB: query(embedding, filters)
    VDB-->>VS: Similar documents
    VS->>Cache: SET cached_results
    VS-->>AO: Relevant code files
    
    AO->>GS: findRelated("authentication", relationships)
    GS->>GDB: MATCH (n:CodeFile)-[:IMPORTS|CALLS]->(m) WHERE n.name CONTAINS "auth"
    GDB-->>GS: Related components
    GS-->>AO: Dependency graph
    
    AO->>LLM: synthesizeResponse(context, documents, graph)
    LLM-->>AO: Generated response
    
    AO->>DB: UPDATE query_logs SET response = ?, status = 'COMPLETED'
    AO-->>API: Query response
    API-->>U: Formatted response
```

**Data Flow Details:**

1. **Query Processing**:
   - Query logged with user context and project scope
   - Intent classification extracts key entities and determines processing pipeline
   - Multiple search strategies executed in parallel

2. **Knowledge Retrieval**:
   - Vector search finds semantically similar content
   - Graph traversal discovers related components
   - Cache layer reduces latency for repeated queries

3. **Response Generation**:
   - Context assembled from multiple sources
   - LLM generates coherent response
   - Response quality validated and logged

**Performance Optimizations**:
- Parallel execution of search operations
- Multi-level caching (Redis, application-level)
- Connection pooling for database operations
- Async processing for non-critical operations

### Scenario 2.2: Code Search with Filters

**User Journey**: Developer searches for "error handling" in specific file types

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Layer
    participant SS as Search Service
    participant VDB as Qdrant
    participant DB as PostgreSQL
    participant Cache as Redis
    
    U->>API: GET /api/v1/search?q="error handling"&type=CODE_FILE&ext=.ts,.js
    API->>SS: search(query, filters)
    
    SS->>Cache: GET search_cache_key
    Cache-->>SS: Cache miss
    
    SS->>VDB: query(embedding, metadata_filters)
    Note over VDB: Filter by document_type='CODE_FILE' AND file_extension IN ['.ts', '.js']
    VDB-->>SS: Matching chunks
    
    SS->>DB: SELECT documents WHERE id IN (chunk_document_ids)
    DB-->>SS: Document metadata
    
    SS->>Cache: SET search_results (TTL: 5min)
    SS-->>API: Search results
    API-->>U: Formatted results with highlights
```

---

## 3. Data Synchronization Scenarios

### Scenario 3.1: Scheduled Repository Sync

**User Journey**: System performs scheduled sync of Git repository

```mermaid
sequenceDiagram
    participant Scheduler as Job Scheduler
    participant SJM as Sync Job Manager
    participant GC as Git Connector
    participant DP as Document Processor
    participant ES as Embedding Service
    participant GB as Graph Builder
    participant DB as PostgreSQL
    participant VDB as Qdrant
    participant GDB as Neo4j
    
    Scheduler->>SJM: executePendingSyncJobs()
    SJM->>DB: SELECT sync_jobs WHERE status='PENDING' AND next_sync_at <= NOW()
    DB-->>SJM: Pending jobs
    
    loop For each sync job
        SJM->>DB: UPDATE sync_jobs SET status='RUNNING', started_at=NOW()
        SJM->>GC: syncRepository(config)
        
        GC->>GC: git fetch --all
        GC->>GC: git log --since=last_sync
        GC-->>SJM: Changed files list
        
        loop For each changed file
            SJM->>DP: processDocument(file_content, metadata)
            DP->>DP: parseContent()
            DP->>DP: chunkDocument()
            DP->>DB: UPSERT INTO documents
            DP->>DB: INSERT INTO document_chunks
            
            DP->>ES: generateEmbeddings(chunks)
            ES-->>DP: Vector embeddings
            DP->>VDB: upsert(chunk_id, embedding, metadata)
            
            DP->>GB: extractRelationships(document)
            GB->>GDB: MERGE (n:CodeFile {id: doc_id})
            GB->>GDB: MERGE relationships
        end
        
        SJM->>DB: UPDATE sync_jobs SET status='COMPLETED', completed_at=NOW()
    end
```

**Error Handling**:
- Transactional processing with rollback on failures
- Partial sync recovery for large repositories
- Dead letter queue for failed document processing
- Exponential backoff for external API failures

### Scenario 3.2: Real-time Webhook Processing

**User Journey**: GitHub webhook triggers immediate content update

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant WH as Webhook Handler
    participant EB as Event Bus
    participant WP as Webhook Processor
    participant ISM as Incremental Sync Manager
    participant Cache as Redis
    participant DB as PostgreSQL
    
    GH->>WH: POST /webhooks/github (push event)
    WH->>WH: validateSignature()
    WH->>DB: INSERT INTO webhook_deliveries
    WH->>EB: publishEvent('github.push', payload)
    WH-->>GH: 200 OK
    
    EB->>WP: handleGitHubPush(event)
    WP->>WP: extractChangedFiles(commits)
    WP->>ISM: scheduleIncrementalSync(files)
    
    ISM->>DB: INSERT INTO sync_jobs (INCREMENTAL_SYNC)
    ISM->>Cache: INVALIDATE project_cache
    ISM->>EB: publishEvent('sync.scheduled')
    
    Note over WP,ISM: Async processing continues in background
```

---

## 4. Collaboration Scenarios

### Scenario 4.1: Team Query with Context Sharing

**User Journey**: Team member asks question building on previous conversation

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant API as API Layer
    participant SM as Session Manager
    participant AO as Agent Orchestrator
    participant Cache as Redis
    participant DB as PostgreSQL
    
    U1->>API: POST /api/v1/query (session_id: "team-session-123")
    API->>SM: getSessionContext(session_id)
    SM->>Cache: GET session:team-session-123
    Cache-->>SM: Previous queries and context
    SM-->>API: Session context
    
    API->>AO: processQuery(query, session_context)
    AO->>AO: buildContextualResponse()
    AO->>DB: INSERT INTO query_logs (session_id)
    AO->>Cache: UPDATE session:team-session-123
    AO-->>API: Response
    API-->>U1: Contextual response
    
    Note over U1,U2: U2 joins the conversation
    
    U2->>API: POST /api/v1/query (session_id: "team-session-123")
    API->>SM: getSessionContext(session_id)
    SM->>Cache: GET session:team-session-123
    Cache-->>SM: Full conversation history
    SM-->>API: Shared context
    
    API->>AO: processQuery(query, shared_context)
    AO-->>API: Response building on team conversation
    API-->>U2: Contextual team response
```

### Scenario 4.2: Feedback and Learning Loop

**User Journey**: User provides feedback on query response quality

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Layer
    participant FS as Feedback Service
    participant AS as Analytics Service
    participant ML as ML Pipeline
    participant DB as PostgreSQL
    
    U->>API: POST /api/v1/feedback (query_id, rating, comment)
    API->>FS: recordFeedback(feedback_data)
    FS->>DB: INSERT INTO feedback
    FS->>AS: updateQueryMetrics(query_id, rating)
    AS->>DB: UPDATE metrics
    
    FS->>ML: enqueueFeedbackForTraining(feedback)
    ML->>ML: analyzeResponseQuality()
    ML->>ML: updateModelWeights()
    
    FS-->>API: Feedback recorded
    API-->>U: Thank you for feedback
    
    Note over AS,ML: Background analytics processing
    AS->>AS: aggregateUserSatisfaction()
    AS->>AS: identifyImprovementAreas()
    AS->>DB: INSERT INTO analytics_insights
```

---

## 5. Analytics & Monitoring Scenarios

### Scenario 5.1: Real-time Performance Dashboard

**User Journey**: Admin views system performance metrics

```mermaid
sequenceDiagram
    participant A as Admin
    participant WS as WebSocket
    participant MS as Metrics Service
    participant MC as Metrics Collector
    participant DB as PostgreSQL
    participant Cache as Redis
    
    A->>WS: connect('/dashboard/metrics')
    WS->>MS: subscribeToMetrics(admin_id)
    
    loop Every 30 seconds
        MC->>DB: SELECT recent metrics
        MC->>Cache: GET cached_aggregations
        MC->>MS: publishMetrics(real_time_data)
        MS->>WS: broadcastMetrics()
        WS-->>A: Live dashboard updates
    end
    
    A->>WS: requestDetailedMetrics(time_range)
    WS->>MS: getHistoricalMetrics(range)
    MS->>DB: SELECT metrics WHERE timestamp BETWEEN ? AND ?
    MS-->>WS: Historical data
    WS-->>A: Detailed charts and graphs
```

### Scenario 5.2: Automated Alert Processing

**User Journey**: System detects performance anomaly and sends alerts

```mermaid
sequenceDiagram
    participant MC as Metrics Collector
    participant AD as Anomaly Detector
    participant AM as Alert Manager
    participant NS as Notification Service
    participant Slack as Slack
    participant Email as Email Service
    participant DB as PostgreSQL
    
    MC->>AD: checkMetrics(current_values)
    AD->>AD: compareWithBaseline()
    AD->>AD: detectAnomalies()
    
    alt Anomaly detected
        AD->>AM: triggerAlert(anomaly_data)
        AM->>DB: INSERT INTO alerts
        AM->>NS: sendNotifications(alert)
        
        par Parallel notifications
            NS->>Slack: postMessage(#alerts channel)
            NS->>Email: sendEmail(admin_list)
        end
        
        AM->>AM: scheduleFollowUp()
    end
```

---

## 🔧 Cross-Cutting Concerns

### Authentication & Authorization

All scenarios include authentication and authorization checks:

```typescript
// Middleware applied to all API endpoints
async function authMiddleware(request: FastifyRequest) {
  const token = extractToken(request.headers.authorization);
  const user = await validateToken(token);
  const project = await getProjectFromRequest(request);
  
  // Check user has access to project
  await checkProjectAccess(user.id, project.id);
  
  request.user = user;
  request.project = project;
}
```

### Error Handling

Consistent error handling across all scenarios:

```typescript
// Global error handler
async function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  // Log error with context
  logger.error('Request failed', {
    error: error.message,
    stack: error.stack,
    userId: request.user?.id,
    projectId: request.project?.id,
    requestId: request.id
  });
  
  // Update metrics
  await metricsService.incrementErrorCount(error.constructor.name);
  
  // Return appropriate response
  const statusCode = getStatusCodeFromError(error);
  reply.status(statusCode).send({
    error: error.message,
    requestId: request.id
  });
}
```

### Caching Strategy

Multi-level caching improves performance across scenarios:

```typescript
// Cache hierarchy
const cacheStrategy = {
  L1: 'Application Memory',    // Hot data, 1-5 minutes TTL
  L2: 'Redis',                // Warm data, 5-60 minutes TTL  
  L3: 'Database Query Cache', // Cold data, 1-24 hours TTL
};
```

### Monitoring & Observability

All scenarios include comprehensive monitoring:

- **Request Tracing**: Distributed tracing across all services
- **Performance Metrics**: Response times, throughput, error rates
- **Business Metrics**: User engagement, query success rates
- **Infrastructure Metrics**: Database performance, cache hit rates

---

These user interaction scenarios demonstrate how Hikma's architecture supports complex workflows while maintaining performance, reliability, and user experience quality.