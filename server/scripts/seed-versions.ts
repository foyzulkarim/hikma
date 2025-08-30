import { PrismaClient, UserRole, ProjectStatus, MemberRole } from '@prisma/client';
import { PasswordUtils } from '../src/core/utils/crypto';

const prisma = new PrismaClient();

interface SeedVersion {
  version: string;
  description: string;
  users: any[];
  projects: any[];
  relationships: any[];
}

// Seed data versions
const SEED_VERSIONS: Record<string, SeedVersion> = {
  'minimal': {
    version: '1.0.0',
    description: 'Minimal seed data with just admin user',
    users: [
      {
        email: 'admin@hikma.com',
        username: 'admin',
        password: 'admin123',
        firstName: 'System',
        lastName: 'Administrator',
        role: UserRole.ADMIN,
      }
    ],
    projects: [],
    relationships: []
  },
  
  'development': {
    version: '1.1.0',
    description: 'Full development seed data with multiple users and demo project',
    users: [
      {
        email: 'admin@hikma.com',
        username: 'admin',
        password: 'admin123',
        firstName: 'System',
        lastName: 'Administrator',
        role: UserRole.ADMIN,
      },
      {
        email: 'user@hikma.com',
        username: 'demo-user',
        password: 'user123',
        firstName: 'Demo',
        lastName: 'User',
        role: UserRole.USER,
      },
      {
        email: 'viewer@hikma.com',
        username: 'viewer',
        password: 'viewer123',
        firstName: 'Read Only',
        lastName: 'Viewer',
        role: UserRole.VIEWER,
      }
    ],
    projects: [
      {
        name: 'Demo Project',
        description: 'Default project for testing and demonstration',
        slug: 'demo-project',
        status: ProjectStatus.ACTIVE,
        settings: {
          features: {
            knowledgeBase: true,
            analytics: true,
            integrations: true
          },
          limits: {
            maxDocuments: 1000,
            maxQueries: 10000
          }
        }
      }
    ],
    relationships: [
      { userRole: 'ADMIN', projectSlug: 'demo-project', memberRole: MemberRole.OWNER },
      { userRole: 'USER', projectSlug: 'demo-project', memberRole: MemberRole.MEMBER },
      { userRole: 'VIEWER', projectSlug: 'demo-project', memberRole: MemberRole.VIEWER }
    ]
  },
  
  'testing': {
    version: '1.2.0',
    description: 'Testing seed data with multiple projects and complex relationships',
    users: [
      {
        email: 'admin@hikma.com',
        username: 'admin',
        password: 'admin123',
        firstName: 'System',
        lastName: 'Administrator',
        role: UserRole.ADMIN,
      },
      {
        email: 'manager@hikma.com',
        username: 'manager',
        password: 'manager123',
        firstName: 'Project',
        lastName: 'Manager',
        role: UserRole.USER,
      },
      {
        email: 'developer@hikma.com',
        username: 'developer',
        password: 'dev123',
        firstName: 'Software',
        lastName: 'Developer',
        role: UserRole.USER,
      },
      {
        email: 'analyst@hikma.com',
        username: 'analyst',
        password: 'analyst123',
        firstName: 'Data',
        lastName: 'Analyst',
        role: UserRole.VIEWER,
      }
    ],
    projects: [
      {
        name: 'Alpha Project',
        description: 'First test project for alpha features',
        slug: 'alpha-project',
        status: ProjectStatus.ACTIVE,
        settings: {
          features: {
            knowledgeBase: true,
            analytics: true,
            integrations: false
          },
          limits: {
            maxDocuments: 500,
            maxQueries: 5000
          }
        }
      },
      {
        name: 'Beta Project',
        description: 'Second test project for beta features',
        slug: 'beta-project',
        status: ProjectStatus.ACTIVE,
        settings: {
          features: {
            knowledgeBase: false,
            analytics: true,
            integrations: true
          },
          limits: {
            maxDocuments: 2000,
            maxQueries: 20000
          }
        }
      }
    ],
    relationships: [
      { userRole: 'ADMIN', projectSlug: 'alpha-project', memberRole: MemberRole.OWNER },
      { userRole: 'ADMIN', projectSlug: 'beta-project', memberRole: MemberRole.OWNER },
      { userRole: 'USER', projectSlug: 'alpha-project', memberRole: MemberRole.MEMBER },
      { userRole: 'USER', projectSlug: 'beta-project', memberRole: MemberRole.MEMBER },
      { userRole: 'VIEWER', projectSlug: 'alpha-project', memberRole: MemberRole.VIEWER }
    ]
  }
};

