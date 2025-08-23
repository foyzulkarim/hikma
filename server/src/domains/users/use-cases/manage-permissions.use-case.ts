import { UserService } from '../services/user.service';

export interface ManagePermissionsRequest {
  userId: string;
  adminUserId: string; // User performing the action
  action: 'activate' | 'deactivate' | 'change_role';
  newRole?: string;
}

export interface ManagePermissionsResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    role: string;
    isActive: boolean;
  };
  message?: string;
}

export class ManagePermissionsUseCase {
  constructor(private userService: UserService) {}

  async execute(request: ManagePermissionsRequest): Promise<ManagePermissionsResponse> {
    try {
      // Validate input
      this.validateRequest(request);

      // Verify admin user exists and has permissions
      const adminUser = await this.userService.getUser(request.adminUserId);
      if (!adminUser || !adminUser.isAdmin()) {
        return {
          success: false,
          message: 'Insufficient permissions to perform this action'
        };
      }

      // Get target user
      const targetUser = await this.userService.getUser(request.userId);
      if (!targetUser) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      let updatedUser;
      let actionMessage = '';

      switch (request.action) {
        case 'activate':
          updatedUser = await this.userService.activateUser(request.userId);
          actionMessage = 'User activated successfully';
          break;

        case 'deactivate':
          updatedUser = await this.userService.deactivateUser(request.userId);
          actionMessage = 'User deactivated successfully';
          break;

        case 'change_role':
          if (!request.newRole) {
            return {
              success: false,
              message: 'New role is required for role change action'
            };
          }

          if (!this.isValidRole(request.newRole)) {
            return {
              success: false,
              message: 'Invalid role specified'
            };
          }

          updatedUser = await this.userService.updateUser(request.userId, {
            role: request.newRole
          });
          actionMessage = `User role changed to ${request.newRole}`;
          break;

        default:
          return {
            success: false,
            message: 'Invalid action specified'
          };
      }

      return {
        success: true,
        user: updatedUser.toSafeResponse(),
        message: actionMessage
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Permission management failed'
      };
    }
  }

  private validateRequest(request: ManagePermissionsRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (!request.adminUserId) {
      throw new Error('Admin user ID is required');
    }

    if (!request.action) {
      throw new Error('Action is required');
    }

    const validActions = ['activate', 'deactivate', 'change_role'];
    if (!validActions.includes(request.action)) {
      throw new Error('Invalid action specified');
    }

    if (request.action === 'change_role' && !request.newRole) {
      throw new Error('New role is required for role change action');
    }
  }

  private isValidRole(role: string): boolean {
    const validRoles = ['USER', 'ADMIN'];
    return validRoles.includes(role);
  }
}
