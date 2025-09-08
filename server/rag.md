# A comprehensive data model that leverages the unique strengths of each database for a high-performance code RAG system.

## Architecture Overview

- **PostgreSQL**: Source of truth, metadata, audit trails, and full-text search
- **Neo4j**: Code dependency graph, call relationships, and impact analysis
- **QDrant**: Vector embeddings with filtered search
- **FastAPI + TypeScript**: Orchestration layer


## TypeScript Service Layer

```typescript
// types/models.ts
export interface CodeChunkComplete {
  // Core data from PostgreSQL
  id: string;
  fileId: string;
  repositoryId: string;
  content: string;
  startLine: number;
  endLine: number;
  nodeType: string;
  nodeName?: string;
  
  // Metadata
  purposeCategory?: string;
  complexityScore?: number;
  semanticTags: string[];
  
  // Graph data from Neo4j
  dependencies?: {
    calls: string[];
    calledBy: string[];
    imports: string[];
    exports: string[];
  };
  
  // Vector data reference
  qdrantPointId?: string;
  embeddings?: {
    code?: number[];
    documentation?: number[];
  };
}

// services/ChunkService.ts
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import neo4j, { Driver } from 'neo4j-driver';
import { QdrantClient } from '@qdrant/js-client-rest';

export class ChunkService {
  constructor(
    private pg: Pool,
    private neo4j: Driver,
    private qdrant: QdrantClient
  ) {}

  async indexNewCode(filePath: string, content: string) {
    // 1. Parse with tree-sitter
    const chunks = await this.parseWithTreeSitter(content);
    
    // 2. Store in PostgreSQL (batch insert)
    const pgChunks = await this.storeInPostgres(chunks);
    
    // 3. Create graph in Neo4j (batch transaction)
    await this.createGraphRelationships(pgChunks);
    
    // 4. Generate embeddings and store in QDrant
    await this.generateAndStoreEmbeddings(pgChunks);
    
    // 5. Update materialized views
    await this.refreshMaterializedViews();
  }

  async hybridSearch(query: string, options: SearchOptions) {
    // Stage 1: Classify query intent
    const queryIntent = await this.classifyQueryIntent(query);
    
    // Stage 2: Vector search with pre-filtering
    const vectorResults = await this.vectorSearch(query, queryIntent);
    
    // Stage 3: Graph expansion for context
    const expandedResults = await this.expandWithGraph(vectorResults);
    
    // Stage 4: Re-rank with multiple signals
    const reranked = await this.rerank(expandedResults, query, queryIntent);
    
    return reranked;
  }

  private async vectorSearch(query: string, intent: QueryIntent) {
    const filters = this.buildQdrantFilters(intent);
    
    // Multi-vector search
    const [codeResults, docResults] = await Promise.all([
      this.qdrant.search('code_embeddings', {
        vector: {
          name: 'code',
          vector: await this.embedQuery(query)
        },
        filter: filters,
        limit: 20,
        with_payload: true
      }),
      this.qdrant.search('code_embeddings', {
        vector: {
          name: 'documentation',
          vector: await this.embedQuery(query)
        },
        filter: filters,
        limit: 10,
        with_payload: true
      })
    ]);
    
    return this.mergeVectorResults(codeResults, docResults);
  }

  private async expandWithGraph(chunks: CodeChunkComplete[]) {
    const session = this.neo4j.session();
    
    try {
      const expandedChunks = new Map<string, CodeChunkComplete>();
      
      for (const chunk of chunks) {
        // Get related nodes
        const result = await session.run(`
          MATCH (c:CodeChunk {id: $id})
          OPTIONAL MATCH (c)-[:CALLS]->(called:CodeChunk)
          OPTIONAL MATCH (caller:CodeChunk)-[:CALLS]->(c)
          OPTIONAL MATCH (c)-[:CONTAINS]->(child:CodeChunk)
          OPTIONAL MATCH (parent:CodeChunk)-[:CONTAINS]->(c)
          RETURN 
            collect(DISTINCT called) as calls,
            collect(DISTINCT caller) as callers,
            collect(DISTINCT child) as children,
            collect(DISTINCT parent) as parents
        `, { id: chunk.id });
        
        // Add to expanded set based on relevance
        // ... expansion logic
      }
      
      return Array.from(expandedChunks.values());
    } finally {
      await session.close();
    }
  }

  private buildQdrantFilters(intent: QueryIntent) {
    const must: any[] = [];
    const should: any[] = [];
    
    // Intent-based filtering
    switch(intent.type) {
      case 'debug':
        must.push({ key: 'has_error_handling', match: { value: true } });
        should.push({ key: 'purpose_category', match: { value: 'error_handling' } });
        break;
      
      case 'implementation':
        must.push({
          key: 'node_type',
          match: { any: ['function', 'method', 'class'] }
        });
        break;
      
      case 'api_usage':
        should.push({ key: 'purpose_category', match: { value: 'api_endpoint' } });
        should.push({ key: 'is_exported', match: { value: true } });
        break;
      
      case 'test_examples':
        must.push({ key: 'purpose_category', match: { value: 'test' } });
        break;
    }
    
    // Add domain filtering if detected
    if (intent.domains?.length) {
      must.push({
        key: 'domain_tags',
        match: { any: intent.domains }
      });
    }
    
    return {
      must: must.length > 0 ? must : undefined,
      should: should.length > 0 ? should : undefined
    };
  }
}

// services/GraphAnalysisService.ts
export class GraphAnalysisService {
  constructor(private neo4j: Driver) {}

  async findImpactRadius(chunkId: string, depth: number = 2) {
    const session = this.neo4j.session();
    
    try {
      const result = await session.run(`
        MATCH (start:CodeChunk {id: $id})
        CALL apoc.path.subgraphAll(start, {
          relationshipFilter: "CALLS|IMPORTS|EXTENDS|IMPLEMENTS",
          maxLevel: $depth
        })
        YIELD nodes, relationships
        RETURN nodes, relationships
      `, { id: chunkId, depth });
      
      return this.formatGraphResult(result);
    } finally {
      await session.close();
    }
  }

  async findSimilarPatterns(chunkId: string) {
    const session = this.neo4j.session();
    
    try {
      // Find chunks with similar structure
      const result = await session.run(`
        MATCH (target:CodeChunk {id: $id})
        MATCH (similar:CodeChunk)
        WHERE similar.id <> target.id
          AND similar.type = target.type
          AND similar.purposeCategory = target.purposeCategory
        WITH target, similar
        MATCH (target)-[r1:CALLS|IMPORTS]->(:CodeChunk)
        WITH target, similar, count(r1) as targetRelCount
        MATCH (similar)-[r2:CALLS|IMPORTS]->(:CodeChunk)
        WITH target, similar, targetRelCount, count(r2) as similarRelCount
        WHERE abs(targetRelCount - similarRelCount) <= 2
        RETURN similar
        LIMIT 10
      `, { id: chunkId });
      
      return result.records.map(r => r.get('similar').properties);
    } finally {
      await session.close();
    }
  }
}
```

