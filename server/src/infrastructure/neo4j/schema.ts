import type { Driver } from 'neo4j-driver';

/**
 * Neo4j Schema Initialization
 * Creates indexes and constraints for optimal performance and data integrity
 */
export class Neo4jSchemaManager {
  constructor(private driver: Driver) {}

  /**
   * Initialize the complete Neo4j schema
   * Creates indexes, constraints, and sets up node labels
   */
  async initializeSchema(): Promise<void> {
    const session = this.driver.session();
    
    try {
      // Create indexes for CodeChunk nodes
      await this.createIndexes(session);
      
      // Create constraints for data integrity
      await this.createConstraints(session);
      
      console.log('Neo4j schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Neo4j schema:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create performance indexes based on the new schema
   */
  private async createIndexes(session: any): Promise<void> {
    const indexes = [
      // Primary indexes for CodeChunk nodes
      'CREATE INDEX chunk_id_index IF NOT EXISTS FOR (n:CodeChunk) ON (n.id)',
      'CREATE INDEX chunk_name_index IF NOT EXISTS FOR (n:CodeChunk) ON (n.name)',
      'CREATE INDEX chunk_type_index IF NOT EXISTS FOR (n:CodeChunk) ON (n.type)',
      'CREATE INDEX chunk_purpose_index IF NOT EXISTS FOR (n:CodeChunk) ON (n.purposeCategory)',
      'CREATE INDEX file_path_index IF NOT EXISTS FOR (n:CodeChunk) ON (n.filePath)',
      
      // Composite indexes for common query patterns
      'CREATE INDEX chunk_repo_type IF NOT EXISTS FOR (n:CodeChunk) ON (n.repository, n.type)',
      'CREATE INDEX chunk_type_exported IF NOT EXISTS FOR (n:CodeChunk) ON (n.type, n.isExported)',
      'CREATE INDEX chunk_lang_type IF NOT EXISTS FOR (n:CodeChunk) ON (n.language, n.type)',
      'CREATE INDEX chunk_purpose_async IF NOT EXISTS FOR (n:CodeChunk) ON (n.purposeCategory, n.isAsync)',
      
      // Positional indexes for code location queries
      'CREATE INDEX chunk_start_line IF NOT EXISTS FOR (n:CodeChunk) ON (n.startLine)',
      'CREATE INDEX chunk_end_line IF NOT EXISTS FOR (n:CodeChunk) ON (n.endLine)',
      'CREATE INDEX chunk_line_range IF NOT EXISTS FOR (n:CodeChunk) ON (n.startLine, n.endLine)',
      
      // Repository and language indexes
      'CREATE INDEX chunk_repository IF NOT EXISTS FOR (n:CodeChunk) ON (n.repository)',
      'CREATE INDEX chunk_language IF NOT EXISTS FOR (n:CodeChunk) ON (n.language)',
      
      // Legacy Document and Project indexes (for backward compatibility)
      'CREATE INDEX document_id_index IF NOT EXISTS FOR (n:Document) ON (n.documentId)',
      'CREATE INDEX document_project_index IF NOT EXISTS FOR (n:Document) ON (n.projectId)',
      'CREATE INDEX project_id_index IF NOT EXISTS FOR (n:Project) ON (n.projectId)',
      
      // Full-text search indexes
      'CREATE FULLTEXT INDEX chunk_name_fulltext IF NOT EXISTS FOR (n:CodeChunk) ON EACH [n.name, n.signature]',
      'CREATE FULLTEXT INDEX chunk_content_search IF NOT EXISTS FOR (n:CodeChunk|Document) ON EACH [n.content, n.title]',
    ];

    for (const indexQuery of indexes) {
      try {
        await session.run(indexQuery);
        console.log(`Created index: ${indexQuery}`);
      } catch (error) {
        // Index might already exist, log but don't throw
        console.warn(`Index creation warning: ${error}`);
      }
    }
  }

  /**
   * Create constraints for data integrity
   */
  private async createConstraints(session: any): Promise<void> {
    const constraints = [
      // Unique constraints
      'CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (n:CodeChunk) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (n:Document) REQUIRE n.documentId IS UNIQUE',
      'CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (n:Project) REQUIRE n.projectId IS UNIQUE',
      
      // Node key constraints for composite uniqueness
      'CREATE CONSTRAINT chunk_file_position IF NOT EXISTS FOR (n:CodeChunk) REQUIRE (n.filePath, n.startLine, n.endLine) IS NODE KEY',
      
      // Existence constraints for required properties
      'CREATE CONSTRAINT chunk_required_props IF NOT EXISTS FOR (n:CodeChunk) REQUIRE n.name IS NOT NULL',
      'CREATE CONSTRAINT chunk_type_required IF NOT EXISTS FOR (n:CodeChunk) REQUIRE n.type IS NOT NULL',
      'CREATE CONSTRAINT chunk_filepath_required IF NOT EXISTS FOR (n:CodeChunk) REQUIRE n.filePath IS NOT NULL',
    ];

    for (const constraintQuery of constraints) {
      try {
        await session.run(constraintQuery);
        console.log(`Created constraint: ${constraintQuery}`);
      } catch (error) {
        // Constraint might already exist, log but don't throw
        console.warn(`Constraint creation warning: ${error}`);
      }
    }
  }

  /**
   * Drop all schema elements (for testing/reset)
   */
  async dropSchema(): Promise<void> {
    const session = this.driver.session();
    
    try {
      // Drop all constraints
      const constraintsResult = await session.run('SHOW CONSTRAINTS');
      for (const record of constraintsResult.records) {
        const constraintName = record.get('name');
        await session.run(`DROP CONSTRAINT ${constraintName} IF EXISTS`);
      }
      
      // Drop all indexes
      const indexesResult = await session.run('SHOW INDEXES');
      for (const record of indexesResult.records) {
        const indexName = record.get('name');
        // Skip system indexes
        if (!indexName.startsWith('system_')) {
          await session.run(`DROP INDEX ${indexName} IF EXISTS`);
        }
      }
      
      console.log('Neo4j schema dropped successfully');
    } catch (error) {
      console.error('Failed to drop Neo4j schema:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create a CodeChunk node with proper schema validation
   */
  async createCodeChunkNode(chunkData: {
    id: string;
    name: string;
    type: 'MODULE' | 'CLASS' | 'FUNCTION' | 'METHOD' | 'INTERFACE' | 'TYPE';
    filePath: string;
    startLine: number;
    endLine: number;
    signature?: string;
    purposeCategory: string;
    isAsync: boolean;
    isExported: boolean;
    repository: string;
    language: string;
  }): Promise<void> {
    const session = this.driver.session();
    
    try {
      const query = `
        CREATE (c:CodeChunk {
          id: $id,
          name: $name,
          type: $type,
          filePath: $filePath,
          startLine: $startLine,
          endLine: $endLine,
          signature: $signature,
          purposeCategory: $purposeCategory,
          isAsync: $isAsync,
          isExported: $isExported,
          repository: $repository,
          language: $language,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        RETURN c
      `;
      
      await session.run(query, chunkData);
    } finally {
      await session.close();
    }
  }

  /**
   * Create a relationship between CodeChunk nodes
   */
  async createChunkRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    const session = this.driver.session();
    
    try {
      const query = `
        MATCH (source:CodeChunk {id: $sourceId})
        MATCH (target:CodeChunk {id: $targetId})
        CREATE (source)-[r:${relationshipType} $properties]->(target)
        RETURN r
      `;
      
      await session.run(query, {
        sourceId,
        targetId,
        properties
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get schema information
   */
  async getSchemaInfo(): Promise<{
    indexes: any[];
    constraints: any[];
    nodeLabels: string[];
    relationshipTypes: string[];
  }> {
    const session = this.driver.session();
    
    try {
      const [indexesResult, constraintsResult, labelsResult, relTypesResult] = await Promise.all([
        session.run('SHOW INDEXES'),
        session.run('SHOW CONSTRAINTS'),
        session.run('CALL db.labels()'),
        session.run('CALL db.relationshipTypes()')
      ]);

      return {
        indexes: indexesResult.records.map(r => r.toObject()),
        constraints: constraintsResult.records.map(r => r.toObject()),
        nodeLabels: labelsResult.records.map(r => r.get('label')),
        relationshipTypes: relTypesResult.records.map(r => r.get('relationshipType'))
      };
    } finally {
      await session.close();
    }
  }
}

/**
 * Example usage and relationship creation patterns
 */
export const createRelationshipExamples = {
  // Function call relationship
  createCallRelationship: (callerId: string, calleeId: string, line: number, isAsync: boolean) => ({
    sourceId: callerId,
    targetId: calleeId,
    type: 'CALLS',
    properties: { line, isAsync }
  }),

  // Import relationship
  createImportRelationship: (importerId: string, importedId: string, importType: 'default' | 'named' | 'namespace') => ({
    sourceId: importerId,
    targetId: importedId,
    type: 'IMPORTS',
    properties: { importType }
  }),

  // Similarity relationship
  createSimilarityRelationship: (chunk1Id: string, chunk2Id: string, score: number) => ({
    sourceId: chunk1Id,
    targetId: chunk2Id,
    type: 'SIMILAR_TO',
    properties: { score }
  }),

  // Containment relationship (file contains class, class contains method)
  createContainmentRelationship: (parentId: string, childId: string) => ({
    sourceId: parentId,
    targetId: childId,
    type: 'CONTAINS',
    properties: {}
  })
};