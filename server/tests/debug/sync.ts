/**
 * Project Sync Script - Tests the project sync endpoint
 * 
 * Usage:
 *   npx tsx tests/debug/sync.ts                           # Use default project ID
 *   npx tsx tests/debug/sync.ts your-project-id-here      # Use custom project ID
 * 
 * Note: Run login script first if you don't have a valid token:
 *   npx tsx tests/debug/login.ts
 */

import { makeRequest, getAuthHeaders, loadToken, getDefaultProjectId } from './utils';

async function syncProject(projectId?: string) {
  try {
    // Use provided project ID or default from environment/fallback
    const targetProjectId = projectId || getDefaultProjectId();

    console.log(`🔄 Syncing project: ${targetProjectId}`);

    // Check if we have a valid token
    const tokenData = loadToken();
    if (tokenData) {
      console.log(`👤 Authenticated as: ${tokenData.user.username}`);
    }

    const response = await makeRequest(`/api/v1/projects/${targetProjectId}/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });

    console.log('✅ Sync completed!');
    console.log('📋 Server response:');
    console.log(JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ Sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectId = process.argv[2]; // Get project ID from command line argument
  syncProject(projectId);
}
