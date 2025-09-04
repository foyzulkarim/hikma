import neo4j, { Driver, Session, auth } from 'neo4j-driver';
import { logger } from '../core/utils/logger';

// Neo4j Configuration
const neo4jConfig = {
  uri: process.env.NEO4J_URL || 'bolt://localhost:7687',
  username: process.env.NEO4J_USERNAME || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password',
  database: process.env.NEO4J_DATABASE || 'neo4j',
  maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_POOL_SIZE || '50', 10),
  connectionAcquisitionTimeout: parseInt(process.env.NEO4J_CONNECTION_TIMEOUT || '60000', 10),
  maxTransactionRetryTime: parseInt(process.env.NEO4J_RETRY_TIME || '30000', 10),
  maxRetries: parseInt(process.env.NEO4J_MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.NEO4J_RETRY_DELAY || '1000', 10),
};

// Create Neo4j driver
export const driver: Driver = neo4j.driver(
  neo4jConfig.uri,
  auth.basic(neo4jConfig.username, neo4jConfig.password),
  {
    maxConnectionPoolSize: neo4jConfig.maxConnectionPoolSize,
    connectionAcquisitionTimeout: neo4jConfig.connectionAcquisitionTimeout,
    maxTransactionRetryTime: neo4jConfig.maxTransactionRetryTime,
    disableLosslessIntegers: true,
  }
);

// Neo4j connection management
export class Neo4jManager {
  private static instance: Neo4jManager;
  private driver: Driver;
  private isConnected = false;

  private constructor() {
    this.driver = driver;
    this.setupEventHandlers();
  }

  public static getInstance(): Neo4jManager {
    if (!Neo4jManager.instance) {
      Neo4jManager.instance = new Neo4jManager();
    }
    return Neo4jManager.instance;
  }

  private setupEventHandlers(): void {
    // Neo4j doesn't have traditional event handlers like Redis
    // We'll implement connection verification in the connect method
  }

