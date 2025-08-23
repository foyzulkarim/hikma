import { PrismaClient, UserRole } from '@prisma/client';
import { UserEntity } from '../entities/user.entity';
import { 
  IUserRepository, 
  CreateUserData, 
  UpdateUserData, 
  FindUsersOptions,
  UserListResult 
} from './user.repository.interface';

export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUserData): Promise<UserEntity> {
    // Check for existing email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // Check for existing username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: data.username.toLowerCase() }
    });
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        password: data.password, // Should be hashed before calling this
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        role: (data.role as UserRole) || 'USER',
        isActive: true
      }
    });

    return this.mapToEntity(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id }
    });

    return user ? this.mapToEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    return user ? this.mapToEntity(user) : null;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    return user ? this.mapToEntity(user) : null;
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity> {
    const updateData: any = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.role !== undefined) updateData.role = data.role as UserRole;

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData
    });

    return this.mapToEntity(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id }
    });
  }

  async findAll(options: FindUsersOptions = {}): Promise<UserListResult> {
    const {
      limit = 10,
      offset = 0,
      isActive,
      role,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const whereClause: any = {};

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (role) {
      whereClause.role = role as UserRole;
    }

    if (search) {
      whereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        orderBy: {
          [sortBy]: sortOrder
        },
        take: limit,
        skip: offset
      }),
      this.prisma.user.count({
        where: whereClause
      })
    ]);

    return {
      users: users.map(u => this.mapToEntity(u)),
      metadata: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  async search(query: string, options: FindUsersOptions = {}): Promise<UserListResult> {
    return this.findAll({ ...options, search: query });
  }

  async count(options: { isActive?: boolean; role?: string } = {}): Promise<number> {
    const whereClause: any = {};

    if (options.isActive !== undefined) {
      whereClause.isActive = options.isActive;
    }

    if (options.role) {
      whereClause.role = options.role as UserRole;
    }

    return this.prisma.user.count({
      where: whereClause
    });
  }

  async exists(id: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });

    return !!user;
  }

  async isEmailAvailable(email: string, excludeId?: string): Promise<boolean> {
    const whereClause: any = { email: email.toLowerCase() };

    if (excludeId) {
      whereClause.id = { not: excludeId };
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      select: { id: true }
    });

    return !user;
  }

  async isUsernameAvailable(username: string, excludeId?: string): Promise<boolean> {
    const whereClause: any = { username: username.toLowerCase() };

    if (excludeId) {
      whereClause.id = { not: excludeId };
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      select: { id: true }
    });

    return !user;
  }

  async findByCredentials(emailOrUsername: string): Promise<UserEntity | null> {
    const identifier = emailOrUsername.toLowerCase();
    
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ],
        isActive: true
      }
    });

    return user ? this.mapToEntity(user) : null;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { updatedAt: new Date() } // Using updatedAt as lastLogin for now
    });
  }

  async activate(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true }
    });

    return this.mapToEntity(user);
  }

  async deactivate(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    return this.mapToEntity(user);
  }

  async changeRole(id: string, role: string): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role: role as UserRole }
    });

    return this.mapToEntity(user);
  }

  private mapToEntity(user: any): UserEntity {
    return new UserEntity(
      user.id,
      user.email,
      user.username,
      user.password,
      user.firstName,
      user.lastName,
      user.role,
      user.isActive,
      user.createdAt,
      user.updatedAt
    );
  }
}
