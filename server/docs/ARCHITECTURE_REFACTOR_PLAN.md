# Hikma Architecture Refactor Plan

**Document Version**: 1.0  
**Date**: December 2024  
**Status**: Planning Phase  
**Purpose**: Comprehensive architectural refactoring plan for Hikma's agentic code intelligence platform

---

## Executive Summary

This document outlines the architectural refactoring plan for Hikma, transitioning from the current tangled module structure to a clean, agentic-focused architecture that properly reflects the system's nature as an AI-powered code intelligence platform.

### Key Objectives
- Establish clear separation between agentic intelligence, knowledge management, and workflow automation
- Align architecture with Node.js best practices while supporting AI/ML workloads
- Create maintainable, scalable structure for the four development phases
- Improve developer experience and system observability

---

## Current State Analysis

### Existing Structure Issues
- Mixed concerns within the `modules/` directory
- `api` module contains technical concerns that should be at application layer
- Unclear boundaries between business domains and technical capabilities
- Agent orchestration logic scattered across multiple modules
- Knowledge and workflow components not properly separated

### Strengths to Preserve
- Clear `core/`, `infrastructure/`, and `config/` separation
- Good use of TypeScript and modern tooling
- Comprehensive testing structure
- Docker-based deployment approach

---

## Target Architecture

### High-Level Principles
1. **Agent-Centric Design**: Agents orchestrate all system behavior
2. **Domain-Driven Structure**: Clear boundaries between business capabilities
3. **Layered Architecture**: Proper separation of concerns across layers
4. **Event-Driven Communication**: Loose coupling through events
5. **Node.js Best Practices**: Feature-by-folder, dependency injection ready

### Proposed Directory Structure

