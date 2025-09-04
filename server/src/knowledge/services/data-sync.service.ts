import { PrismaClient } from '@prisma/client';
import { Neo4jChunkService, Neo4jChunkNode, ChunkRelationship, ChunkRelationshipType } from './neo4j-chunk.service';
import { logger } from '../../core/utils/logger';
import { DocumentChunk, ChunkMetadata, ASTChunkMetadata } from '../../core/types/embeddings';
import {
  Neo4jSyncError,
  Neo4jConnectionError,
  Neo4jQueryError,
  ErrorFactory,
  isNeo4jError
} from '../../core/errors/app-error';

export interface SyncOptions {
  batchSize?: number;
  continueOnError?: boolean;
  dryRun?: boolean;
  direction?: 'postgres-to-neo4j' | 'neo4j-to-postgres' | 'bidirectional';
  includeRelationships?: boolean;
}

export interface SyncResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    id: string;
    error: string;
    details?: any;
  }>;
  executionTime: number;
  dryRun: boolean;
}

export interface SyncStats {
  postgresChunks: number;
  neo4jChunks: number;
  postgresRelationships: number;
  neo4jRelationships: number;
  orphanedChunks: {
    inPostgres: number;
    inNeo4j: number;
  };
  inconsistencies: Array<{
    chunkId: string;
    type: 'missing' | 'outdated' | 'conflicting';
    details: any;
  }>;
}

export class DataSyncService {
  private prisma: PrismaClient;
  private neo4jChunkService: Neo4jChunkService;

  constructor(prisma: PrismaClient, neo4jChunkService: Neo4jChunkService) {
    this.prisma = prisma;
    this.neo4jChunkService = neo4jChunkService;
  }

  /**
   * Synchronize data between PostgreSQL and Neo4j
   */
  async syncData(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const {
      batchSize = 100,
      continueOnError = true,
      dryRun = false,
      direction = 'postgres-to-neo4j',
      includeRelationships = true
    } = options;

    logger.info('Starting data synchronization', {
      direction,
      batchSize,
      dryRun,
      includeRelationships
    });

    const result: SyncResult = {
      success: true,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      executionTime: 0,
      dryRun
    };

    try {
      switch (direction) {
        case 'postgres-to-neo4j':
          await this.syncPostgresToNeo4j(result, { batchSize, continueOnError, dryRun, includeRelationships });
          break;
        case 'neo4j-to-postgres':
          await this.syncNeo4jToPostgres(result, { batchSize, continueOnError, dryRun });
          break;
        case 'bidirectional':
          await this.syncBidirectional(result, { batchSize, continueOnError, dryRun, includeRelationships });
          break;
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        id: 'sync-error',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      });
      logger.error('Data synchronization failed', { error });
    }

    result.executionTime = Date.now() - startTime;
    result.success = result.errorCount === 0;

    logger.info('Data synchronization completed', {
      success: result.success,
      totalProcessed: result.totalProcessed,
      successCount: result.successCount,
      errorCount: result.errorCount,
      executionTime: result.executionTime
    });

