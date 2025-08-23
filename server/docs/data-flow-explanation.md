# Hikma Data Flow Explanation

This document explains how data flows through the Hikma platform based on the database schema, describing the relationships and dependencies between different entities.

## Core Data Flow Architecture

### 1. Project as the Central Hub

The **Project** table serves as the root of all data organization in Hikma. Its primary key (`id`) is referenced by multiple core tables, making it the central organizing principle for data isolation and multi-tenancy:

- **ProjectMember**: Links users to projects with specific roles (OWNER, ADMIN, MEMBER, VIEWER)
- **DataSource**: Defines what external data sources (Git repos, GitHub, Jira, etc.) belong to each project
- **QueryLog**: Tracks all queries made within the context of a project
- **SyncJob**: Manages synchronization tasks for project data sources
- **KnowledgeBase**: Organizes processed documents within a project
- **Webhook**: Configures project-specific webhook integrations

Each project acts as an isolated workspace where teams can manage their codebase intelligence without interfering with other projects.

### 2. User Management and Access Control

The **User** table stores core user information and serves as the authentication anchor. User access is controlled through several mechanisms:

- **ApiKey**: Users can generate multiple API keys for programmatic access, each with expiration dates and usage tracking
- **ProjectMember**: Users gain access to projects through membership records that define their role and permissions
- **QueryLog**: All user interactions are logged with user attribution for analytics and audit purposes
- **Feedback**: Users can provide feedback on query responses, creating a feedback loop for system improvement

### 3. Data Ingestion Pipeline

The data ingestion process follows a structured pipeline:

#### Step 1: Data Source Configuration
**DataSource** records define external systems to pull data from:
- **Type**: Specifies the source type (GIT, GITHUB, JIRA, SLACK, CONFLUENCE, FILE_UPLOAD)
- **Config**: Stores connection details, authentication tokens, and source-specific settings
- **Status**: Tracks whether the source is active, has errors, or is disabled
- **Sync Scheduling**: Maintains `lastSyncAt` and `nextSyncAt` for automated synchronization

#### Step 2: Synchronization Jobs
**SyncJob** records manage the actual data pulling process:
- Each sync job is linked to both a **Project** and a **DataSource**
- **Type**: Defines sync strategy (FULL_SYNC, INCREMENTAL_SYNC, REINDEX, CLEANUP)
- **Progress Tracking**: Monitors `totalItems`, `processedItems`, and completion percentage
- **Error Handling**: Accumulates errors and tracks failure patterns
- **Metadata**: Stores sync-specific information like commit ranges, API pagination tokens, etc.

#### Step 3: Document Processing
**Document** records represent processed content from data sources:
- Each document belongs to both a **KnowledgeBase** and originates from a **DataSource**
- **Content Types**: Supports various document types (CODE_FILE, COMMIT, PULL_REQUEST, ISSUE, etc.)
- **Processing Status**: Tracks document lifecycle (PENDING → PROCESSING → INDEXED → ERROR/ARCHIVED)
- **Deduplication**: Uses content hashing to avoid processing duplicate content
- **Vector Integration**: Stores `vectorId` for Pinecone vector database integration
- **Graph Integration**: Stores `graphNodeId` for Neo4j relationship mapping

#### Step 4: Content Chunking
**DocumentChunk** records break large documents into searchable pieces:
- Each chunk belongs to a parent **Document** with a sequential `chunkIndex`
- **Embeddings**: Stores vector embeddings directly in PostgreSQL for hybrid search
- **Vector IDs**: Links to external vector database entries
- **Metadata**: Preserves context about chunk boundaries, code structure, etc.

### 4. Knowledge Base Organization

**KnowledgeBase** acts as a logical container within projects:
- Groups related documents together (e.g., "Main Codebase", "Documentation", "Issues")
- Allows different processing configurations per knowledge base
- Enables fine-grained access control and search scoping
- Supports multiple knowledge bases per project for different content types

### 5. Query Processing and Intelligence

The query processing flow demonstrates the platform's AI capabilities:

