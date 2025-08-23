export interface UserContext {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
}

export type AuthMethod = 'jwt' | 'api-key' | 'none';

export interface AuthenticationResult {
  user: UserContext;
  method: AuthMethod;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginAttempt {
  email: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  timestamp: Date;
  failureReason?: string;
}