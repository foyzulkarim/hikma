/**
 * Simple Project Sync Script
 * Usage: npx tsx tests/debug/sync-direct.ts <project-id>
 */

import 'dotenv/config';
import { ProjectSyncService } from '../../src/domains/projects/services/project-sync.service';
import { ProjectRepository } from '../../src/domains/projects/repositories/project.repository';
import { vectorDbManager } from '../../src/config/vector-db';
import { PrismaClient } from '@prisma/client';

// Dynamic lookup for test data - no hardcoded IDs needed!
async function getTestData() {
  const prisma = new PrismaClient();
  
  const project = await prisma.project.findFirst({
    where: { slug: 'test-project' },
    include: {
      members: {
        where: { role: 'OWNER' },
        include: { user: true },
        take: 1,
      },
    },
  });

  if (!project || project.members.length === 0) {
    throw new Error(
      '❌ No test project found. Please run: npx tsx tests/debug/setup-test-data.ts'
    );
  }

  return {
    projectId: project.id,
    userId: project.members[0].userId,
    projectName: project.name,
    userEmail: project.members[0].user.email,
  };
}

const OLLAMA_EMBEDDING_MODEL = 'mxbai-embed-large';

async function syncProjectDirect() {
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Get test data dynamically
    const testData = await getTestData();
    console.log(`📝 Using project: ${testData.projectName} (${testData.projectId})`);
    console.log(`👤 Using user: ${testData.userEmail} (${testData.userId})`);
    
    // Initialize Qdrant connection and create collection if needed
    await vectorDbManager.connect();
    console.log('✅ Vector database connected');

    const projectRepository = new ProjectRepository(prisma);
    const projectSyncService = new ProjectSyncService(projectRepository);

    console.log(`🔄 Starting sync for project: ${testData.projectId}`);

    const result = await projectSyncService.syncProject(
      testData.projectId, 
      testData.userId, 
      { 
        useTemporaryClone: true,
        force: true,
        branch: 'master'
      }
    );

    console.log('✅ Sync completed!');
    console.log(JSON.stringify(result, null, 2));

    if (result.tempPath) {
      console.log(`📂 Repository cloned to: ${result.tempPath}`);
    }

  } catch (error) {
    console.error('❌ Sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

console.log('🚀 Starting project sync...');
console.log('📝 Using dynamic test data lookup');

// syncProjectDirect(projectId).then(() => {
//   console.log('✅ Done!');
//   process.exit(0);
// }).catch((error) => {
//   console.error('Unhandled error:', error);
//   process.exit(1);
// });

(async () => {
  try {
    await syncProjectDirect();
    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  } finally {
    console.log('🚀 Project sync process completed');
  }
})();
