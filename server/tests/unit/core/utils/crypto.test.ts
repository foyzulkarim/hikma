import { describe, it, expect, beforeEach } from 'vitest';
import { PasswordUtils, JWTUtils, CryptoUtils } from '@/core/utils/crypto.js';

describe('PasswordUtils', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await PasswordUtils.hashPassword(password);
      const hash2 = await PasswordUtils.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword.length).toBeGreaterThan(0);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      const isValid = await PasswordUtils.verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      const isValid = await PasswordUtils.verifyPassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should handle empty password verification', async () => {
      const password = '';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      const isValid = await PasswordUtils.verifyPassword('', hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await PasswordUtils.verifyPassword('notEmpty', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('JWTUtils', () => {
  const testPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', async () => {
      const token = await JWTUtils.generateToken(testPayload, '1h');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for same payload', async () => {
      const token1 = await JWTUtils.generateToken(testPayload, '1h');
      const token2 = await JWTUtils.generateToken(testPayload, '1h');
      
      expect(token1).not.toBe(token2);
    });

    it('should handle different expiration times', async () => {
      const shortToken = await JWTUtils.generateToken(testPayload, '1m');
      const longToken = await JWTUtils.generateToken(testPayload, '1d');
      
      expect(shortToken).toBeDefined();
      expect(longToken).toBeDefined();
      expect(shortToken).not.toBe(longToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const token = await JWTUtils.generateToken(testPayload, '1h');
      const decoded = await JWTUtils.verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(JWTUtils.verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should reject malformed token', async () => {
      const malformedToken = 'not-a-jwt-token';
      
      await expect(JWTUtils.verifyToken(malformedToken)).rejects.toThrow();
    });

    it('should handle expired token', async () => {
      // Create a token that expires immediately
      const token = await JWTUtils.generateToken(testPayload, '0s');
      
      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await expect(JWTUtils.verifyToken(token)).rejects.toThrow();
    });
  });

  describe('refreshToken', () => {
    it('should refresh valid token', async () => {
      const originalToken = await JWTUtils.generateToken(testPayload, '1h');
      const newToken = await JWTUtils.refreshToken(originalToken, '2h');
      
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(originalToken);
      
      const decoded = await JWTUtils.verifyToken(newToken);
      expect(decoded.userId).toBe(testPayload.userId);
    });

    it('should reject refresh of invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(JWTUtils.refreshToken(invalidToken, '1h')).rejects.toThrow();
    });
  });
});

describe('CryptoUtils', () => {
  describe('generateApiKey', () => {
    it('should generate API key with default length', () => {
      const apiKey = CryptoUtils.generateApiKey();
      
      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBe(64); // Default length
    });

    it('should generate API key with custom length', () => {
      const customLength = 32;
      const apiKey = CryptoUtils.generateApiKey(customLength);
      
      expect(apiKey).toBeDefined();
      expect(apiKey.length).toBe(customLength);
    });

    it('should generate different API keys', () => {
      const key1 = CryptoUtils.generateApiKey();
      const key2 = CryptoUtils.generateApiKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateSecureId', () => {
    it('should generate secure ID with default length', () => {
      const id = CryptoUtils.generateSecureId();
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(32); // Default length
    });

    it('should generate secure ID with custom length', () => {
      const customLength = 16;
      const id = CryptoUtils.generateSecureId(customLength);
      
      expect(id).toBeDefined();
      expect(id.length).toBe(customLength);
    });

    it('should generate different secure IDs', () => {
      const id1 = CryptoUtils.generateSecureId();
      const id2 = CryptoUtils.generateSecureId();
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('encrypt and decrypt', () => {
    const testData = 'sensitive information';

    it('should encrypt and decrypt data successfully', () => {
      const encrypted = CryptoUtils.encrypt(testData);
      const decrypted = CryptoUtils.decrypt(encrypted);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(testData);
      expect(decrypted).toBe(testData);
    });

    it('should generate different encrypted values for same data', () => {
      const encrypted1 = CryptoUtils.encrypt(testData);
      const encrypted2 = CryptoUtils.encrypt(testData);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      const decrypted1 = CryptoUtils.decrypt(encrypted1);
      const decrypted2 = CryptoUtils.decrypt(encrypted2);
      
      expect(decrypted1).toBe(testData);
      expect(decrypted2).toBe(testData);
    });

    it('should handle empty string encryption', () => {
      const emptyData = '';
      const encrypted = CryptoUtils.encrypt(emptyData);
      const decrypted = CryptoUtils.decrypt(encrypted);
      
      expect(decrypted).toBe(emptyData);
    });

    it('should handle special characters', () => {
      const specialData = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ 中文 🚀';
      const encrypted = CryptoUtils.encrypt(specialData);
      const decrypted = CryptoUtils.decrypt(encrypted);
      
      expect(decrypted).toBe(specialData);
    });

    it('should throw error for invalid encrypted data', () => {
      const invalidEncrypted = 'invalid-encrypted-data';
      
      expect(() => CryptoUtils.decrypt(invalidEncrypted)).toThrow();
    });
  });

  describe('hashData', () => {
    it('should hash data consistently', () => {
      const data = 'test data';
      const hash1 = CryptoUtils.hashData(data);
      const hash2 = CryptoUtils.hashData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe('string');
    });

    it('should generate different hashes for different data', () => {
      const data1 = 'test data 1';
      const data2 = 'test data 2';
      
      const hash1 = CryptoUtils.hashData(data1);
      const hash2 = CryptoUtils.hashData(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const emptyData = '';
      const hash = CryptoUtils.hashData(emptyData);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });
});