  public async connect(): Promise<void> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= neo4jConfig.maxRetries; attempt++) {
      try {
        // Verify connectivity
        const session = this.driver.session({ database: neo4jConfig.database });
        await session.run('RETURN 1');
        await session.close();
        
        this.isConnected = true;
        logger.info({ attempt }, 'Neo4j connected successfully');
        return;
      } catch (error: any) {
        lastError = error;
        logger.warn({ 
          error: error.message, 
          attempt, 
          maxRetries: neo4jConfig.maxRetries 
        }, 'Neo4j connection attempt failed');
        
        if (attempt < neo4jConfig.maxRetries) {
          await this.delay(neo4jConfig.retryDelayMs * attempt);
        }
      }
    }
    
    logger.error({ error: lastError }, 'Failed to connect to Neo4j after all retries');
    throw lastError;
  }

  public async disconnect(): Promise<void> {
    try {
      await this.driver.close();
      this.isConnected = false;
      logger.info('Neo4j disconnected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to disconnect from Neo4j');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const session = this.driver.session({ database: neo4jConfig.database });
      await session.run('RETURN 1');
      await session.close();
      return true;
    } catch (error) {
      logger.error({ error }, 'Neo4j health check failed');
      return false;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public getDriver(): Driver {
    return this.driver;
  }

  public getSession(database?: string): Session {
    return this.driver.session({ 
      database: database || neo4jConfig.database 
    });
  }
}

// Graph database service
export class GraphService {
  private driver: Driver;

  constructor(neo4jDriver: Driver = driver) {
    this.driver = neo4jDriver;
  }

  async executeQuery(
    cypher: string, 
    parameters: Record<string, any> = {},
    database?: string
  ): Promise<any[]> {
    const session = this.driver.session({ database: database || neo4jConfig.database });
    
    try {
      const result = await session.run(cypher, parameters);
      return result.records.map(record => record.toObject());
    } catch (error) {
      logger.error({ error, cypher, parameters }, 'Failed to execute Cypher query');
      throw error;
    } finally {
      await session.close();
    }
  }

  async executeWriteTransaction(
    cypher: string,
    parameters: Record<string, any> = {},
    database?: string
  ): Promise<any[]> {
    const session = this.driver.session({ database: database || neo4jConfig.database });
    
    try {
      const result = await session.executeWrite(async tx => {
        return await tx.run(cypher, parameters);
      });
      return result.records.map(record => record.toObject());
    } catch (error) {
      logger.error({ error, cypher, parameters }, 'Failed to execute write transaction');
      throw error;
    } finally {
      await session.close();
    }
  }

  async executeReadTransaction(
    cypher: string,
    parameters: Record<string, any> = {},
    database?: string
  ): Promise<any[]> {
    const session = this.driver.session({ database: database || neo4jConfig.database });
    
    try {
      const result = await session.executeRead(async tx => {
        return await tx.run(cypher, parameters);
      });
      return result.records.map(record => record.toObject());
    } catch (error) {
      logger.error({ error, cypher, parameters }, 'Failed to execute read transaction');
      throw error;
    } finally {
      await session.close();
    }
  }

  // Common graph operations
  async createNode(
    label: string,
    properties: Record<string, any>,
    database?: string
  ): Promise<any> {
    const cypher = `
      CREATE (n:${label} $properties)
      RETURN n
    `;
    
    const result = await this.executeWriteTransaction(cypher, { properties }, database);
    return result[0]?.n;
  }

  async findNode(
    label: string,
    properties: Record<string, any>,
    database?: string
  ): Promise<any> {
    const whereClause = Object.keys(properties)
      .map(key => `n.${key} = $${key}`)
      .join(' AND ');
    
    const cypher = `
      MATCH (n:${label})
      WHERE ${whereClause}
      RETURN n
      LIMIT 1
    `;
    
    const result = await this.executeReadTransaction(cypher, properties, database);
    return result[0]?.n;
  }

  async createRelationship(
    fromNodeId: string,
    toNodeId: string,
    relationshipType: string,
    properties: Record<string, any> = {},
    database?: string
  ): Promise<any> {
    const cypher = `
      MATCH (from), (to)
      WHERE ID(from) = $fromNodeId AND ID(to) = $toNodeId
      CREATE (from)-[r:${relationshipType} $properties]->(to)
      RETURN r
    `;
    
    const result = await this.executeWriteTransaction(
      cypher, 
      { fromNodeId, toNodeId, properties }, 
      database
    );
    return result[0]?.r;
  }

  async findRelatedNodes(
    nodeId: string,
    relationshipType?: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both',
    database?: string
  ): Promise<any[]> {
    let relationshipPattern = '';
    
    switch (direction) {
      case 'incoming':
        relationshipPattern = relationshipType 
          ? `<-[r:${relationshipType}]-` 
          : '<-[r]-';
        break;
      case 'outgoing':
        relationshipPattern = relationshipType 
          ? `-[r:${relationshipType}]->` 
          : '-[r]->';
        break;
      case 'both':
        relationshipPattern = relationshipType 
          ? `-[r:${relationshipType}]-` 
          : '-[r]-';
        break;
    }
    
    const cypher = `
      MATCH (n)${relationshipPattern}(related)
      WHERE ID(n) = $nodeId
      RETURN related, r
    `;
    
    return await this.executeReadTransaction(cypher, { nodeId }, database);
  }

  async deleteNode(nodeId: string, database?: string): Promise<void> {
    const cypher = `
      MATCH (n)
      WHERE ID(n) = $nodeId
      DETACH DELETE n
    `;
    
    await this.executeWriteTransaction(cypher, { nodeId }, database);
  }

  async getNodeCount(label?: string, database?: string): Promise<number> {
    const cypher = label 
      ? `MATCH (n:${label}) RETURN count(n) as count`
      : 'MATCH (n) RETURN count(n) as count';
    
    const result = await this.executeReadTransaction(cypher, {}, database);
    return result[0]?.count || 0;
  }

  // Chunk-specific query methods
  async findChunksByContent(
    searchText: string,
    limit: number = 10,
    database?: string
  ): Promise<any[]> {
    const cypher = `
      MATCH (c:Chunk)
      WHERE c.content CONTAINS $searchText
      RETURN c, c.similarity
      ORDER BY c.similarity DESC
      LIMIT $limit
    `;
    
    return await this.executeReadTransaction(
      cypher, 
      { searchText, limit }, 
      database
    );
  }

  async findRelatedChunks(
    chunkId: string,
    relationshipTypes: string[] = [],
    maxDepth: number = 2,
    limit: number = 20,
    database?: string
  ): Promise<any[]> {
    const relationshipFilter = relationshipTypes.length > 0 
      ? `[${relationshipTypes.map(type => `'${type}'`).join('|')}]`
      : '';
    
    const cypher = `
      MATCH (start:Chunk {id: $chunkId})
      MATCH path = (start)-[r${relationshipFilter}*1..${maxDepth}]-(related:Chunk)
      WHERE start <> related
      RETURN DISTINCT related, 
             length(path) as distance,
             [rel in relationships(path) | type(rel)] as relationshipPath
      ORDER BY distance ASC, related.similarity DESC
      LIMIT $limit
    `;
    
    return await this.executeReadTransaction(
      cypher, 
      { chunkId, limit }, 
      database
    );
  }

  async findChunksByFunction(
    functionName: string,
    limit: number = 10,
    database?: string
  ): Promise<any[]> {
    const cypher = `
      MATCH (c:Chunk)
      WHERE c.functionName = $functionName OR c.content CONTAINS $functionName
      RETURN c
      ORDER BY c.startLine ASC
      LIMIT $limit
    `;
    
    return await this.executeReadTransaction(
      cypher, 
      { functionName, limit }, 
      database
    );
  }

  async findChunksByFile(
    filePath: string,
    limit: number = 50,
    database?: string
  ): Promise<any[]> {
    const cypher = `
      MATCH (c:Chunk)
      WHERE c.filePath = $filePath
      RETURN c
      ORDER BY c.startLine ASC
      LIMIT $limit
    `;
    
    return await this.executeReadTransaction(
      cypher, 
      { filePath, limit }, 
      database
    );
  }

  async getChunkCallGraph(
    chunkId: string,
    maxDepth: number = 3,
    database?: string
  ): Promise<any[]> {
    const cypher = `
      MATCH (start:Chunk {id: $chunkId})
      MATCH path = (start)-[:CALLS*1..${maxDepth}]->(called:Chunk)
      RETURN path,
             nodes(path) as chunks,
             relationships(path) as calls,
             length(path) as depth
      ORDER BY depth ASC
    `;
    
    return await this.executeReadTransaction(
      cypher, 
      { chunkId }, 
      database
    );
  }

  async getChunkDependencies(
    chunkId: string,
    includeTransitive: boolean = false,
    database?: string
  ): Promise<any[]> {
    const maxDepth = includeTransitive ? 5 : 1;
    const cypher = `
      MATCH (start:Chunk {id: $chunkId})
      MATCH (start)-[r:IMPORTS|CALLS|EXTENDS|IMPLEMENTS*1..${maxDepth}]->(dep:Chunk)
      RETURN DISTINCT dep,
             [rel in r | type(rel)] as dependencyTypes,
             length(r) as distance
      ORDER BY distance ASC, dep.filePath ASC
    `;
    
    return await this.executeReadTransaction(
      cypher, 
      { chunkId }, 
      database
    );
  }

  async findSimilarChunks(
    embedding: number[],
    threshold: number = 0.8,
    limit: number = 10,
    database?: string
  ): Promise<any[]> {
    // Note: This requires vector similarity search capability in Neo4j
    // For now, we'll use a placeholder that can be enhanced with vector indexes
    const cypher = `
      MATCH (c:Chunk)
      WHERE c.embedding IS NOT NULL
      WITH c, 
           gds.similarity.cosine(c.embedding, $embedding) AS similarity
      WHERE similarity >= $threshold
      RETURN c, similarity
      ORDER BY similarity DESC
      LIMIT $limit
    `;
    
    return await this.executeReadTransaction(
      cypher, 
      { embedding, threshold, limit }, 
      database
    );
  }

  async getChunkStatistics(database?: string): Promise<any> {
    const cypher = `
      MATCH (c:Chunk)
      OPTIONAL MATCH (c)-[r]-()
      RETURN {
        totalChunks: count(DISTINCT c),
        totalRelationships: count(r) / 2,
        avgRelationshipsPerChunk: count(r) * 1.0 / count(DISTINCT c),
        fileCount: count(DISTINCT c.filePath),
        functionCount: count(DISTINCT c.functionName),
        relationshipTypes: collect(DISTINCT type(r))
      } as stats
    `;
    
    const result = await this.executeReadTransaction(cypher, {}, database);
    return result[0]?.stats || {};
  }
}

// Export singleton instances
export const neo4jManager = Neo4jManager.getInstance();
export const graphService = new GraphService();

// Graceful shutdown handling
process.on('beforeExit', async () => {
  await neo4jManager.disconnect();
});

process.on('SIGINT', async () => {
  await neo4jManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await neo4jManager.disconnect();
  process.exit(0);
});