// Parse command line arguments
function parseArgs(): { version?: string; list?: boolean } {
  const args = process.argv.slice(2);
  const options: { version?: string; list?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--version' && i + 1 < args.length) {
      options.version = args[i + 1];
      i++;
    } else if (arg === '--list') {
      options.list = true;
    }
  }

  return options;
}

// List available seed versions
function listVersions(): void {
  console.log('\n📦 Available Seed Versions:');
  console.log('=' .repeat(60));
  
  Object.entries(SEED_VERSIONS).forEach(([key, version]) => {
    console.log(`🏷️  ${key.padEnd(12)} (v${version.version})`);
    console.log(`   ${version.description}`);
    console.log(`   Users: ${version.users.length}, Projects: ${version.projects.length}`);
    console.log('');
  });
  
  console.log('Usage: npm run seed:version -- --version <version_name>');
  console.log('Example: npm run seed:version -- --version development');
  console.log('=' .repeat(60));
}

// Environment validation
async function validateEnvironment(): Promise<void> {
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = requiredEnvVars.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Production safety check
function checkProductionSafety(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_SEEDING) {
    console.warn('⚠️  Seeding is disabled in production environment');
    console.warn('Set ALLOW_PRODUCTION_SEEDING=true to override (not recommended)');
    process.exit(0);
  }
}

// Seed users from version data
async function seedUsers(users: any[]): Promise<Record<string, string>> {
  const userIdMap: Record<string, string> = {};
  
  console.log(`👥 Creating ${users.length} user accounts...`);
  
  for (const userData of users) {
    const hashedPassword = await PasswordUtils.hash(userData.password);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        password: hashedPassword,
      },
    });
    
    userIdMap[userData.role] = user.id;
    console.log(`✅ Created user: ${userData.email} (${userData.role})`);
  }
  
  return userIdMap;
}

// Seed projects from version data
async function seedProjects(projects: any[]): Promise<Record<string, string>> {
  const projectIdMap: Record<string, string> = {};
  
  console.log(`📁 Creating ${projects.length} projects...`);
  
  for (const projectData of projects) {
    const project = await prisma.project.upsert({
      where: { slug: projectData.slug },
      update: {},
      create: projectData,
    });
    
    projectIdMap[projectData.slug] = project.id;
    console.log(`✅ Created project: ${projectData.name} (${projectData.slug})`);
  }
  
  return projectIdMap;
}

// Seed relationships from version data
async function seedRelationships(
  relationships: any[],
  userIdMap: Record<string, string>,
  projectIdMap: Record<string, string>
): Promise<void> {
  console.log(`🔗 Creating ${relationships.length} project relationships...`);
  
  for (const rel of relationships) {
    const userId = userIdMap[rel.userRole];
    const projectId = projectIdMap[rel.projectSlug];
    
    if (!userId || !projectId) {
      console.warn(`⚠️  Skipping relationship: user ${rel.userRole} or project ${rel.projectSlug} not found`);
      continue;
    }
    
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      update: {},
      create: {
        projectId,
        userId,
        role: rel.memberRole,
      },
    });
    
    console.log(`✅ Added ${rel.userRole} as ${rel.memberRole} to ${rel.projectSlug}`);
  }
}

// Main seeding function
async function seedVersion(versionName: string): Promise<void> {
  const version = SEED_VERSIONS[versionName];
  
  if (!version) {
    console.error(`❌ Unknown seed version: ${versionName}`);
    console.log('\nAvailable versions:');
    Object.keys(SEED_VERSIONS).forEach(key => {
      console.log(`  - ${key}`);
    });
    process.exit(1);
  }
  
  console.log(`🌱 Seeding database with version: ${versionName} (v${version.version})`);
  console.log(`📝 ${version.description}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Seed users and get ID mapping
  const userIdMap = await seedUsers(version.users);
  
  // Seed projects and get ID mapping
  const projectIdMap = await seedProjects(version.projects);
  
  // Seed relationships
  await seedRelationships(version.relationships, userIdMap, projectIdMap);
  
  console.log('\n✅ Database seeding completed successfully!');
  console.log(`📊 Summary: ${version.users.length} users, ${version.projects.length} projects, ${version.relationships.length} relationships`);
}

async function main(): Promise<void> {
  try {
    const options = parseArgs();
    
    // List versions if requested
    if (options.list) {
      listVersions();
      return;
    }
    
    // Validate environment and check production safety
    await validateEnvironment();
    checkProductionSafety();
    
    // Default to development version if none specified
    const versionName = options.version || 'development';
    
    await seedVersion(versionName);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('💥 Fatal error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  });