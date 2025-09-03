/**
 * Direct Project Sync Script - Bypasses API layer for debugging
 * 
 * This script directly calls the ProjectSyncService.syncProject method
 * to test AST parsing integration without authentication/authorization.
 * 
 * Usage:
 *   npx tsx tests/debug/sync-direct.ts                           # Use default values
 *   npx tsx tests/debug/sync-direct.ts your-project-id-here      # Use custom project ID
 *   npx tsx tests/debug/sync-direct.ts project-id user-id        # Custom project & user ID
 * 
 * Environment variables needed:
 *   - DATABASE_URL (PostgreSQL)
 *   - REDIS_URL (optional)
 *   - NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD (optional)
 *   - OPENAI_API_KEY (for embeddings)
 */

import 'dotenv/config';
import { ProjectSyncService } from '../../src/domains/projects/services/project-sync.service';
import { ProjectRepository } from '../../src/domains/projects/repositories/project.repository';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../src/core/utils/logger';
import { projectEventHandlers } from '../../src/domains/projects/events/project.event-handlers';
import { chunkSyncService } from '../../src/knowledge/services/chunk-sync.service';

// Default values for testing
const DEFAULT_PROJECT_ID = 'cmf2g108b0001mzqo1c2c24qj';
const DEFAULT_USER_ID = 'cmez8zce70000b60yjcuussrs';
const DEFAULT_REPO_URL = 'https://github.com/foyzulkarim/hikma-engine.git'; 

async function createTestProject(prisma: PrismaClient, projectId: string, userId: string, repoUrl: string) {
  logger.info({ projectId, userId, repoUrl }, 'Creating/updating test project');
  
  // Check if project exists
  const existingProject = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (existingProject) {
    logger.info({ projectId }, 'Project already exists, updating repository info');
    
    // Only update if repositoryUrl is different to avoid unique constraint error
    if (existingProject.repositoryUrl !== repoUrl) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          repositoryUrl: repoUrl,
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      });
    } else {
      logger.info({ projectId }, 'Repository URL already matches, skipping update');
    }
  } else {
    logger.info({ projectId }, 'Creating new test project');
    
    // Create test project
    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Test Project for AST Parsing',
        slug: 'test-project-ast',
        description: 'Test project for debugging AST parsing integration',
        //ownerId: userId,
        repositoryUrl: repoUrl,
        //repositoryBranch: 'main',
        status: 'ACTIVE',
        //syncStatus: 'idle',
        //visibility: 'PRIVATE',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create project member relationship
    await prisma.projectMember.create({
      data: {
        projectId: projectId,
        userId: userId,
        role: 'OWNER',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  logger.info({ projectId }, 'Test project ready');
}

async function syncProjectDirect(projectId?: string, userId?: string, repoUrl?: string) {
  const targetProjectId = projectId || DEFAULT_PROJECT_ID;
  const targetUserId = userId || DEFAULT_USER_ID;
  const targetRepoUrl = repoUrl || DEFAULT_REPO_URL;

  logger.info({
    projectId: targetProjectId,
    userId: targetUserId,
    repositoryUrl: targetRepoUrl
  }, 'Starting direct project sync');

  const prisma = new PrismaClient();
  
  try {
    // Initialize database connection
    await prisma.$connect();
    logger.info('✅ Database connected');

    // Initialize event handlers (this ensures AST processing happens)
    logger.info('✅ Event handlers initialized', { 
      eventHandlersLoaded: !!projectEventHandlers 
    });

    // Create or update test project
    await createTestProject(prisma, targetProjectId, targetUserId, targetRepoUrl);

    // Initialize repository and service
    const projectRepository = new ProjectRepository(prisma);
    const projectSyncService = new ProjectSyncService(projectRepository);

    logger.info({ projectId: targetProjectId }, '🔄 Starting project sync...');

    // Call syncProject directly
    const result = await projectSyncService.syncProject(
      targetProjectId, 
      targetUserId, 
      { 
        useTemporaryClone: true,
        force: true,
        branch: 'main'
      }
    );

    logger.info('✅ Sync completed!');
    console.log('📋 Sync result:');
    console.log(JSON.stringify(result, null, 2));

    // Show where the repository was cloned
    if (result.tempPath) {
      console.log(`\n📂 Repository cloned to: ${result.tempPath}`);
      console.log(`💡 You can explore the files at: ${result.tempPath}`);
    }

    // Wait a bit for async AST processing to complete
    if (result.status === 'in_progress') {
      logger.info('⏳ Waiting for AST processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 20000)); // Wait 20 seconds

      // Check final status
      if (result.syncId) {
        const finalStatus = await projectSyncService.getSyncStatus(result.syncId, targetUserId);
        console.log('📊 Final sync status:');
        console.log(JSON.stringify(finalStatus, null, 2));
      }
    }

    // Query processed chunks from database
    const chunks = await prisma.documentChunk.findMany({
      include: {
        document: {
          select: {
            title: true,
            metadata: true
          }
        }
      },
      where: {
        document: {
          knowledgeBase: {
            projectId: targetProjectId
          }
        }
      },
      take: 10 // Limit to first 10 chunks
    });

    console.log(`📚 Found ${chunks.length} document chunks in database:`);
    chunks.forEach((chunk, index) => {
      console.log(`  ${index + 1}. ${chunk.document?.title} (chunk ${chunk.chunkIndex})`);
      console.log(`     Content preview: ${chunk.content.substring(0, 100)}...`);
      console.log(`     Metadata: ${JSON.stringify(chunk.metadata, null, 2)}`);
    });

    // Test chunk sync to Qdrant (embedding generation and vector storage)
    if (chunks.length > 0) {
      console.log('\n🔄 Starting chunk sync to Qdrant (embedding generation + vector storage)...');
      
      try {
        // Clear existing synced data first
        await chunkSyncService.clearSyncedData(targetProjectId);
        console.log('✅ Cleared existing synced data');
        
        // Sync chunks to Qdrant
        const syncResult = await chunkSyncService.syncChunksToQdrant({
          projectId: targetProjectId,
          skipExisting: false,
          batchSize: 5,
          limit: 20
        });
        
        console.log('✅ Chunk sync completed!');
        console.log('📊 Sync result:', JSON.stringify(syncResult, null, 2));
        
        if (syncResult.successful > 0) {
          console.log(`🎉 Successfully synced ${syncResult.successful} chunks to Qdrant with embeddings!`);
        }
        
        if (syncResult.errors.length > 0) {
          console.log('⚠️  Some chunks failed to sync:');
          syncResult.errors.forEach(error => {
            console.log(`   - Chunk ${error.chunkId}: ${error.error}`);
          });
        }
        
      } catch (syncError) {
        console.error('❌ Chunk sync failed:', syncError instanceof Error ? syncError.message : syncError);
      }
    } else {
      console.log('⚠️  No chunks found to sync to Qdrant');
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    }, 'Sync failed');
    
    console.error('❌ Direct sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}

// Parse command line arguments
const projectId = process.argv[2];
const userId = process.argv[3]; 
const repoUrl = process.argv[4];

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting direct project sync...');
  console.log('📝 Arguments:');
  console.log(`   Project ID: ${projectId || DEFAULT_PROJECT_ID}`);
  console.log(`   User ID: ${userId || DEFAULT_USER_ID}`);
  console.log(`   Repository URL: ${repoUrl || DEFAULT_REPO_URL}`);
  console.log('');
  
  (async () => {
    try {
      await syncProjectDirect(projectId, userId, repoUrl);
    } catch (error) {
      console.error('Script failed:', error);
      process.exit(1);
    }
  })().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { syncProjectDirect };