```
hikma/
├── src/
│   ├── app/                    # 🚀 Application layer (HTTP, middleware, routing)
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── validation.ts
│   │   │   ├── rate-limiting.ts
│   │   │   └── error-handling.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── query.ts
│   │   │   ├── projects.ts
│   │   │   └── webhooks.ts
│   │   ├── websocket/
│   │   │   ├── handlers/
│   │   │   └── connection-manager.ts
│   │   └── server.ts
│   ├── config/                 # ⚙️ Configuration management
│   │   ├── app.ts
│   │   ├── database.ts
│   │   ├── llm.ts
│   │   ├── redis.ts
│   │   └── vector-db.ts
│   ├── core/                   # 🔧 Shared utilities, types, constants
│   │   ├── constants/
│   │   │   ├── agents.ts
│   │   │   ├── embeddings.ts
│   │   │   └── system.ts
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   ├── agent-error.ts
│   │   │   └── knowledge-error.ts
│   │   ├── types/
│   │   │   ├── agents.ts       # Agent-specific types
│   │   │   ├── embeddings.ts   # Vector/embedding types
│   │   │   ├── connectors.ts   # Integration types
│   │   │   └── workflow.ts     # Workflow types
│   │   └── utils/
│   │       ├── crypto.ts
│   │       ├── logger.ts
│   │       └── validation.ts
│   ├── agents/                 # 🤖 Core agentic intelligence layer
│   │   ├── orchestration/      # Agent coordination and workflow
│   │   │   ├── agent-coordinator.ts
│   │   │   ├── task-scheduler.ts
│   │   │   └── pipeline-manager.ts
│   │   ├── intents/           # Intent classification and routing
│   │   │   ├── intent-classifier.ts
│   │   │   ├── intent-router.ts
│   │   │   └── intent-types.ts
│   │   ├── pipelines/         # Processing pipelines for different query types
│   │   │   ├── code-analysis-pipeline.ts
│   │   │   ├── qa-pipeline.ts
│   │   │   ├── summary-pipeline.ts
│   │   │   └── base-pipeline.ts
│   │   ├── memory/            # Conversation context and memory management
│   │   │   ├── conversation-manager.ts
│   │   │   ├── context-builder.ts
│   │   │   └── memory-store.ts
│   │   ├── tools/             # Agent tools and capabilities
│   │   │   ├── code-search-tool.ts
│   │   │   ├── git-analysis-tool.ts
│   │   │   ├── pr-analysis-tool.ts
│   │   │   └── base-tool.ts
│   │   ├── synthesis/         # Response generation and synthesis
│   │   │   ├── response-generator.ts
│   │   │   ├── context-synthesizer.ts
│   │   │   └── output-formatter.ts
│   │   └── services/          # Agent service layer
│   │       ├── agent-service.ts
│   │       └── agent-registry.ts
│   ├── knowledge/              # 🧠 Knowledge management and RAG
│   │   ├── ingestion/         # Data ingestion from multiple sources
│   │   │   ├── connectors/    # Git, GitHub, Jira, etc.
│   │   │   │   ├── git-connector.ts
│   │   │   │   ├── github-connector.ts
│   │   │   │   ├── jira-connector.ts
│   │   │   │   └── base-connector.ts
│   │   │   ├── parsers/       # AST, document parsers
│   │   │   │   ├── code-parser.ts
│   │   │   │   ├── markdown-parser.ts
│   │   │   │   └── ast-parser.ts
│   │   │   └── processors/    # Data transformation
│   │   │       ├── chunk-processor.ts
│   │   │       ├── metadata-processor.ts
│   │   │       └── embedding-processor.ts
│   │   ├── retrieval/         # Hybrid search (vector + keyword + graph)
│   │   │   ├── vector-search.ts
│   │   │   ├── keyword-search.ts
│   │   │   ├── graph-search.ts
│   │   │   └── hybrid-search.ts
│   │   ├── embeddings/        # Vector generation and management
│   │   │   ├── embedding-service.ts
│   │   │   ├── embedding-cache.ts
│   │   │   └── embedding-utils.ts
│   │   ├── graph/             # Knowledge graph relationships
│   │   │   ├── graph-builder.ts
│   │   │   ├── relationship-mapper.ts
│   │   │   └── graph-query.ts
│   │   └── services/          # Knowledge service layer
│   │       ├── knowledge-service.ts
│   │       └── document-service.ts
│   ├── workflow/               # 🔄 Workflow automation and integration
│   │   ├── triggers/          # Event-driven workflow triggers
│   │   │   ├── pr-trigger.ts
│   │   │   ├── commit-trigger.ts
│   │   │   ├── issue-trigger.ts
│   │   │   └── base-trigger.ts
│   │   ├── actions/           # Automated actions (PR summaries, notifications)
│   │   │   ├── pr-summary-action.ts
│   │   │   ├── notification-action.ts
│   │   │   ├── quality-gate-action.ts
│   │   │   └── base-action.ts
│   │   ├── integrations/      # ChatOps, webhooks, external systems
│   │   │   ├── chatops/
│   │   │   │   ├── slack-integration.ts
│   │   │   │   └── teams-integration.ts
│   │   │   ├── webhooks/
│   │   │   │   ├── github-webhook.ts
│   │   │   │   └── jira-webhook.ts
│   │   │   └── base-integration.ts
│   │   └── services/          # Workflow service layer
│   │       ├── workflow-service.ts
│   │       └── automation-service.ts
│   ├── analytics/              # 📊 Intelligence and insights
│   │   ├── predictive/        # Story point prediction, effort estimation
│   │   │   ├── story-point-predictor.ts
│   │   │   ├── effort-estimator.ts
│   │   │   └── ml-models.ts
│   │   ├── insights/          # Development velocity, bottleneck detection
│   │   │   ├── velocity-analyzer.ts
│   │   │   ├── bottleneck-detector.ts
│   │   │   └── trend-analyzer.ts
│   │   ├── evaluation/        # Agent performance evaluation
│   │   │   ├── response-evaluator.ts
│   │   │   ├── accuracy-metrics.ts
│   │   │   └── performance-tracker.ts
│   │   └── services/          # Analytics service layer
│   │       ├── analytics-service.ts
│   │       └── metrics-service.ts
│   ├── domains/                # 🏢 Business domain entities
│   │   ├── projects/
│   │   │   ├── entities/
│   │   │   │   ├── project.ts
│   │   │   │   └── repository.ts
│   │   │   ├── repositories/
│   │   │   │   └── project-repository.ts
│   │   │   ├── services/
│   │   │   │   └── project-service.ts
│   │   │   └── use-cases/
│   │   │       ├── create-project.ts
│   │   │       └── sync-project.ts
│   │   └── users/
│   │       ├── entities/
│   │       │   └── user.ts
│   │       ├── repositories/
│   │       │   └── user-repository.ts
│   │       ├── services/
│   │       │   └── user-service.ts
│   │       └── use-cases/
│   │           ├── authenticate-user.ts
│   │           └── manage-permissions.ts
│   ├── infrastructure/          # 🔧 External dependencies and technical concerns
│   │   ├── database/
│   │   │   ├── prisma/
│   │   │   │   └── client.ts
│   │   │   └── repositories/
│   │   │       └── base-repository.ts
│   │   ├── vector-store/       # Pinecone integration
│   │   │   ├── pinecone-client.ts
│   │   │   └── vector-operations.ts
│   │   ├── graph-db/           # Neo4j integration
│   │   │   ├── neo4j-client.ts
│   │   │   └── graph-operations.ts
│   │   ├── llm/                # OpenAI API integration
│   │   │   ├── openai-client.ts
│   │   │   ├── prompt-templates.ts
│   │   │   └── response-parser.ts
│   │   ├── queue/              # Redis queue management
│   │   │   ├── redis-client.ts
│   │   │   ├── job-queue.ts
│   │   │   └── queue-processor.ts
│   │   └── monitoring/
│   │       ├── logging/
│   │       │   ├── logger.ts
│   │       │   └── log-formatter.ts
│   │       ├── metrics/
│   │       │   ├── prometheus.ts
│   │       │   └── custom-metrics.ts
│   │       └── alerting/
│   │           ├── alert-manager.ts
│   │           └── notification-service.ts
│   └── shared/                 # 🤝 Cross-cutting concerns
│       ├── events/             # Event system for agent communication
│       │   ├── event-bus.ts
│       │   ├── event-types.ts
│       │   └── event-handlers.ts
│       ├── validators/
│       │   ├── schema-validator.ts
│       │   └── input-sanitizer.ts
│       └── decorators/
│           ├── cache.ts
│           ├── retry.ts
│           └── metrics.ts
```

