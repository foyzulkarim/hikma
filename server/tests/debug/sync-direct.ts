/**
 * Simple Project Sync Script
 * Usage: npx tsx tests/debug/sync-direct.ts <project-id>
 */

import 'dotenv/config';
import { ProjectSyncService } from '../../src/domains/projects/services/project-sync.service';
import { ProjectRepository } from '../../src/domains/projects/repositories/project.repository';
import { PrismaClient } from '@prisma/client';

const DEFAULT_USER_ID = 'cmf30k5430001dysh7wb84z0q'; // Valid user with OWNER access

async function syncProjectDirect(projectId: string) {
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    const projectRepository = new ProjectRepository(prisma);
    const projectSyncService = new ProjectSyncService(projectRepository);

    console.log(`🔄 Starting sync for project: ${projectId}`);

    const result = await projectSyncService.syncProject(
      projectId, 
      DEFAULT_USER_ID, 
      { 
        useTemporaryClone: true,
        force: true,
        branch: 'main'
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

const projectId = process.argv[2];

if (!projectId) {
  console.error('❌ Please provide a project ID');
  console.log('Usage: npx tsx tests/debug/sync-direct.ts <project-id>');
  process.exit(1);
}

console.log('🚀 Starting project sync...');
console.log(`📝 Project ID: ${projectId}`);

// syncProjectDirect(projectId).then(() => {
//   console.log('✅ Done!');
//   process.exit(0);
// }).catch((error) => {
//   console.error('Unhandled error:', error);
//   process.exit(1);
// });

(async () => {
  try {
    await syncProjectDirect(projectId);
    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  } finally {
    console.log('🚀 Project sync process completed');
  }
})();
