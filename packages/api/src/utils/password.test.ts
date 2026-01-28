/**
 * Unit tests for password utilities
 * Tests password hashing, verification, and generation using Argon2id
 */

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateRandomPassword,
} from './password.js';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toContain('$argon2id$');
    });

    it('should produce different hashes for same password (random salt)', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should hash empty string', async () => {
      const hash = await hashPassword('');

      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');
    });

    it('should hash long password', async () => {
      const password = 'a'.repeat(1000);
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');
    });

    it('should hash password with special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');
    });

    it('should hash password with unicode characters', async () => {
      const password = 'password123🔒';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, password);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, 'wrongPassword');

      expect(isValid).toBe(false);
    });

    it('should reject password with different case', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, 'TESTpassword123');

      expect(isValid).toBe(false);
    });

    it('should handle malformed hash gracefully', async () => {
      const isValid = await verifyPassword('not-a-valid-hash', 'password');

      expect(isValid).toBe(false);
    });

    it('should handle empty hash gracefully', async () => {
      const isValid = await verifyPassword('', 'password');

      expect(isValid).toBe(false);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, '');

      expect(isValid).toBe(true);
    });

    it('should verify password with special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, password);

      expect(isValid).toBe(true);
    });

    it('should verify password with unicode characters', async () => {
      const password = 'password123🔒';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, password);

      expect(isValid).toBe(true);
    });

    it('should reject null hash', async () => {
      const isValid = await verifyPassword(null as any, 'password');

      expect(isValid).toBe(false);
    });

    it('should reject undefined hash', async () => {
      const isValid = await verifyPassword(undefined as any, 'password');

      expect(isValid).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('should return false for current hash format', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const needs = await needsRehash(hash);

      expect(needs).toBe(false);
    });

    it('should return true for malformed hash', async () => {
      const needs = await needsRehash('not-a-valid-hash');

      expect(needs).toBe(true);
    });

    it('should return true for empty hash', async () => {
      const needs = await needsRehash('');

      expect(needs).toBe(true);
    });

    it('should return true for null hash', async () => {
      const needs = await needsRehash(null as any);

      expect(needs).toBe(true);
    });

    it('should return true for undefined hash', async () => {
      const needs = await needsRehash(undefined as any);

      expect(needs).toBe(true);
    });

    it('should detect old argon2 format', async () => {
      // Old argon2i hash (not argon2id)
      const oldHash = '$argon2i$v=19$m=4096,t=3,p=1$c29tZXNhbHQ$hash';
      const needs = await needsRehash(oldHash);

      // Should need rehash since it's not argon2id with our params
      expect(needs).toBe(true);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate password of default length', () => {
      const password = generateRandomPassword();

      expect(password).toBeDefined();
      expect(password.length).toBe(16);
    });

    it('should generate password of specified length', () => {
      const length = 32;
      const password = generateRandomPassword(length);

      expect(password.length).toBe(length);
    });

    it('should generate unique passwords', () => {
      const password1 = generateRandomPassword();
      const password2 = generateRandomPassword();

      expect(password1).not.toBe(password2);
    });

    it('should generate password with length 1', () => {
      const password = generateRandomPassword(1);

      expect(password.length).toBe(1);
    });

    it('should generate password with length 100', () => {
      const password = generateRandomPassword(100);

      expect(password.length).toBe(100);
    });

    it('should contain only valid characters', () => {
      const password = generateRandomPassword(100);
      const validChars = /^[a-zA-Z0-9!@#$%^&*]+$/;

      expect(password).toMatch(validChars);
    });

    it('should generate different passwords on each call', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(generateRandomPassword());
      }

      // All 100 should be unique
      expect(passwords.size).toBe(100);
    });

    it('should handle zero length gracefully', () => {
      const password = generateRandomPassword(0);

      expect(password).toBe('');
    });

    it('should handle negative length by throwing error', () => {
      expect(() => generateRandomPassword(-1)).toThrow();
    });
  });

  describe('Integration tests', () => {
    it('should support full password lifecycle', async () => {
      const originalPassword = 'mySecurePassword123!';

      // Hash the password
      const hash = await hashPassword(originalPassword);
      expect(hash).toBeDefined();

      // Verify correct password
      const isValid = await verifyPassword(hash, originalPassword);
      expect(isValid).toBe(true);

      // Verify incorrect password
      const isInvalid = await verifyPassword(hash, 'wrongPassword');
      expect(isInvalid).toBe(false);

      // Check if rehash needed (should be false for new hash)
      const needsUpdate = await needsRehash(hash);
      expect(needsUpdate).toBe(false);
    });

    it('should work with generated passwords', async () => {
      const generatedPassword = generateRandomPassword(20);
      const hash = await hashPassword(generatedPassword);

      const isValid = await verifyPassword(hash, generatedPassword);

      expect(isValid).toBe(true);
    });

    it('should maintain case sensitivity', async () => {
      const password = 'MyPassword123';
      const hash = await hashPassword(password);

      expect(await verifyPassword(hash, 'MyPassword123')).toBe(true);
      expect(await verifyPassword(hash, 'mypassword123')).toBe(false);
      expect(await verifyPassword(hash, 'MYPASSWORD123')).toBe(false);
    });

    it('should handle whitespace correctly', async () => {
      const password = ' password with spaces ';
      const hash = await hashPassword(password);

      expect(await verifyPassword(hash, ' password with spaces ')).toBe(true);
      expect(await verifyPassword(hash, 'password with spaces')).toBe(false);
    });
  });
});