## Retrieval Strategy

```typescript
// services/RetrievalOrchestrator.ts
export class RetrievalOrchestrator {
  async retrieve(query: string, context?: QueryContext): Promise<RetrievalResult> {
    // 1. Fast path: Check if it's a simple lookup
    if (this.isSimpleLookup(query)) {
      return this.performDirectLookup(query);
    }
    
    // 2. Parallel search across all systems
    const [
      pgResults,
      vectorResults,
      graphResults
    ] = await Promise.all([
      this.postgresFullTextSearch(query),
      this.qdrantHybridSearch(query),
      this.neo4jPatternSearch(query)
    ]);
    
    // 3. Merge and deduplicate
    const merged = this.mergeResults(pgResults, vectorResults, graphResults);
    
    // 4. Expand context using graph
    const expanded = await this.expandContext(merged);
    
    // 5. Final ranking
    return this.finalRanking(expanded, query);
  }
  
  private async expandContext(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    const expansionRules = [
      // Always include class definition for methods
      { condition: (c) => c.nodeType === 'method', 
        expand: (c) => this.getParentClass(c) },
      
      // Include interface for implementations
      { condition: (c) => c.hasInterface, 
        expand: (c) => this.getInterfaces(c) },
      
      // Include frequently called utilities
      { condition: (c) => c.numCallees > 5, 
        expand: (c) => this.getTopCallees(c, 3) },
      
      // Include test for tested code
      { condition: (c) => c.hasCoverage, 
        expand: (c) => this.getTests(c) }
    ];
    
    // Apply expansion rules
    const expanded = new Set(chunks);
    for (const chunk of chunks) {
      for (const rule of expansionRules) {
        if (rule.condition(chunk)) {
          const additional = await rule.expand(chunk);
          additional.forEach(c => expanded.add(c));
        }
      }
    }
    
    return Array.from(expanded);
  }
}
```

## Key Design Decisions

1. **PostgreSQL as Source of Truth**: All metadata lives here, with rich indexing for complex queries and audit trails.

2. **Neo4j for Relationships**: Perfect for "impact analysis" and finding related code through graph traversal.

3. **QDrant for Semantic Search**: Dual vectors (code + documentation) with extensive metadata filtering.

4. **Materialized Views**: Pre-computed search indexes in PostgreSQL for common queries.

5. **Batch Operations**: All indexing operations are batched for performance.

## Query Flow Example

```typescript
// Example: "How does our authentication middleware handle JWT refresh tokens?"

// 1. Query Classification
{
  type: 'implementation',
  domains: ['authentication', 'security'],
  keywords: ['JWT', 'refresh', 'middleware'],
  lookingFor: ['function', 'method']
}

// 2. QDrant filters generated
{
  must: [
    { key: 'domain_tags', match: { any: ['authentication', 'security'] } },
    { key: 'node_type', match: { any: ['function', 'method'] } }
  ],
  should: [
    { key: 'node_name', match: { text: 'refresh' } }
  ]
}

// 3. Neo4j expansion query
MATCH (auth:CodeChunk)-[:CALLS*1..2]-(jwt:CodeChunk)
WHERE auth.purposeCategory = 'authentication'
  AND jwt.name CONTAINS 'jwt'
RETURN auth, jwt

// 4. PostgreSQL validation
SELECT * FROM code_chunks 
WHERE id = ANY($1::uuid[])
  AND code_content ~* 'refresh.*token|token.*refresh'
```

This architecture gives you:
- **Sub-100ms** simple lookups via PostgreSQL indexes
- **High precision** through metadata filtering in QDrant  
- **Rich context** through Neo4j graph traversal
- **Scalability** through proper indexing and caching

The key is that each database does what it's best at, and the fastAPI layer orchestrates them intelligently based on query intent.
