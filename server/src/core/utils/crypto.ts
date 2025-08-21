import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '@/config/app.js';
import { logger } from './logger.js';

// Password hashing utilities
export class PasswordUtils {
  private static readonly saltRounds = config.security.bcryptRounds;

  static async hash(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.saltRounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      logger.error({ error }, 'Failed to hash password');
      throw new Error('Password hashing failed');
    }
  }

  static async verify(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      logger.error({ error }, 'Failed to verify password');
      return false;
    }
  }

  static generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    score: number;
  } {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
      score += 2;
    } else {
      score += 1;
    }

    // Uppercase check
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    // Lowercase check
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    // Number check
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    // Special character check
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    // Common patterns check
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /admin/i,
      /letmein/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains common patterns and is not secure');
        score -= 2;
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      score: Math.max(0, score),
    };
  }
}

// JWT token utilities
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export class JWTUtils {
  private static readonly secret = config.security.jwtSecret;
  private static readonly expiresIn = config.security.jwtExpiresIn;

  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string {
    try {
      const jti = crypto.randomUUID();
      const tokenPayload: JWTPayload = {
        ...payload,
        jti,
      };

      return jwt.sign(tokenPayload, this.secret, {
        expiresIn: this.expiresIn,
        issuer: 'hikma',
        audience: 'hikma-users',
      });
    } catch (error) {
      logger.error({ error, userId: payload.userId }, 'Failed to generate JWT token');
      throw new Error('Token generation failed');
    }
  }

  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'hikma',
        audience: 'hikma-users',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        logger.error({ error }, 'Failed to verify JWT token');
        throw new Error('Token verification failed');
      }
    }
  }

  static decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.error({ error }, 'Failed to decode JWT token');
      return null;
    }
  }

  static refreshToken(token: string): string {
    try {
      const decoded = this.verifyToken(token);
      
      // Remove timing fields for refresh
      const { iat, exp, jti, ...payload } = decoded;
      
      return this.generateToken(payload);
    } catch (error) {
      logger.error({ error }, 'Failed to refresh JWT token');
      throw new Error('Token refresh failed');
    }
  }

  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token);
      if (decoded?.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      logger.error({ error }, 'Failed to get token expiration');
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    try {
      const expiration = this.getTokenExpiration(token);
      if (!expiration) return true;
      
      return expiration.getTime() <= Date.now();
    } catch (error) {
      return true;
    }
  }
}

// API Key utilities
export class ApiKeyUtils {
  private static readonly keyLength = 32;
  private static readonly prefix = 'hk_';

  static generateApiKey(): { key: string; hash: string } {
    try {
      const randomBytes = crypto.randomBytes(this.keyLength);
      const key = this.prefix + randomBytes.toString('hex');
      const hash = crypto.createHash('sha256').update(key).digest('hex');

      return { key, hash };
    } catch (error) {
      logger.error({ error }, 'Failed to generate API key');
      throw new Error('API key generation failed');
    }
  }

  static hashApiKey(key: string): string {
    try {
      return crypto.createHash('sha256').update(key).digest('hex');
    } catch (error) {
      logger.error({ error }, 'Failed to hash API key');
      throw new Error('API key hashing failed');
    }
  }

  static validateApiKeyFormat(key: string): boolean {
    const pattern = new RegExp(`^${this.prefix}[a-f0-9]{${this.keyLength * 2}}$`);
    return pattern.test(key);
  }
}

// Encryption utilities
export class EncryptionUtils {
  private static readonly algorithm = 'aes-256-gcm';
  private static readonly keyLength = 32;
  private static readonly ivLength = 16;
  private static readonly tagLength = 16;
  private static readonly key = Buffer.from(config.security.encryptionKey, 'utf8');

  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.key);
      cipher.setAAD(Buffer.from('hikma', 'utf8'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();
      
      // Combine iv, tag, and encrypted data
      const combined = iv.toString('hex') + tag.toString('hex') + encrypted;
      return Buffer.from(combined, 'hex').toString('base64');
    } catch (error) {
      logger.error({ error }, 'Failed to encrypt data');
      throw new Error('Encryption failed');
    }
  }

  static decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64').toString('hex');
      
      const iv = Buffer.from(combined.slice(0, this.ivLength * 2), 'hex');
      const tag = Buffer.from(combined.slice(this.ivLength * 2, (this.ivLength + this.tagLength) * 2), 'hex');
      const encrypted = combined.slice((this.ivLength + this.tagLength) * 2);

      const decipher = crypto.createDecipher(this.algorithm, this.key);
      decipher.setAAD(Buffer.from('hikma', 'utf8'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error({ error }, 'Failed to decrypt data');
      throw new Error('Decryption failed');
    }
  }

  static generateSecretKey(): string {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }
}

// Secure random utilities
export class SecureRandomUtils {
  static generateId(length: number = 16): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateUUID(): string {
    return crypto.randomUUID();
  }

  static generateNumericCode(length: number = 6): string {
    const max = Math.pow(10, length) - 1;
    const min = Math.pow(10, length - 1);
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  static generateAlphanumericCode(length: number = 8): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      code += charset[randomIndex];
    }
    
    return code;
  }
}

// Hash utilities for data integrity
export class HashUtils {
  static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  static md5(data: string): string {
    return crypto.createHash('md5').update(data, 'utf8').digest('hex');
  }

  static hmacSha256(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
  }

  static verifyHmacSha256(data: string, secret: string, signature: string): boolean {
    const expectedSignature = this.hmacSha256(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

// Export all utilities
export {
  PasswordUtils,
  JWTUtils,
  ApiKeyUtils,
  EncryptionUtils,
  SecureRandomUtils,
  HashUtils,
};

