import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupOptions {
  users?: boolean;
  projects?: boolean;
  apiKeys?: boolean;
  all?: boolean;
  confirm?: boolean;
}

// Parse command line arguments
function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  const options: CleanupOptions = {};

  args.forEach(arg => {
    switch (arg) {
      case '--users':
        options.users = true;
        break;
      case '--projects':
        options.projects = true;
        break;
      case '--api-keys':
        options.apiKeys = true;
        break;
      case '--all':
        options.all = true;
        break;
      case '--confirm':
        options.confirm = true;
        break;
    }
  });

  return options;
}

// Production safety check
function checkProductionSafety(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_CLEANUP) {
    console.error('❌ Cleanup is disabled in production environment');
    console.error('Set ALLOW_PRODUCTION_CLEANUP=true to override (DANGEROUS!)');
    process.exit(1);
  }
}

// Clean up users (except system admin)
async function cleanupUsers(): Promise<void> {
  console.log('🧹 Cleaning up users...');
  
  // Delete project members first (foreign key constraint)
  await prisma.projectMember.deleteMany({});
  
  // Delete users except the first admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' }
  });
  
  const result = await prisma.user.deleteMany({
    where: {
      id: {
        not: adminUser?.id || 'none'
      }
    }
  });
  
  console.log(`✅ Deleted ${result.count} users (kept system admin)`);
}

// Clean up projects
async function cleanupProjects(): Promise<void> {
  console.log('🧹 Cleaning up projects...');
  
  // Delete project members first
  await prisma.projectMember.deleteMany({});
  
  // Delete projects
  const result = await prisma.project.deleteMany({});
  
  console.log(`✅ Deleted ${result.count} projects`);
}

// Clean up API keys
async function cleanupApiKeys(): Promise<void> {
  console.log('🧹 Cleaning up API keys...');
  
  const result = await prisma.apiKey.deleteMany({});
  
  console.log(`✅ Deleted ${result.count} API keys`);
}

// Clean up all data
async function cleanupAll(): Promise<void> {
  console.log('🧹 Performing complete cleanup...');
  
  // Order matters due to foreign key constraints
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.apiKey.deleteMany({});
  
  // Keep the first admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' }
  });
  
  const userResult = await prisma.user.deleteMany({
    where: {
      id: {
        not: adminUser?.id || 'none'
      }
    }
  });
  
  console.log(`✅ Complete cleanup finished (kept system admin)`);
  console.log(`   - Users deleted: ${userResult.count}`);
}

// Show usage information
function showUsage(): void {
  console.log('\n📖 Database Cleanup Script Usage:');
  console.log('=' .repeat(50));
  console.log('npm run cleanup [options]');
  console.log('');
  console.log('Options:');
  console.log('  --users      Clean up all users except system admin');
  console.log('  --projects   Clean up all projects and memberships');
  console.log('  --api-keys   Clean up all API keys');
  console.log('  --all        Clean up all data (users, projects, API keys)');
  console.log('  --confirm    Skip confirmation prompt');
  console.log('');
  console.log('Examples:');
  console.log('  npm run cleanup --users --confirm');
  console.log('  npm run cleanup --all');
  console.log('  npm run cleanup --projects --api-keys');
  console.log('');
  console.log('⚠️  WARNING: This operation is irreversible!');
  console.log('=' .repeat(50));
}

// Confirm action with user
async function confirmAction(options: CleanupOptions): Promise<boolean> {
  if (options.confirm) {
    return true;
  }

  const actions: string[] = [];
  if (options.all) {
    actions.push('ALL DATA (users, projects, API keys)');
  } else {
    if (options.users) actions.push('users');
    if (options.projects) actions.push('projects');
    if (options.apiKeys) actions.push('API keys');
  }

  console.log(`\n⚠️  You are about to delete: ${actions.join(', ')}`);
  console.log('This operation cannot be undone!');
  console.log('');
  console.log('Type "yes" to continue or anything else to cancel:');
  
  // Simple confirmation (in a real app, you'd use a proper prompt library)
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toLowerCase();
      resolve(input === 'yes');
    });
  });
}

async function main(): Promise<void> {
  try {
    const options = parseArgs();
    
    // Show usage if no options provided
    if (!options.users && !options.projects && !options.apiKeys && !options.all) {
      showUsage();
      return;
    }
    
    // Check production safety
    checkProductionSafety();
    
    console.log('🗑️  Database Cleanup Script');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Confirm action
    const confirmed = await confirmAction(options);
    if (!confirmed) {
      console.log('❌ Cleanup cancelled by user');
      return;
    }
    
    // Perform cleanup based on options
    if (options.all) {
      await cleanupAll();
    } else {
      if (options.users) await cleanupUsers();
      if (options.projects) await cleanupProjects();
      if (options.apiKeys) await cleanupApiKeys();
    }
    
    console.log('\n✅ Cleanup completed successfully!');
    console.log('💡 Tip: Run "npm run seed" to recreate demo data');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('💥 Fatal error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  });