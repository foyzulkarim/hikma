import { GraphService } from '../../config/neo4j';
import { ASTChunkMetadata, ASTNodeType } from '../../core/types/embeddings';
import { logger } from '../../core/utils/logger';
import {
  Neo4jConnectionError,
  Neo4jQueryError,
  Neo4jTransactionError,
  Neo4jConstraintError,
  ErrorFactory
} from '../../core/errors/app-error';

export interface Neo4jChunkNode {
  id: string;
  chunkId: string;
  documentId: string;
  projectId: string;
  content: string;
  filePath: string;
  language?: string;
  astNodeType?: ASTNodeType;
  functionName?: string;
  className?: string;
  methodName?: string;
  parameters?: string[];
  returnType?: string;
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAsync?: boolean;
  complexity?: number;
  dependencies?: string[];
  startLine?: number;
  endLine?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkRelationship {
  fromChunkId: string;
  toChunkId: string;
  relationshipType: ChunkRelationshipType;
  properties?: Record<string, any>;
}

export enum ChunkRelationshipType {
  CALLS = 'CALLS',
  IMPORTS = 'IMPORTS',
  DEFINES = 'DEFINES',
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS',
  USES = 'USES',
  CONTAINS = 'CONTAINS',
  REFERENCES = 'REFERENCES',
  DEPENDS_ON = 'DEPENDS_ON',
  OVERRIDES = 'OVERRIDES',
  INHERITS_FROM = 'INHERITS_FROM'
}

export interface BatchChunkOperation {
  chunks: Neo4jChunkNode[];
  relationships?: ChunkRelationship[];
}

export interface ChunkQueryOptions {
  projectId?: string;
  documentId?: string;
  filePath?: string;
  astNodeType?: ASTNodeType;
  functionName?: string;
  className?: string;
  limit?: number;
  offset?: number;
}

export class Neo4jChunkService {
  private graphService: GraphService;

  constructor(graphService?: GraphService) {
    this.graphService = graphService || new GraphService();
  }