#### Query Initiation
**QueryLog** records capture every user interaction:
- Links to both **Project** (for context) and **User** (for personalization)
- **Intent Recognition**: Stores detected user intent and extracted entities
- **Pipeline Tracking**: Records which processing pipeline was used
- **Performance Metrics**: Tracks response time and token usage
- **Session Management**: Groups related queries via `sessionId`

#### Tool Execution
**ToolCall** records track AI agent tool usage:
- Each tool call is linked to a parent **QueryLog**
- **Tool Inventory**: Records which tools were invoked (search, code analysis, etc.)
- **Input/Output Tracking**: Stores tool parameters and results
- **Performance Monitoring**: Tracks execution time and success rates
- **Error Handling**: Captures tool-specific errors for debugging

#### Feedback Loop
**Feedback** records create a continuous improvement cycle:
- Users can rate responses (THUMBS_UP, THUMBS_DOWN, RATING, COMMENT)
- Each feedback is linked to both the **QueryLog** and **User**
- **Analytics**: Enables tracking of response quality over time
- **Model Training**: Provides data for fine-tuning and improvement

### 6. System Monitoring and Configuration

#### Metrics Collection
**Metric** records provide operational insights:
- **Time Series Data**: Tracks system performance, usage patterns, and business metrics
- **Flexible Labeling**: JSON labels allow multi-dimensional metric analysis
- **Real-time Monitoring**: Supports dashboards and alerting systems

#### Configuration Management
**Configuration** provides dynamic system settings:
- **Key-Value Store**: Allows runtime configuration changes without deployments
- **Feature Flags**: Enables gradual feature rollouts and A/B testing
- **Integration Settings**: Stores API endpoints, rate limits, and service configurations

### 7. External Integration Layer

#### Webhook System
**Webhook** and **WebhookDelivery** enable real-time integrations:
- **Event-Driven Architecture**: Notifies external systems of important events
- **Delivery Tracking**: Monitors webhook success rates and retry logic
- **Project Scoping**: Webhooks can be project-specific or system-wide
- **Security**: Supports webhook signing for secure integrations

## Data Flow Scenarios

### Scenario 1: New Project Onboarding
1. **User** creates a **Project** and becomes the first **ProjectMember** with OWNER role
2. **User** configures **DataSource** records for Git repositories, GitHub, Jira, etc.
3. System creates **KnowledgeBase** containers for different content types
4. **SyncJob** records are scheduled to begin data ingestion
5. **Webhook** configurations are set up for real-time updates

### Scenario 2: Data Synchronization
1. **SyncJob** begins processing a **DataSource**
2. Raw content is converted into **Document** records with appropriate metadata
3. Large documents are split into **DocumentChunk** records for better searchability
4. Vector embeddings are generated and stored for semantic search
5. **Metric** records track sync performance and content volume

### Scenario 3: User Query Processing
1. **User** submits a query, creating a **QueryLog** record
2. System executes various **ToolCall** records to search, analyze, and synthesize information
3. Response is generated and stored in the **QueryLog**
4. **User** provides **Feedback** on response quality
5. **Metric** records track query performance and user satisfaction

### Scenario 4: Continuous Learning
1. **Feedback** records are analyzed to identify improvement opportunities
2. **Configuration** settings are updated to optimize performance
3. **Webhook** notifications inform external systems of significant changes
4. **Metric** trends guide system scaling and resource allocation decisions

## Key Design Principles

1. **Multi-Tenancy**: Project-based isolation ensures data security and organization
2. **Audit Trail**: Comprehensive logging of all user actions and system operations
3. **Scalability**: Chunked documents and distributed storage support large codebases
4. **Flexibility**: JSON configuration fields allow adaptation to different use cases
5. **Observability**: Extensive metrics and logging enable operational excellence
6. **Integration**: Webhook system supports ecosystem connectivity
7. **Continuous Improvement**: Feedback loops enable system learning and optimization

This data flow design supports Hikma's mission as an "Agentic Code Intelligence Platform" by providing a robust foundation for ingesting, processing, and serving intelligent insights about codebases and development workflows.