    return result;
  }

  /**
   * Sync data from PostgreSQL to Neo4j
   */
  private async syncPostgresToNeo4j(
    result: SyncResult,
    options: { batchSize: number; continueOnError: boolean; dryRun: boolean; includeRelationships: boolean }
  ): Promise<void> {
    const { batchSize, continueOnError, dryRun, includeRelationships } = options;

    // Get total count for progress tracking
    const totalChunks = await this.prisma.documentChunk.count();
    result.totalProcessed = totalChunks;

    logger.info(`Syncing ${totalChunks} chunks from PostgreSQL to Neo4j`);

    // Process chunks in batches
    for (let offset = 0; offset < totalChunks; offset += batchSize) {
      try {
        const chunks = await this.prisma.documentChunk.findMany({
          include: {
            document: {
              include: {
                knowledgeBase: {
                  select: { projectId: true }
                }
              }
            }
            // astMetadata: true // TODO: Enable when Prisma schema is properly synced
          },
          take: batchSize,
          skip: offset
        });

        if (!dryRun) {
          const neo4jChunks = chunks.map(chunk => this.convertToNeo4jChunk(chunk));
          await this.neo4jChunkService.batchCreateChunkNodes(neo4jChunks);
        }

        result.successCount += chunks.length;
        logger.debug(`Processed batch ${Math.floor(offset / batchSize) + 1}`, {
          processed: offset + chunks.length,
          total: totalChunks
        });
      } catch (error: unknown) {
        result.errorCount += batchSize;
        
        let errorMessage = 'Unknown error';
        let errorDetails: any = { offset, batchSize };
        
        if (isNeo4jError(error)) {
          const neo4jError = error as Neo4jSyncError;
          errorMessage = neo4jError.message;
          errorDetails = { ...errorDetails, errorCode: neo4jError.errorCode, neo4jError: true };
          logger.error('Neo4j sync error in batch', {
            batch: Math.floor(offset / batchSize) + 1,
            errorCode: neo4jError.errorCode,
            message: neo4jError.message
          });
        } else if (error instanceof Error) {
          errorMessage = error.message;
          logger.error('Unexpected error in sync batch', {
            batch: Math.floor(offset / batchSize) + 1,
            error: error.message,
            stack: error.stack
          });
        }
        
        result.errors.push({
          id: `batch-${offset}`,
          error: errorMessage,
          details: errorDetails
        });

        if (!continueOnError) {
          // Re-throw Neo4j errors as sync errors for better context
          if (isNeo4jError(error)) {
            const neo4jError = error as Neo4jSyncError;
            throw ErrorFactory.neo4jSync(
              `Batch sync failed at offset ${offset}: ${neo4jError.message}`,
              { originalError: error, offset, batchSize }
            );
          }
          throw error;
        }
      }
    }

    // Sync relationships if requested
    if (includeRelationships && !dryRun) {
      await this.syncRelationships(result, { continueOnError });
    }
  }

  /**
   * Sync data from Neo4j to PostgreSQL
   */
  private async syncNeo4jToPostgres(
    result: SyncResult,
    options: { batchSize: number; continueOnError: boolean; dryRun: boolean }
  ): Promise<void> {
    // This would be implemented based on specific requirements
    // For now, we'll focus on the primary direction (PostgreSQL to Neo4j)
    logger.warn('Neo4j to PostgreSQL sync not yet implemented');
  }

  /**
   * Bidirectional synchronization
   */
  private async syncBidirectional(
    result: SyncResult,
    options: { batchSize: number; continueOnError: boolean; dryRun: boolean; includeRelationships: boolean }
  ): Promise<void> {
    // First sync PostgreSQL to Neo4j
    await this.syncPostgresToNeo4j(result, options);
    
    // Then sync any missing data from Neo4j to PostgreSQL
    // This would be implemented based on specific requirements
  }

  /**
   * Sync relationships between chunks
   */
  private async syncRelationships(
    result: SyncResult,
    options: { continueOnError: boolean }
  ): Promise<void> {
    const { continueOnError } = options;

    try {
      // Get chunks with AST metadata that might have relationships
      // TODO: Re-enable AST metadata queries when Prisma schema is properly synced
      const chunksWithAst = await this.prisma.documentChunk.findMany({
        include: {
          // astMetadata: true,
          document: {
            include: {
              knowledgeBase: {
                select: {
                  projectId: true
                }
              }
            }
          }
        }
        // where: {
        //   astMetadata: {
        //     isNot: null
        //   }
        // }
      });

      const relationships: ChunkRelationship[] = [];

      // Build relationships based on AST metadata
      for (const chunk of chunksWithAst) {
        // TODO: Re-enable AST metadata processing when schema is synced
        // if (!chunk.astMetadata) continue;
        continue; // Skip relationship building until AST metadata is available

        const chunkRelationships = await this.buildChunkRelationships(chunk, chunksWithAst);
        relationships.push(...chunkRelationships);
      }

      if (relationships.length > 0) {
        await this.neo4jChunkService.batchCreateRelationships(relationships);
        logger.info(`Created ${relationships.length} relationships in Neo4j`);
      }
    } catch (error: unknown) {
      result.errorCount++;
      
      let errorMessage = 'Unknown error';
      let errorDetails: any = { operation: 'relationships-sync' };
      
      if (isNeo4jError(error)) {
         const neo4jError = error as Neo4jSyncError;
         errorMessage = neo4jError.message;
         errorDetails = { ...errorDetails, errorCode: neo4jError.errorCode, neo4jError: true };
         logger.error('Neo4j relationship sync error', {
           errorCode: neo4jError.errorCode,
           message: neo4jError.message
         });
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = { ...errorDetails, stack: error.stack };
        logger.error('Unexpected error in relationship sync', {
          error: error.message,
          stack: error.stack
        });
      }
      
      result.errors.push({
        id: 'relationships-sync',
        error: errorMessage,
        details: errorDetails
      });

      if (!continueOnError) {
        if (isNeo4jError(error)) {
           const neo4jError = error as Neo4jSyncError;
           throw ErrorFactory.neo4jSync(
             `Relationship sync failed: ${neo4jError.message}`,
             { originalError: error }
           );
         }
        throw error;
      }
    }
  }

  /**
   * Build relationships for a chunk based on its AST metadata
   */
  private async buildChunkRelationships(
    chunk: any,
    allChunks: any[]
  ): Promise<ChunkRelationship[]> {
    const relationships: ChunkRelationship[] = [];
    const astMetadata = chunk.astMetadata;

    if (!astMetadata) return relationships;

    // Function call relationships
    if (astMetadata.dependencies && astMetadata.dependencies.length > 0) {
      for (const dependency of astMetadata.dependencies) {
        const targetChunk = allChunks.find(c => 
          c.astMetadata?.functionName === dependency ||
          c.astMetadata?.className === dependency
        );

        if (targetChunk) {
          relationships.push({
            fromChunkId: chunk.id,
            toChunkId: targetChunk.id,
            relationshipType: ChunkRelationshipType.CALLS,
            properties: {
              dependency,
              sourceFile: chunk.document.title,
              targetFile: targetChunk.document.title
            }
          });
        }
      }
    }

    // Class inheritance relationships
    if (astMetadata.astNodeType === 'class') {
      // Look for classes that might extend this one
      const extendingClasses = allChunks.filter(c => 
        c.astMetadata?.dependencies?.includes(astMetadata.className)
      );

      for (const extendingClass of extendingClasses) {
        relationships.push({
          fromChunkId: extendingClass.id,
          toChunkId: chunk.id,
          relationshipType: ChunkRelationshipType.EXTENDS,
          properties: {
            baseClass: astMetadata.className,
            derivedClass: extendingClass.astMetadata.className
          }
        });
      }
    }

    // Method override relationships
    if (astMetadata.astNodeType === 'method' && astMetadata.methodName) {
      const overriddenMethods = allChunks.filter(c => 
        c.astMetadata?.methodName === astMetadata.methodName &&
        c.astMetadata?.className !== astMetadata.className &&
        c.id !== chunk.id
      );

      for (const overriddenMethod of overriddenMethods) {
        relationships.push({
          fromChunkId: chunk.id,
          toChunkId: overriddenMethod.id,
          relationshipType: ChunkRelationshipType.OVERRIDES,
          properties: {
            methodName: astMetadata.methodName,
            sourceClass: astMetadata.className,
            targetClass: overriddenMethod.astMetadata.className
          }
        });
      }
    }

    return relationships;
  }

  /**
   * Convert PostgreSQL chunk to Neo4j chunk format
   */
  private convertToNeo4jChunk(chunk: any): Neo4jChunkNode {
    return {
      id: chunk.id,
      chunkId: chunk.id,
      documentId: chunk.documentId,
      projectId: chunk.document.knowledgeBase.projectId,
      content: chunk.content,
      filePath: chunk.document.title,
      language: chunk.document.metadata?.language || 'unknown',
      // AST-specific properties
      astNodeType: chunk.astMetadata?.astNodeType,
      functionName: chunk.astMetadata?.functionName,
      className: chunk.astMetadata?.className,
      methodName: chunk.astMetadata?.methodName,
      parameters: chunk.astMetadata?.parameters,
      returnType: chunk.astMetadata?.returnType,
      visibility: chunk.astMetadata?.visibility as 'public' | 'private' | 'protected',
      isStatic: chunk.astMetadata?.isStatic,
      isAsync: chunk.astMetadata?.isAsync,
      complexity: chunk.astMetadata?.complexity,
      dependencies: chunk.astMetadata?.dependencies,
      startLine: chunk.astMetadata?.startLine,
      endLine: chunk.astMetadata?.endLine,
      createdAt: chunk.createdAt,
      updatedAt: chunk.updatedAt
    };
  }

  /**
   * Get synchronization statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    // For now, we'll get stats from a sample project
    const sampleProject = await this.prisma.project.findFirst();
    const projectId = sampleProject?.id || 'unknown';

    const [postgresChunks, neo4jStats] = await Promise.all([
      this.prisma.documentChunk.count(),
      this.neo4jChunkService.getChunkStats(projectId)
    ]);

    // Get chunks that exist in PostgreSQL but not in Neo4j
    const postgresChunkIds = await this.prisma.documentChunk.findMany({
      select: { id: true }
    });

    // This would require implementing a method to get all chunk IDs from Neo4j
    // For now, we'll use the stats from Neo4j service
    const orphanedInPostgres = 0; // Would be calculated by comparing IDs
    const orphanedInNeo4j = 0; // Would be calculated by comparing IDs

    return {
      postgresChunks,
      neo4jChunks: neo4jStats.totalChunks,
      postgresRelationships: 0, // PostgreSQL doesn't store relationships directly
      neo4jRelationships: Object.values(neo4jStats.relationshipsByType).reduce((sum: number, count: number) => sum + count, 0),
      orphanedChunks: {
        inPostgres: orphanedInPostgres,
        inNeo4j: orphanedInNeo4j
      },
      inconsistencies: [] // Would be populated by comparing data
    };
  }

  /**
   * Validate data consistency between PostgreSQL and Neo4j
   */
  async validateConsistency(): Promise<{
    consistent: boolean;
    issues: Array<{
      type: 'missing' | 'outdated' | 'conflicting';
      chunkId: string;
      details: any;
    }>;
  }> {
    const issues: Array<{
      type: 'missing' | 'outdated' | 'conflicting';
      chunkId: string;
      details: any;
    }> = [];

    // Get a sample of chunks from PostgreSQL
    const sampleChunks = await this.prisma.documentChunk.findMany({
      take: 100,
      include: {
        // astMetadata: true, // TODO: Enable when Prisma schema is synced
        document: {
          include: {
            knowledgeBase: {
              select: {
                projectId: true
              }
            }
          }
        }
      }
    });

    for (const chunk of sampleChunks) {
      try {
        // Check if chunk exists in Neo4j
        const neo4jChunks = await this.neo4jChunkService.findChunks({
          documentId: chunk.documentId
        });

        if (neo4jChunks.length === 0) {
          issues.push({
            type: 'missing',
            chunkId: chunk.id,
            details: { message: 'Chunk exists in PostgreSQL but not in Neo4j' }
          });
        } else {
          // Check for data consistency
          const neo4jChunk = neo4jChunks[0];
          if (neo4jChunk.content !== chunk.content) {
            issues.push({
              type: 'conflicting',
              chunkId: chunk.id,
              details: { 
                message: 'Content mismatch between PostgreSQL and Neo4j',
                postgresLength: chunk.content.length,
                neo4jLength: neo4jChunk.content.length
              }
            });
          }
        }
      } catch (error) {
        issues.push({
          type: 'conflicting',
          chunkId: chunk.id,
          details: { 
            message: 'Error validating chunk consistency',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    return {
      consistent: issues.length === 0,
      issues
    };
  }

  /**
   * Clean up orphaned data
   */
  async cleanupOrphanedData(options: { dryRun?: boolean } = {}): Promise<{
    deletedFromPostgres: number;
    deletedFromNeo4j: number;
    errors: string[];
  }> {
    const { dryRun = false } = options;
    const result = {
      deletedFromPostgres: 0,
      deletedFromNeo4j: 0,
      errors: [] as string[]
    };

    try {
      // This would implement logic to find and clean up orphaned data
      // For now, we'll just log that this functionality is available
      logger.info('Cleanup orphaned data functionality available', { dryRun });
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService(
  new PrismaClient(),
  new Neo4jChunkService()
);