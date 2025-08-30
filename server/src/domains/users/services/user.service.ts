import { UserEntity, UserRole } from '../entities/user.entity';
import { IUserRepository, CreateUserData, UpdateUserData, FindUsersOptions } from '../repositories/user.repository.interface';
import { eventBus } from '@/shared/events/event-bus';

export class UserService {
  constructor(private userRepository: IUserRepository) {}

  async createUser(data: CreateUserData): Promise<UserEntity> {
    // Validate user data
    const tempUser = UserEntity.create({
      ...data,
      role: data.role as UserRole
    });
    const validation = new UserEntity(
      'temp',
      tempUser.email,
      tempUser.username,
      tempUser.password,
      tempUser.firstName,
      tempUser.lastName,
      tempUser.role,
      tempUser.isActive,
      new Date(),
      new Date()
    ).validate();

    if (!validation.isValid) {
      throw new Error(`Invalid user data: ${validation.errors.join(', ')}`);
    }

    // Check availability
    const emailAvailable = await this.userRepository.isEmailAvailable(data.email);
    if (!emailAvailable) {
      throw new Error('Email already exists');
    }

    const usernameAvailable = await this.userRepository.isUsernameAvailable(data.username);
    if (!usernameAvailable) {
      throw new Error('Username already exists');
    }

    // Create user (password should be hashed before this call)
    const user = await this.userRepository.create(data);

    // Emit event
    eventBus.emit('user-created', {
      userId: user.id,
      email: user.email,
      username: user.username,
      timestamp: new Date().toISOString()
    });

    return user;
  }

  async getUser(id: string): Promise<UserEntity | null> {
    return this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email);
  }

  async getUserByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepository.findByUsername(username);
  }

  async updateUser(id: string, data: UpdateUserData): Promise<UserEntity> {
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Validate email availability if changing
    if (data.email && data.email !== existingUser.email) {
      const emailAvailable = await this.userRepository.isEmailAvailable(data.email, id);
      if (!emailAvailable) {
        throw new Error('Email already exists');
      }
    }

    const updatedUser = await this.userRepository.update(id, data);

    // Emit event
    eventBus.emit('user-updated', {
      userId: id,
      changes: data,
      timestamp: new Date().toISOString()
    });

    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.delete(id);

    // Emit event
    eventBus.emit('user-deleted', {
      userId: id,
      email: user.email,
      username: user.username,
      timestamp: new Date().toISOString()
    });
  }

  async getUsers(options?: FindUsersOptions) {
    return this.userRepository.findAll(options);
  }

  async searchUsers(query: string, options?: FindUsersOptions) {
    return this.userRepository.search(query, options);
  }

  async authenticateUser(emailOrUsername: string, password: string): Promise<UserEntity | null> {
    const user = await this.userRepository.findByCredentials(emailOrUsername);
    
    if (!user || !user.isActive) {
      return null;
    }

    // Password verification would happen here
    // For now, just return the user (password should be verified with bcrypt)
    
    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return user;
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Password should be hashed before this call
    await this.userRepository.updatePassword(id, newPassword);

    // Emit event
    eventBus.emit('user-password-changed', {
      userId: id,
      timestamp: new Date().toISOString()
    });
  }

  async activateUser(id: string): Promise<UserEntity> {
    const user = await this.userRepository.activate(id);

    // Emit event
    eventBus.emit('user-activated', {
      userId: id,
      timestamp: new Date().toISOString()
    });

    return user;
  }

  async deactivateUser(id: string): Promise<UserEntity> {
    const user = await this.userRepository.deactivate(id);

    // Emit event
    eventBus.emit('user-deactivated', {
      userId: id,
      timestamp: new Date().toISOString()
    });

    return user;
  }
}
