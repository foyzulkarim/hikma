import { UserRole } from '@prisma/client';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly username: string,
    public readonly password: string,
    public readonly firstName: string | null,
    public readonly lastName: string | null,
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Domain methods
  public getFullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    } else if (this.firstName) {
      return this.firstName;
    } else if (this.lastName) {
      return this.lastName;
    }
    return this.username;
  }

  public getDisplayName(): string {
    return this.getFullName() || this.username;
  }

  public isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  public canAccessProject(projectId: string): boolean {
    // This would typically check project membership
    // For now, return true for active users
    return this.isActive;
  }

  public canModifyProject(projectId: string): boolean {
    // This would typically check project permissions
    // Admins can modify any project
    return this.isAdmin();
  }

  public canCreateProject(): boolean {
    return this.isActive;
  }

  public canDeleteProject(projectId: string): boolean {
    // This would typically check if user is project owner or admin
    return this.isAdmin();
  }

  // Validation methods
  public validateEmail(): { isValid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      return { isValid: false, error: 'Invalid email format' };
    }
    return { isValid: true };
  }

  public validateUsername(): { isValid: boolean; error?: string } {
    // Username should be 3-30 characters, alphanumeric with underscores/hyphens
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(this.username)) {
      return { 
        isValid: false, 
        error: 'Username must be 3-30 characters, alphanumeric with underscores or hyphens only' 
      };
    }
    return { isValid: true };
  }

  public validatePassword(): { isValid: boolean; error?: string } {
    // Basic password validation - at least 8 characters
    if (this.password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long' };
    }
    return { isValid: true };
  }

  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const emailValidation = this.validateEmail();
    if (!emailValidation.isValid && emailValidation.error) {
      errors.push(emailValidation.error);
    }

    const usernameValidation = this.validateUsername();
    if (!usernameValidation.isValid && usernameValidation.error) {
      errors.push(usernameValidation.error);
    }

    const passwordValidation = this.validatePassword();
    if (!passwordValidation.isValid && passwordValidation.error) {
      errors.push(passwordValidation.error);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Factory methods
  public static create(data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
  }): {
    email: string;
    username: string;
    password: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    isActive: boolean;
  } {
    return {
      email: data.email.toLowerCase().trim(),
      username: data.username.toLowerCase().trim(),
      password: data.password, // Should be hashed before storage
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null,
      role: data.role || 'USER',
      isActive: true
    };
  }

  public update(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    isActive?: boolean;
    role?: UserRole;
  }): Partial<UserEntity> {
    const updates: any = {};

    if (data.firstName !== undefined) {
      updates.firstName = data.firstName?.trim() || null;
    }
    if (data.lastName !== undefined) {
      updates.lastName = data.lastName?.trim() || null;
    }
    if (data.email !== undefined) {
      updates.email = data.email.toLowerCase().trim();
    }
    if (data.isActive !== undefined) {
      updates.isActive = data.isActive;
    }
    if (data.role !== undefined) {
      updates.role = data.role;
    }

    return updates;
  }

  // Serialization methods
  public toResponse(): {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    displayName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.getFullName(),
      displayName: this.getDisplayName(),
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  public toSafeResponse(): {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    displayName: string;
    role: string;
    isActive: boolean;
  } {
    return {
      id: this.id,
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.getFullName(),
      displayName: this.getDisplayName(),
      role: this.role,
      isActive: this.isActive
    };
  }
}

// Re-export types for convenience
export type { UserRole } from '@prisma/client';
