import { PrismaClient, UserRole, ProjectStatus, MemberRole } from '@prisma/client';
import { PasswordUtils } from '../src/core/utils/crypto';

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface CreatedUser {
  id: string;
  email: string;
  password: string;
  role: string;
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

// Generate seed users with environment-based configuration
function generateSeedUsers(): SeedUser[] {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@hikma.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || PasswordUtils.generateSecurePassword(16);
  const userEmail = process.env.SEED_USER_EMAIL || 'user@hikma.com';
  const userPassword = process.env.SEED_USER_PASSWORD || PasswordUtils.generateSecurePassword(16);
  const viewerEmail = process.env.SEED_VIEWER_EMAIL || 'viewer@hikma.com';
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD || PasswordUtils.generateSecurePassword(16);

  return [
    {
      email: adminEmail,
      username: 'admin',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.ADMIN,
    },
    {
      email: userEmail,
      username: 'demo-user',
      password: userPassword,
      firstName: 'Demo',
      lastName: 'User',
      role: UserRole.USER,
    },
    {
      email: viewerEmail,
      username: 'viewer',
      password: viewerPassword,
      firstName: 'Read Only',
      lastName: 'Viewer',
      role: UserRole.VIEWER,
    },
  ];
}

// Seed users with password validation and secure logging
async function seedUsers(): Promise<CreatedUser[]> {
  const seedUsers = generateSeedUsers();
  const createdUsers: CreatedUser[] = [];

  console.log('👥 Creating user accounts...');

  for (const userData of seedUsers) {
    // Validate password strength in non-development environments
    if (process.env.NODE_ENV !== 'development') {
      const passwordValidation = PasswordUtils.validatePasswordStrength(userData.password);
      if (!passwordValidation.isValid) {
        console.warn(`⚠️  Weak password for ${userData.email}: ${passwordValidation.errors.join(', ')}`);
      }
    }

    const hashedPassword = await PasswordUtils.hash(userData.password);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {}, // Don't update existing users
      create: {
        ...userData,
        password: hashedPassword,
      },
    });
    
    // Track created users for logging
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
      select: { id: true, createdAt: true }
    });
    
    // Only log credentials for newly created users (created in last 5 seconds)
    if (existingUser && (Date.now() - existingUser.createdAt.getTime()) < 5000) {
      createdUsers.push({
        id: user.id,
        email: userData.email,
        password: userData.password, // Original password for logging
        role: userData.role,
      });
    }
  }

  return createdUsers;
}

// Seed default project and relationships
async function seedProject(createdUsers: CreatedUser[]): Promise<void> {
  console.log('📁 Creating default project...');

  // Create default project for demo purposes
  const defaultProject = await prisma.project.upsert({
    where: { slug: 'demo-project' },
    update: {},
    create: {
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
      },
    },
  });

  // Add admin as project owner
  const adminUser = createdUsers.find(u => u.role === 'ADMIN');
  if (adminUser) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: defaultProject.id,
          userId: adminUser.id,
        },
      },
      update: {},
      create: {
        projectId: defaultProject.id,
        userId: adminUser.id,
        role: MemberRole.OWNER,
      },
    });
  }

  // Add regular user as member
  const regularUser = createdUsers.find(u => u.role === 'USER');
  if (regularUser) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: defaultProject.id,
          userId: regularUser.id,
        },
      },
      update: {},
      create: {
        projectId: defaultProject.id,
        userId: regularUser.id,
        role: MemberRole.MEMBER,
      },
    });
  }

  // Add viewer as viewer
  const viewerUser = createdUsers.find(u => u.role === 'VIEWER');
  if (viewerUser) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: defaultProject.id,
          userId: viewerUser.id,
        },
      },
      update: {},
      create: {
        projectId: defaultProject.id,
        userId: viewerUser.id,
        role: MemberRole.VIEWER,
      },
    });
  }

  console.log(`✅ Created project: ${defaultProject.name} (${defaultProject.slug})`);
}

// Log created credentials securely
function logCredentials(createdUsers: CreatedUser[]): void {
  if (createdUsers.length > 0) {
    console.log('\n🔐 Created user accounts:');
    console.log('=' .repeat(50));
    createdUsers.forEach(user => {
      console.log(`📧 ${user.email.padEnd(25)} (${user.role.padEnd(6)}): ${user.password}`);
    });
    console.log('=' .repeat(50));
    console.log('⚠️  Please save these credentials and change them after first login!');
    console.log('💡 Tip: Use the /auth/change-password endpoint to update passwords\n');
  } else {
    console.log('ℹ️  No new users created - all accounts already exist');
  }
}

async function main(): Promise<void> {
  try {
    // Validate environment and check production safety
    await validateEnvironment();
    checkProductionSafety();
    
    console.log('🌱 Starting database seeding...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Seed users
    const createdUsers = await seedUsers();
    
    // Seed project and relationships
    await seedProject(createdUsers);
    
    // Log credentials for new users
    logCredentials(createdUsers);
    
    console.log('✅ Database seeding completed successfully!');
    
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
