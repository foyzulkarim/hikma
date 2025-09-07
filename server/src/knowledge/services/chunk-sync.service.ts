import { PrismaClient } from '@prisma/client';
import { CodeChunk } from '@/core/types/embeddings';
import { EmbeddingService } from './embedding.service';
import { vectorService } from '@/config/vector-db';
import { logger } from '@/core/utils/logger';

export interface SyncOptions {
  limit?: number;
  offset?: number;
  projectId?: string;
  repositoryId?: string;
  fileId?: string;
  batchSize?: number;
  skipExisting?: boolean;
}

export interface SyncResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ chunkId: string; error: string }>;
  duration: number;
}

/**
 * Service for syncing document chunks from PostgreSQL to Qdrant vector database
 */
export class ChunkSyncService {
  private prisma: PrismaClient;
  private embeddingService: EmbeddingService;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Sync document chunks to Qdrant vector database
   */
  async syncChunksToQdrant(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const {
      limit = 100,
      offset = 0,
      projectId,
      repositoryId,
      fileId,
      batchSize = 10,
      skipExisting = true,
    } = options;

    logger.info(
      {
        limit,
        offset,
        projectId,
        repositoryId,
        fileId,
        batchSize,
        skipExisting,
      },
      'Starting chunk sync to Qdrant'
    );

    const result: SyncResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Build where clause for filtering
      const whereClause: any = {};
      
      if (projectId) {
        whereClause.file = {
          repository: {
            dataSource: {
              projectId: projectId,
            },
          },
        };
      }
      
      if (repositoryId) {
        whereClause.file = {
          repositoryId: repositoryId,
        };
      }
      
      if (fileId) {
        whereClause.fileId = fileId;
      }

      // If skipExisting is true, only sync chunks without vectorId
      if (skipExisting) {
        whereClause.vectorId = null;
      }

      // Fetch chunks from database
      const chunks = await this.prisma.codeChunk.findMany({
        where: whereClause,
        include: {
        file: {
          include: {
            repository: true,
          },
        },
      },
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'asc',
        },
      });

      logger.info(
        { chunksFound: chunks.length },
        'Found chunks to sync'
      );

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await this.processBatch(batch, result);
        
        // Log progress
        logger.debug(
          {
            processed: result.processed,
            successful: result.successful,
            failed: result.failed,
            progress: `${Math.min(i + batchSize, chunks.length)}/${chunks.length}`,
          },
          'Batch processing progress'
        );
      }

      result.duration = Date.now() - startTime;

      logger.info(
        {
          ...result,
          successRate: result.processed > 0 ? (result.successful / result.processed) * 100 : 0,
        },
        'Chunk sync completed'
      );

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          ...result,
        },
        'Chunk sync failed'
      );
      
      throw error;
    }
  }

  /**
   * Process a batch of chunks
   */
  private async processBatch(
    chunks: any[],
    result: SyncResult
  ): Promise<void> {
    // Process chunks sequentially to fail fast on embedding errors
    for (const chunk of chunks) {
      try {
        result.processed++;
        
        // Generate embedding for the chunk
        const embedding = await this.embeddingService.embedChunk(chunk);
        
        // Get project ID from the file relationship
        const projectId = chunk.file?.repository?.id;
        
        // Upsert chunk to Qdrant
        await vectorService.upsertChunk(chunk, embedding, projectId);
        
        // Update the chunk with vectorId (using chunk.id as vectorId)
        await this.prisma.codeChunk.update({
          where: { id: chunk.id },
          data: {
            vectorId: chunk.id,
          },
        });
        
        result.successful++;
        
        logger.debug(
          {
            chunkId: chunk.id,
            fileId: chunk.fileId,
            projectId,
            embeddingSize: embedding.length,
          },
          'Chunk synced successfully'
        );
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        result.errors.push({
          chunkId: chunk.id,
          error: errorMessage,
        });
        
        logger.error(
          {
            chunkId: chunk.id,
            fileId: chunk.fileId,
            error: errorMessage,
          },
          'Failed to sync chunk'
        );
        
        // Fail fast: throw the error to stop processing remaining chunks
        throw error;
      }
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(projectId?: string): Promise<{
    totalChunks: number;
    syncedChunks: number;
    pendingChunks: number;
    syncProgress: number;
  }> {
    const whereClause: any = {};
    
    if (projectId) {
      whereClause.file = {
        repository: {
          projectId: projectId,
        },
      };
    }

    const [totalChunks, syncedChunks] = await Promise.all([
      this.prisma.codeChunk.count({ where: whereClause }),
      this.prisma.codeChunk.count({
        where: {
          ...whereClause,
          vectorId: { not: null },
        },
      }),
    ]);

    const pendingChunks = totalChunks - syncedChunks;
    const syncProgress = totalChunks > 0 ? (syncedChunks / totalChunks) * 100 : 0;

    return {
      totalChunks,
      syncedChunks,
      pendingChunks,
      syncProgress,
    };
  }

  /**
   * Clear all synced data for a project (removes from Qdrant and resets vectorId)
   */
  async clearSyncedData(projectId?: string): Promise<void> {
    try {
      const whereClause: any = {
        vectorId: { not: null },
      };
      
      if (projectId) {
        whereClause.file = {
          repository: {
            projectId: projectId,
          },
        };
      }

      // Get all synced chunks
      const syncedChunks = await this.prisma.codeChunk.findMany({
        where: whereClause,
        select: { id: true, vectorId: true },
      });

      if (syncedChunks.length === 0) {
        logger.info('No synced chunks found to clear');
        return;
      }

      // Delete from Qdrant
      const vectorIds = syncedChunks
        .map((chunk: any) => chunk.vectorId)
        .filter((id: any): id is string => id !== null);
      
      if (vectorIds.length > 0) {
        await vectorService.deleteVectors(vectorIds);
      }

      // Reset vectorId in PostgreSQL
      await this.prisma.codeChunk.updateMany({
        where: whereClause,
        data: {
          vectorId: null,
        },
      });

      logger.info(
        {
          clearedChunks: syncedChunks.length,
          projectId,
        },
        'Synced data cleared successfully'
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          projectId,
        },
        'Failed to clear synced data'
      );
      throw error;
    }
  }
}

// Export singleton instance
export const chunkSyncService = new ChunkSyncService();