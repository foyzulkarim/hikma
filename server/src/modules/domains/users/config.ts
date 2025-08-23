export interface UserModuleConfig {
  maxUsersPerOrganization: number;
  passwordMinLength: number;
  passwordMaxLength: number;
  usernameMinLength: number;
  usernameMaxLength: number;
  usernamePattern: RegExp;
  emailPattern: RegExp;
  tokenExpiryHours: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  requireEmailVerification: boolean;
  allowSelfRegistration: boolean;
}

export const userConfig: UserModuleConfig = {
  maxUsersPerOrganization: parseInt(process.env.MAX_USERS_PER_ORG || '100'),
  passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
  passwordMaxLength: parseInt(process.env.PASSWORD_MAX_LENGTH || '128'),
  usernameMinLength: parseInt(process.env.USERNAME_MIN_LENGTH || '3'),
  usernameMaxLength: parseInt(process.env.USERNAME_MAX_LENGTH || '30'),
  usernamePattern: /^[a-zA-Z0-9_-]+$/,
  emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  tokenExpiryHours: parseInt(process.env.TOKEN_EXPIRY_HOURS || '24'),
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
  lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15'),
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  allowSelfRegistration: process.env.ALLOW_SELF_REGISTRATION !== 'false',
};