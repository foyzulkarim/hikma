import { AuthService } from '../auth/service';
import { UserContext } from '../auth/types';

export interface AuthenticateUserRequest {
  emailOrUsername: string;
  password: string;
}

export interface AuthenticateUserResponse {
  success: boolean;
  user?: UserContext;
  message?: string;
}

export class AuthenticateUserUseCase {
  constructor(private authService: AuthService) {}

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
      const { user } = await this.authService.authenticateWithPassword(
        request.emailOrUsername,
        request.password
      );

      return {
        success: true,
        user,
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }
}
