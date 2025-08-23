import { UserService } from '../services/user.service';

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  };
  message?: string;
}

export class CreateUserUseCase {
  constructor(private userService: UserService) {}

  async execute(request: CreateUserRequest): Promise<CreateUserResponse> {
    try {
      // Validate input
      this.validateRequest(request);

      // Create user (password should be hashed before this)
      const user = await this.userService.createUser({
        email: request.email,
        username: request.username,
        password: request.password, // Should be hashed
        firstName: request.firstName,
        lastName: request.lastName,
        role: request.role
      });

      return {
        success: true,
        user: {
          ...user.toSafeResponse(),
          email: user.email,
          createdAt: user.createdAt.toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'User creation failed'
      };
    }
  }

  private validateRequest(request: CreateUserRequest): void {
    if (!request.email) {
      throw new Error('Email is required');
    }

    if (!request.username) {
      throw new Error('Username is required');
    }

    if (!request.password) {
      throw new Error('Password is required');
    }

    if (request.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      throw new Error('Invalid email format');
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(request.username)) {
      throw new Error('Username must be 3-30 characters, alphanumeric with underscores or hyphens only');
    }
  }
}
