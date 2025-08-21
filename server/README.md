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

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- Git
- GitHub CLI (`gh`)
- Jira CLI (`acli`) - optional
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hikma
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the infrastructure**
   ```bash
   docker-compose up -d postgres redis neo4j
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Seed initial data** (optional)
   ```bash
   npm run seed
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

### Production Deployment

1. **Build and deploy with Docker**
   ```bash
   npm run docker:build
   npm run docker:up
   ```

2. **Or use the deployment script**
   ```bash
   npm run deploy
   ```

## 📖 API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3000/docs`
- API Schema: `http://localhost:3000/docs/json`

### Key Endpoints

- `POST /api/v1/query` - Submit a natural language query
- `GET /api/v1/status/{taskId}` - Check query processing status
- `GET /api/v1/projects` - List available projects
- `POST /api/v1/projects/{id}/sync` - Trigger data synchronization
- `GET /api/v1/health` - Health check endpoint

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Core Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Databases
DATABASE_URL="postgresql://user:pass@localhost:5432/hikma"
REDIS_URL="redis://localhost:6379"
NEO4J_URL="bolt://localhost:7687"
PINECONE_API_KEY="your-key"

# AI/ML
OPENAI_API_KEY="your-key"
OPENAI_MODEL="gpt-4-turbo-preview"

# External Services
GITHUB_TOKEN="your-token"
JIRA_URL="https://your-org.atlassian.net"
JIRA_API_TOKEN="your-token"

# Security
JWT_SECRET="your-secret"
```

### Database Configuration

The system uses multiple databases for different purposes:

- **PostgreSQL**: User data, query logs, feedback, structured metadata
- **Redis**: Caching, session storage, queue management
- **Neo4j**: Relationship graphs between code, PRs, tickets, developers
- **Pinecone**: Vector embeddings for semantic search

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run with coverage
npm run test -- --coverage
```

## 📊 Monitoring

Hikma includes comprehensive monitoring capabilities:

- **Health Checks**: `/health` endpoint with dependency status
- **Metrics**: Prometheus-compatible metrics at `/metrics`
- **Logging**: Structured JSON logs with correlation IDs
- **Tracing**: OpenTelemetry-compatible distributed tracing

### Monitoring Stack (Optional)

Enable the monitoring stack with:

```bash
docker-compose --profile monitoring up -d
```

This includes:
- Prometheus (metrics collection): `http://localhost:9090`
- Grafana (dashboards): `http://localhost:3001`

## 🛠️ Development

### Project Structure

```
hikma/
├── src/
│   ├── core/           # Shared types, errors, utilities
│   ├── infrastructure/ # Database clients, external APIs
│   ├── modules/        # Business logic modules
│   ├── monitoring/     # Health checks, metrics
│   └── app.ts         # Application entry point
├── config/            # Configuration files
├── prisma/           # Database schema and migrations
├── tests/            # Test suites
├── deployments/      # Docker and deployment configs
└── tools/            # CLI tools and utilities
```

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes and test**
   ```bash
   npm run dev      # Start development server
   npm run lint     # Check code style
   npm run test     # Run tests
   ```

3. **Build and verify**
   ```bash
   npm run build    # Compile TypeScript
   npm start        # Test production build
   ```

### Adding New Features

1. **Data Connectors**: Add to `src/modules/ingestion/connectors/`
2. **Agent Tools**: Add to `src/modules/knowledge/tools/`
3. **API Endpoints**: Add to `src/modules/interfaces/api/routes/`
4. **Database Models**: Update `prisma/schema.prisma`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: See the `docs/` directory
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

## 🗺️ Roadmap

- [x] Phase 1: Core Knowledge Engine
- [ ] Phase 2: Workflow Integration
- [ ] Phase 3: Predictive Planning
- [ ] Phase 4: Strategic Intelligence
- [ ] Multi-tenant Support
- [ ] Advanced Analytics Dashboard
- [ ] Plugin System for Custom Connectors

