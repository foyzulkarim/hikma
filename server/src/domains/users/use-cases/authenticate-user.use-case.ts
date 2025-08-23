import { UserService } from '../services/user.service';

export interface AuthenticateUserRequest {
  emailOrUsername: string;
  password: string;
}

export interface AuthenticateUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: string;
    isActive: boolean;
  };
  message?: string;
}

export class AuthenticateUserUseCase {
  constructor(private userService: UserService) {}

  async execute(request: AuthenticateUserRequest): Promise<AuthenticateUserResponse> {
    try {
      // Validate input
      if (!request.emailOrUsername || !request.password) {
        return {
          success: false,
          message: 'Email/username and password are required'
        };
      }

      // Authenticate user
      const user = await this.userService.authenticateUser(
        request.emailOrUsername,
        request.password
      );

      if (!user) {
        return {
          success: false,
          message: 'Invalid credentials or inactive account'
        };
      }

      return {
        success: true,
        user: {
          ...user.toSafeResponse(),
          email: user.email
        }
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }
}