---

## Layer Responsibilities

### 1. Application Layer (`app/`)
**Purpose**: HTTP server, routing, middleware, WebSocket handling  
**Responsibilities**:
- Request/response handling
- Authentication and authorization
- Input validation and sanitization
- Rate limiting and security
- WebSocket connection management
- API documentation (Swagger)

**Key Files**:
- `server.ts`: Main Fastify server setup
- `routes/`: RESTful API endpoints
- `middleware/`: Cross-cutting HTTP concerns
- `websocket/`: Real-time communication

### 2. Agents Layer (`agents/`)
**Purpose**: Core agentic intelligence and orchestration  
**Responsibilities**:
- Query intent classification
- Pipeline selection and execution
- Agent tool coordination
- Conversation memory management
- Response synthesis and generation
- Multi-turn dialogue handling

**Key Components**:
- **Orchestration**: Coordinates multiple agents and tools
- **Intents**: Classifies user queries and routes to appropriate pipelines
- **Pipelines**: Specialized processing flows (code analysis, Q&A, summarization)
- **Memory**: Maintains conversation context and history
- **Tools**: Specific capabilities agents can use
- **Synthesis**: Generates coherent responses from multiple sources

### 3. Knowledge Layer (`knowledge/`)
**Purpose**: RAG engine, data ingestion, and semantic search  
**Responsibilities**:
- Multi-source data ingestion (Git, GitHub, Jira)
- Document parsing and chunking
- Embedding generation and storage
- Vector, keyword, and graph search
- Knowledge graph construction
- Context retrieval for agents

**Key Components**:
- **Ingestion**: Connectors, parsers, and processors for external data
- **Retrieval**: Hybrid search capabilities
- **Embeddings**: Vector generation and management
- **Graph**: Relationship mapping and graph queries

### 4. Workflow Layer (`workflow/`)
**Purpose**: Automation, integrations, and event-driven actions  
**Responsibilities**:
- Event-driven workflow triggers
- Automated actions (PR summaries, notifications)
- ChatOps integrations (Slack, Teams)
- Webhook processing
- External system integrations
- Quality gate automation

**Key Components**:
- **Triggers**: Event detection and workflow initiation
- **Actions**: Automated responses to events
- **Integrations**: External system connections

### 5. Analytics Layer (`analytics/`)
**Purpose**: Intelligence, insights, and performance evaluation  
**Responsibilities**:
- Predictive analytics (story points, effort estimation)
- Development velocity tracking
- Bottleneck detection
- Agent performance evaluation
- Trend analysis
- Strategic insights

**Key Components**:
- **Predictive**: ML-based predictions and estimations
- **Insights**: Development process analytics
- **Evaluation**: Agent and system performance metrics

### 6. Domains Layer (`domains/`)
**Purpose**: Business entities and domain logic  
**Responsibilities**:
- Core business entities (Projects, Users)
- Domain-specific business rules
- Use case implementations
- Repository patterns for data access

**Structure Pattern**:
- `entities/`: Domain models and business objects
- `repositories/`: Data access interfaces
- `services/`: Domain business logic
- `use-cases/`: Application-specific business flows

### 7. Infrastructure Layer (`infrastructure/`)
**Purpose**: External dependencies and technical implementations  
**Responsibilities**:
- Database connections and operations
- External API integrations
- Queue management
- Monitoring and observability
- Caching strategies

