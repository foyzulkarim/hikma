import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestData {
  user: {
    id: string;
    email: string;
    username: string;
  };
  project: {
    id: string;
    name: string;
    slug: string;
    repositoryUrl: string | null;
  };
}

async function createTestData(): Promise<TestData> {
  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword123',
      firstName: 'Test',
      lastName: 'User',
    },
  });

  console.log('✅ Created/found user:', user.id);

  // Create a test project
  const project = await prisma.project.upsert({
    where: { slug: 'test-project' },
    update: {
      settings: {
        repositoryUrl: 'https://github.com/octocat/Hello-World.git',
        branch: 'master',
        syncEnabled: true,
        enableAutoSync: false,
      },
    },
    create: {
      name: 'Test Project',
      slug: 'test-project',
      description: 'A test project for debugging',
      repositoryUrl: 'https://github.com/octocat/Hello-World.git',
      settings: {
        repositoryUrl: 'https://github.com/octocat/Hello-World.git',
        branch: 'master',
        syncEnabled: true,
        enableAutoSync: false,
      },
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
  });

  console.log('✅ Created/updated project:', project.id);
  
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      repositoryUrl: project.repositoryUrl,
    },
  };
}

async function checkTestData(): Promise<TestData | null> {
  const project = await prisma.project.findFirst({
    where: { slug: 'test-project' },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!project) {
    console.log('❌ No test project found');
    return null;
  }

  console.log('✅ Project found:');
  console.log('  ID:', project.id);
  console.log('  Name:', project.name);
  console.log('  Slug:', project.slug);
  console.log('  Repository URL:', project.repositoryUrl);
  console.log('  Settings:', JSON.stringify(project.settings, null, 2));
  console.log('  Members:', project.members.length);
  
  if (project.members.length > 0) {
    const member = project.members[0];
    console.log('  First member:', {
      userId: member.userId,
      role: member.role,
      userEmail: member.user.email,
    });
    
    return {
      user: {
        id: member.user.id,
        email: member.user.email,
        username: member.user.username,
      },
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        repositoryUrl: project.repositoryUrl,
      },
    };
  }
  
  return null;
}

async function main() {
  try {
    const command = process.argv[2];
    
    switch (command) {
      case 'create':
      case 'setup':
        console.log('🔄 Creating/updating test data...');
        await createTestData();
        console.log('✅ Test data setup completed!');
        break;
        
      case 'check':
      case 'verify':
        console.log('🔍 Checking test data...');
        const data = await checkTestData();
        if (!data) {
          console.log('❌ Test data not found. Run with "create" to set it up.');
          process.exit(1);
        }
        break;
        
      case 'both':
      case undefined:
        console.log('🔄 Setting up and verifying test data...');
        await createTestData();
        console.log('\n🔍 Verifying test data...');
        await checkTestData();
        console.log('✅ All done!');
        break;
        
      default:
        console.log('Usage: npx tsx setup-test-data.ts [create|check|both]');
        console.log('  create/setup - Create or update test data');
        console.log('  check/verify - Check if test data exists');
        console.log('  both (default) - Create and verify test data');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();