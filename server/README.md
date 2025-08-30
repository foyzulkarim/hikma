# Hikma - Agentic Code Intelligence Platform

Hikma is a comprehensive AI-powered platform that provides intelligent insights into your codebase and development workflow. It combines advanced RAG (Retrieval-Augmented Generation) capabilities with multi-source data integration to deliver context-aware assistance throughout the software development lifecycle.

## 🚀 Features

### Phase 1: Core Knowledge Engine
- **Multi-source Data Ingestion**: Git repositories, GitHub PRs, Jira tickets
- **Intelligent Code Analysis**: AST-based parsing and semantic understanding
- **Hybrid Search**: Vector similarity + keyword search + graph relationships
- **Context-Aware Q&A**: Natural language queries about your codebase

### Phase 2: Active Workflow Integration
- **Automated PR Summaries**: AI-generated pull request analysis
- **Quality Gate Integration**: Intelligent code review assistance
- **ChatOps Support**: Slack/Teams bot integration
- **Real-time Notifications**: Workflow event processing

### Phase 3: Predictive Planning
- **Requirement Analysis**: Clarity and completeness assessment
- **Story Point Prediction**: ML-based effort estimation
- **Related Work Discovery**: Automatic linking of historical context

### Phase 4: Strategic Intelligence
- **Development Velocity Tracking**: Team performance analytics
- **Bottleneck Detection**: Process optimization insights
- **Architectural Health Monitoring**: Code quality trends

## 🏗️ Architecture

Hikma follows a modular monolithic architecture with clear separation of concerns:

```
├── Core Layer (Types, Errors, Utils, Constants)
├── Infrastructure Layer (Databases, External APIs, Queues)
├── Module Layer (Business Logic: Ingestion, Knowledge, Agent, Workflow, Analytics)
├── Interface Layer (API, WebSocket, ChatOps, Webhooks)
└── Monitoring Layer (Health, Metrics, Evaluation, Alerting)
```

### Technology Stack

- **Backend**: Fastify + TypeScript
- **Databases**: PostgreSQL (structured data), Redis (cache), Neo4j (relationships), Pinecone (vectors)
- **AI/ML**: OpenAI API, custom embedding pipeline
- **External Integrations**: GitHub CLI, Jira CLI, Slack API
- **Authentication**: JWT-based
- **Deployment**: Docker + Docker Compose

## 🚦 Getting Started

### Quick Start

```bash
git clone <repository-url>
cd hikma/server
cp .env.example .env
# Edit .env with your OpenAI API key
npm install
docker-compose up -d postgres redis neo4j qdrant
npm run db:generate && npm run db:push
npm run dev
```

The API will be available at `http://localhost:3000`.

### 📚 Detailed Setup

For complete installation instructions, configuration details, and troubleshooting, see:

**👉 [Setup Guide](docs/SETUP_GUIDE.md)** - Complete installation and configuration guide

**Prerequisites:** Node.js 18+, Docker, OpenAI API key  
**Time to setup:** ~10 minutes

## 📖 API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3000/documentation`
- API Schema: `http://localhost:3000/docs/json`

### Key Endpoints

- `POST /api/v1/query` - Submit a natural language query
- `GET /api/v1/status/{taskId}` - Check query processing status
- `GET /api/v1/projects` - List available projects
- `POST /api/v1/projects/{id}/sync` - Trigger data synchronization
- `GET /api/v1/health` - Health check endpoint

## 🔧 Configuration

The system uses multiple databases for different purposes:
- **PostgreSQL**: User data, query logs, feedback, structured metadata
- **Redis**: Caching, session storage, queue management
- **Neo4j**: Relationship graphs between code, PRs, tickets, developers
- **Qdrant**: Vector embeddings for semantic search

For detailed configuration options, environment variables, and database setup instructions, see the **[Setup Guide](docs/SETUP_GUIDE.md)**.

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
```

For detailed testing instructions and examples, see the **[Setup Guide](docs/SETUP_GUIDE.md#-testing-the-system)**.

## 📊 Monitoring

Hikma includes comprehensive monitoring capabilities:
- **Health Checks**: `/health` endpoint with dependency status  
- **Metrics**: Prometheus-compatible metrics at `/metrics`
- **Logging**: Structured JSON logs with correlation IDs
- **Tracing**: OpenTelemetry-compatible distributed tracing

Optional Prometheus + Grafana stack available. See **[Setup Guide](docs/SETUP_GUIDE.md#optional-monitoring-stack)** for details.

## 🛠️ Development

### Project Structure

The codebase follows a modular architecture with clear separation of concerns:

```
src/
├── app/            # Fastify server, routes, middleware
├── domains/        # Domain-specific logic (users, projects)
├── knowledge/      # Knowledge base and ingestion
├── agents/         # AI agents and orchestration
├── workflow/       # Workflow automation
├── analytics/      # Analytics and evaluation
├── infrastructure/ # Databases, external APIs, monitoring
└── shared/         # Shared utilities and decorators
```

### Development Commands

```bash
npm run dev         # Start development server
npm run build       # Build for production  
npm run lint        # Check code style
npm run typecheck   # TypeScript validation
```

For detailed development workflow, database management, and troubleshooting, see the **[Setup Guide](docs/SETUP_GUIDE.md#-development-workflow)**.



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📚 Documentation

- **[Setup Guide](docs/SETUP_GUIDE.md)** - Complete installation and configuration guide
- **[Architecture Overview](docs/ARCHITECTURE_CURRENT_STATE.md)** - System design and components
- **[API Documentation](docs/api/README.md)** - REST API reference and examples
- **[Data Architecture](docs/data/README.md)** - Database schemas and data flow

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: See the `docs/` directory for comprehensive guides
- **Issues**: GitHub Issues for bug reports and feature requests
- **Health Check**: `http://localhost:3000/api/v1/health` for system diagnostics

## 🗺️ Roadmap

- [x] Phase 1: Core Knowledge Engine
- [ ] Phase 2: Workflow Integration
- [ ] Phase 3: Predictive Planning
- [ ] Phase 4: Strategic Intelligence
- [ ] Multi-tenant Support
- [ ] Advanced Analytics Dashboard
- [ ] Plugin System for Custom Connectors

