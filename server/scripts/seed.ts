import { PrismaClient, UserRole } from '@prisma/client';
import { PasswordUtils } from '../src/core/utils/crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const adminPassword = await PasswordUtils.hash('admin123');
  const userPassword = await PasswordUtils.hash('user123');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hikma.com' },
    update: {},
    create: {
      email: 'admin@hikma.com',
      username: 'admin',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@hikma.com' },
    update: {},
    create: {
      email: 'user@hikma.com',
      username: 'user',
      password: userPassword,
      firstName: 'Regular',
      lastName: 'User',
      role: UserRole.USER,
    },
  });

  console.log({ admin, user });
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