  /**
   * Create a single chunk node in Neo4j
   */
  async createChunkNode(chunk: Neo4jChunkNode): Promise<string> {
    try {
      const cypher = `
        CREATE (c:Chunk {
          id: $id,
          chunkId: $chunkId,
          documentId: $documentId,
          projectId: $projectId,
          content: $content,
          filePath: $filePath,
          language: $language,
          astNodeType: $astNodeType,
          functionName: $functionName,
          className: $className,
          methodName: $methodName,
          parameters: $parameters,
          returnType: $returnType,
          visibility: $visibility,
          isStatic: $isStatic,
          isAsync: $isAsync,
          complexity: $complexity,
          dependencies: $dependencies,
          startLine: $startLine,
          endLine: $endLine,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
        RETURN c.id as nodeId
      `;

      const result = await this.graphService.executeWriteTransaction(cypher, {
        id: chunk.id,
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        projectId: chunk.projectId,
        content: chunk.content,
        filePath: chunk.filePath,
        language: chunk.language,
        astNodeType: chunk.astNodeType,
        functionName: chunk.functionName,
        className: chunk.className,
        methodName: chunk.methodName,
        parameters: chunk.parameters || [],
        returnType: chunk.returnType,
        visibility: chunk.visibility,
        isStatic: chunk.isStatic || false,
        isAsync: chunk.isAsync || false,
        complexity: chunk.complexity,
        dependencies: chunk.dependencies || [],
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        createdAt: chunk.createdAt.toISOString(),
        updatedAt: chunk.updatedAt.toISOString()
      });

      const nodeId = result[0]?.nodeId;
      if (!nodeId) {
        throw ErrorFactory.neo4jQuery(
          'Failed to create chunk node - no node ID returned',
          { chunkId: chunk.chunkId, filePath: chunk.filePath }
        );
      }

      logger.debug('Created chunk node in Neo4j', {
        nodeId,
        chunkId: chunk.chunkId,
        astNodeType: chunk.astNodeType,
        filePath: chunk.filePath
      });

      return nodeId;
    } catch (error) {
      logger.error('Error creating chunk node in Neo4j', {
        error,
        chunkId: chunk.chunkId,
        filePath: chunk.filePath
      });
      
      // Re-throw as appropriate Neo4j error
      if (error instanceof Neo4jConnectionError || 
          error instanceof Neo4jQueryError || 
          error instanceof Neo4jTransactionError ||
          error instanceof Neo4jConstraintError) {
        throw error;
      }
      
      // Handle specific Neo4j driver errors
      if (error && typeof error === 'object' && 'code' in error) {
        const neo4jError = error as { code: string; message: string };
        
        if (neo4jError.code?.startsWith('Neo.ClientError.Schema')) {
          throw ErrorFactory.neo4jConstraint(
            `Constraint violation: ${neo4jError.message}`,
            { originalError: error, chunkId: chunk.chunkId }
          );
        }
        
        if (neo4jError.code?.startsWith('Neo.TransientError')) {
          throw ErrorFactory.neo4jConnection(
            `Connection error: ${neo4jError.message}`,
            { originalError: error, chunkId: chunk.chunkId }
          );
        }
      }
      
      // Default to query error for unknown Neo4j errors
      throw ErrorFactory.neo4jQuery(
        `Failed to create chunk node: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error, chunkId: chunk.chunkId, filePath: chunk.filePath }
      );
    }
  }

  /**
   * Create multiple chunk nodes in a batch operation
   */
  async batchCreateChunkNodes(chunks: Neo4jChunkNode[]): Promise<string[]> {
    if (chunks.length === 0) {
      return [];
    }

    try {
      const cypher = `
        UNWIND $chunks as chunkData
        CREATE (c:Chunk {
          id: chunkData.id,
          chunkId: chunkData.chunkId,
          documentId: chunkData.documentId,
          projectId: chunkData.projectId,
          content: chunkData.content,
          filePath: chunkData.filePath,
          language: chunkData.language,
          astNodeType: chunkData.astNodeType,
          functionName: chunkData.functionName,
          className: chunkData.className,
          methodName: chunkData.methodName,
          parameters: chunkData.parameters,
          returnType: chunkData.returnType,
          visibility: chunkData.visibility,
          isStatic: chunkData.isStatic,
          isAsync: chunkData.isAsync,
          complexity: chunkData.complexity,
          dependencies: chunkData.dependencies,
          startLine: chunkData.startLine,
          endLine: chunkData.endLine,
          createdAt: chunkData.createdAt,
          updatedAt: chunkData.updatedAt
        })
        RETURN c.id as nodeId
      `;

      const chunkData = chunks.map(chunk => ({
        id: chunk.id,
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        projectId: chunk.projectId,
        content: chunk.content,
        filePath: chunk.filePath,
        language: chunk.language,
        astNodeType: chunk.astNodeType,
        functionName: chunk.functionName,
        className: chunk.className,
        methodName: chunk.methodName,
        parameters: chunk.parameters || [],
        returnType: chunk.returnType,
        visibility: chunk.visibility,
        isStatic: chunk.isStatic || false,
        isAsync: chunk.isAsync || false,
        complexity: chunk.complexity,
        dependencies: chunk.dependencies || [],
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        createdAt: chunk.createdAt.toISOString(),
        updatedAt: chunk.updatedAt.toISOString()
      }));

      const result = await this.graphService.executeWriteTransaction(cypher, {
        chunks: chunkData
      });

      const nodeIds = result.map(record => record.nodeId);

      logger.info('Batch created chunk nodes in Neo4j', {
        count: nodeIds.length,
        projectId: chunks[0]?.projectId,
        filePath: chunks[0]?.filePath
      });

      return nodeIds;
    } catch (error) {
      logger.error('Error batch creating chunk nodes in Neo4j', {
        error,
        count: chunks.length,
        projectId: chunks[0]?.projectId
      });
      throw error;
    }
  }

  /**
   * Create a relationship between two chunk nodes
   */
  async createChunkRelationship(relationship: ChunkRelationship): Promise<void> {
    try {
      const cypher = `
        MATCH (from:Chunk {chunkId: $fromChunkId})
        MATCH (to:Chunk {chunkId: $toChunkId})
        CREATE (from)-[r:${relationship.relationshipType} $properties]->(to)
        RETURN r
      `;

      await this.graphService.executeWriteTransaction(cypher, {
        fromChunkId: relationship.fromChunkId,
        toChunkId: relationship.toChunkId,
        properties: relationship.properties || {}
      });

      logger.debug('Created chunk relationship in Neo4j', {
        from: relationship.fromChunkId,
        to: relationship.toChunkId,
        type: relationship.relationshipType
      });
    } catch (error) {
      logger.error('Error creating chunk relationship in Neo4j', {
        error,
        relationship
      });
      throw error;
    }
  }

  /**
   * Create multiple relationships in a batch operation
   */
  async batchCreateRelationships(relationships: ChunkRelationship[]): Promise<void> {
    if (relationships.length === 0) {
      return;
    }

    try {
      // Group relationships by type for efficient batch processing
      const relationshipsByType = relationships.reduce((acc, rel) => {
        if (!acc[rel.relationshipType]) {
          acc[rel.relationshipType] = [];
        }
        acc[rel.relationshipType].push(rel);
        return acc;
      }, {} as Record<ChunkRelationshipType, ChunkRelationship[]>);

      for (const [relType, rels] of Object.entries(relationshipsByType)) {
        const cypher = `
          UNWIND $relationships as relData
          MATCH (from:Chunk {chunkId: relData.fromChunkId})
          MATCH (to:Chunk {chunkId: relData.toChunkId})
          CREATE (from)-[r:${relType} relData.properties]->(to)
          RETURN count(r) as created
        `;

        const relData = rels.map(rel => ({
          fromChunkId: rel.fromChunkId,
          toChunkId: rel.toChunkId,
          properties: rel.properties || {}
        }));

        await this.graphService.executeWriteTransaction(cypher, {
          relationships: relData
        });
      }

      logger.info('Batch created chunk relationships in Neo4j', {
        count: relationships.length,
        types: Object.keys(relationshipsByType)
      });
    } catch (error) {
      logger.error('Error batch creating chunk relationships in Neo4j', {
        error,
        count: relationships.length
      });
      throw error;
    }
  }

  /**
   * Find chunk nodes by various criteria
   */
  async findChunks(options: ChunkQueryOptions): Promise<Neo4jChunkNode[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const parameters: Record<string, any> = {};

      if (options.projectId) {
        whereClause += ' AND c.projectId = $projectId';
        parameters.projectId = options.projectId;
      }

      if (options.documentId) {
        whereClause += ' AND c.documentId = $documentId';
        parameters.documentId = options.documentId;
      }

      if (options.filePath) {
        whereClause += ' AND c.filePath = $filePath';
        parameters.filePath = options.filePath;
      }

      if (options.astNodeType) {
        whereClause += ' AND c.astNodeType = $astNodeType';
        parameters.astNodeType = options.astNodeType;
      }

      if (options.functionName) {
        whereClause += ' AND c.functionName = $functionName';
        parameters.functionName = options.functionName;
      }

      if (options.className) {
        whereClause += ' AND c.className = $className';
        parameters.className = options.className;
      }

      const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
      const skipClause = options.offset ? `SKIP ${options.offset}` : '';

      const cypher = `
        MATCH (c:Chunk)
        ${whereClause}
        RETURN c
        ${skipClause}
        ${limitClause}
      `;

      const result = await this.graphService.executeReadTransaction(cypher, parameters);

      return result.map(record => {
        const chunk = record.c.properties;
        return {
          ...chunk,
          createdAt: new Date(chunk.createdAt),
          updatedAt: new Date(chunk.updatedAt),
          parameters: chunk.parameters || [],
          dependencies: chunk.dependencies || []
        } as Neo4jChunkNode;
      });
    } catch (error) {
      logger.error('Error finding chunks in Neo4j', { error, options });
      throw error;
    }
  }

  /**
   * Find related chunks through relationships
   */
  async findRelatedChunks(
    chunkId: string,
    relationshipType?: ChunkRelationshipType,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<Neo4jChunkNode[]> {
    try {
      let relationshipPattern = '';
      const relTypeFilter = relationshipType ? `:${relationshipType}` : '';

      switch (direction) {
        case 'incoming':
          relationshipPattern = `<-[r${relTypeFilter}]-(related:Chunk)`;
          break;
        case 'outgoing':
          relationshipPattern = `-[r${relTypeFilter}]->(related:Chunk)`;
          break;
        case 'both':
          relationshipPattern = `-[r${relTypeFilter}]-(related:Chunk)`;
          break;
      }

      const cypher = `
        MATCH (c:Chunk {chunkId: $chunkId})${relationshipPattern}
        RETURN related
      `;

      const result = await this.graphService.executeReadTransaction(cypher, {
        chunkId
      });

      return result.map(record => {
        const chunk = record.related.properties;
        return {
          ...chunk,
          createdAt: new Date(chunk.createdAt),
          updatedAt: new Date(chunk.updatedAt),
          parameters: chunk.parameters || [],
          dependencies: chunk.dependencies || []
        } as Neo4jChunkNode;
      });
    } catch (error) {
      logger.error('Error finding related chunks in Neo4j', {
        error,
        chunkId,
        relationshipType,
        direction
      });
      throw error;
    }
  }

  /**
   * Delete a chunk node and all its relationships
   */
  async deleteChunkNode(chunkId: string): Promise<void> {
    try {
      const cypher = `
        MATCH (c:Chunk {chunkId: $chunkId})
        DETACH DELETE c
      `;

      await this.graphService.executeWriteTransaction(cypher, { chunkId });

      logger.debug('Deleted chunk node from Neo4j', { chunkId });
    } catch (error) {
      logger.error('Error deleting chunk node from Neo4j', {
        error,
        chunkId
      });
      throw error;
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocumentChunks(documentId: string): Promise<void> {
    try {
      const cypher = `
        MATCH (c:Chunk {documentId: $documentId})
        DETACH DELETE c
      `;

      await this.graphService.executeWriteTransaction(cypher, { documentId });

      logger.info('Deleted document chunks from Neo4j', { documentId });
    } catch (error) {
      logger.error('Error deleting document chunks from Neo4j', {
        error,
        documentId
      });
      throw error;
    }
  }

  /**
   * Get chunk statistics for a project
   */
  async getChunkStats(projectId: string): Promise<{
    totalChunks: number;
    chunksByType: Record<string, number>;
    totalRelationships: number;
    relationshipsByType: Record<string, number>;
  }> {
    try {
      const chunkStatsQuery = `
        MATCH (c:Chunk {projectId: $projectId})
        RETURN count(c) as totalChunks, c.astNodeType as nodeType
      `;

      const relationshipStatsQuery = `
        MATCH (c:Chunk {projectId: $projectId})-[r]-()
        RETURN count(r) as totalRelationships, type(r) as relType
      `;

      const [chunkResults, relResults] = await Promise.all([
        this.graphService.executeReadTransaction(chunkStatsQuery, { projectId }),
        this.graphService.executeReadTransaction(relationshipStatsQuery, { projectId })
      ]);

      const chunksByType = chunkResults.reduce((acc, record) => {
        const nodeType = record.nodeType || 'unknown';
        acc[nodeType] = (acc[nodeType] || 0) + record.totalChunks;
        return acc;
      }, {} as Record<string, number>);

      const relationshipsByType = relResults.reduce((acc, record) => {
        const relType = record.relType || 'unknown';
        acc[relType] = (acc[relType] || 0) + record.totalRelationships;
        return acc;
      }, {} as Record<string, number>);

      let totalChunks = 0;
      for (const count of Object.values(chunksByType)) {
        totalChunks += count as number;
      }

      let totalRelationships = 0;
      for (const count of Object.values(relationshipsByType)) {
        totalRelationships += count as number;
      }

      return {
        totalChunks,
        chunksByType,
        totalRelationships,
        relationshipsByType
      };
    } catch (error) {
      logger.error('Error getting chunk stats from Neo4j', {
        error,
        projectId
      });
      throw error;
    }
  }
}

// Export singleton instance
export const neo4jChunkService = new Neo4jChunkService();