### 8. Shared Layer (`shared/`)
**Purpose**: Cross-cutting concerns and utilities  
**Responsibilities**:
- Event system for inter-component communication
- Common validators and decorators
- Shared utilities and helpers

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
1. Create new directory structure
2. Move `core/`, `config/`, and `infrastructure/` with minimal changes
3. Set up new `app/` layer with existing server logic
4. Establish `shared/events/` system

### Phase 2: Agent Extraction (Week 3-4)
1. Extract agent-related code from `modules/agents/` to new `agents/` structure
2. Implement agent orchestration and pipeline patterns
3. Set up intent classification system
4. Migrate conversation memory management

### Phase 3: Knowledge Reorganization (Week 5-6)
1. Move ingestion logic from `modules/ingestion/` to `knowledge/ingestion/`
2. Reorganize knowledge services and retrieval systems
3. Implement hybrid search capabilities
4. Set up knowledge graph integration

### Phase 4: Workflow & Analytics (Week 7-8)
1. Extract workflow automation from existing modules
2. Implement trigger and action systems
3. Set up ChatOps integrations
4. Migrate analytics and evaluation systems

### Phase 5: Domain Cleanup (Week 9-10)
1. Organize domain entities and repositories
2. Implement clean use case patterns
3. Remove old `modules/` structure
4. Update all imports and dependencies

### Phase 6: Testing & Documentation (Week 11-12)
1. Update all tests to match new structure
2. Update documentation and API specs
3. Performance testing and optimization
4. Final cleanup and validation

---

## Implementation Guidelines

### Code Organization Principles
1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Inversion**: Depend on abstractions, not concretions
3. **Interface Segregation**: Small, focused interfaces
4. **Event-Driven**: Loose coupling through events
5. **Testability**: Easy to mock and test in isolation

### Naming Conventions
- **Services**: `*-service.ts` (e.g., `agent-service.ts`)
- **Repositories**: `*-repository.ts` (e.g., `project-repository.ts`)
- **Use Cases**: `*-*.ts` (e.g., `create-project.ts`)
- **Events**: `*-event.ts` (e.g., `query-processed-event.ts`)
- **Types**: `*.types.ts` or in `types/` folders

### Import Patterns
```typescript
// Good: Layer-aware imports
import { AgentService } from '@/agents/services/agent-service'
import { KnowledgeService } from '@/knowledge/services/knowledge-service'
import { ProjectEntity } from '@/domains/projects/entities/project'

// Avoid: Cross-layer dependencies
// Don't import infrastructure directly in agents
// Don't import agents directly in knowledge
```

### Event-Driven Communication
```typescript
// Agents emit events that other layers can listen to
eventBus.emit('query-processed', {
  queryId,
  result,
  metadata
})

// Workflow layer listens and triggers actions
eventBus.on('query-processed', async (event) => {
  await workflowService.triggerActions(event)
})
```

---

## Success Metrics

### Technical Metrics
- **Reduced Coupling**: Fewer cross-module dependencies
- **Improved Testability**: Higher test coverage, easier mocking
- **Better Performance**: Faster build times, optimized imports
- **Code Quality**: Lower complexity scores, better maintainability

### Developer Experience
- **Faster Onboarding**: New developers understand structure quickly
- **Easier Feature Development**: Clear patterns for adding new capabilities
- **Better Debugging**: Clear separation makes issues easier to isolate
- **Improved Documentation**: Self-documenting structure

### Business Impact
- **Faster Feature Delivery**: Well-organized code enables rapid development
- **Better System Reliability**: Clear boundaries reduce bugs
- **Easier Scaling**: Modular structure supports team growth
- **Enhanced AI Capabilities**: Proper agent orchestration improves intelligence

---

## Risk Mitigation

### Technical Risks
- **Breaking Changes**: Comprehensive testing during migration
- **Performance Regression**: Benchmarking before/after
- **Import Complexity**: Automated tooling for import updates
- **Team Coordination**: Clear communication and documentation

### Mitigation Strategies
- **Feature Flags**: Gradual rollout of new structure
- **Parallel Development**: Keep old structure until migration complete
- **Automated Testing**: Extensive test coverage during transition
- **Code Reviews**: Peer validation of architectural decisions

---

## Conclusion

This architectural refactor will transform Hikma into a well-structured, maintainable agentic platform that properly reflects its AI-powered nature. The new structure supports the four development phases while following Node.js best practices and enabling future growth.

The agent-centric design ensures that AI capabilities are properly orchestrated, while the clear separation of knowledge, workflow, and analytics layers provides the foundation for sophisticated code intelligence features.

**Next Steps**:
1. Review and approve this plan
2. Set up project timeline and milestones
3. Begin Phase 1 implementation
4. Establish regular progress reviews

---

*This document should be updated as the refactoring progresses and new insights are gained.*