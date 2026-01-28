/**
 * Unit tests for PasswordResetTokenRepository
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PasswordResetTokenRepository, generateResetToken, hashResetToken, type PasswordResetToken } from './password-reset-token.repository.js';
import * as baseRepository from './base.repository.js';
import { passwordResetTokens } from '../db/schema/index.js';

const mockExecutor = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('./base.repository.js', async () => {
  const actual = await vi.importActual('./base.repository.js');
  return {
    ...actual,
    getExecutor: vi.fn(() => mockExecutor),
    withTransaction: vi.fn((fn) => fn(mockExecutor)),
  };
});

describe('PasswordResetTokenRepository', () => {
  let repository: PasswordResetTokenRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PasswordResetTokenRepository();

    const mockToken: PasswordResetToken = {
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash123',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
    };

    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockToken]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockToken]),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'token-1' }]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'token-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new password reset token', async () => {
      mockExecutor.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([]),
      });

      const result = await repository.create('user-1');

      expect(result.token).toBeDefined();
      expect(result.record).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalledWith(passwordResetTokens);
    });

    it('should invalidate existing unused tokens', async () => {
      mockExecutor.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([{ id: 'old-token' }]),
      });

      await repository.create('user-1');

      expect(mockExecutor.delete).toHaveBeenCalled();
    });

    it('should generate unique token', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      const result1 = await repository.create('user-1');
      const result2 = await repository.create('user-1');

      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe('findValidByTokenHash', () => {
    it('should find valid token by hash', async () => {
      const result = await repository.findValidByTokenHash('hash123');

      expect(result).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should return null when token not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findValidByTokenHash('notfound');
      expect(result).toBeNull();
    });

    it('should exclude used tokens', async () => {
      await repository.findValidByTokenHash('hash123');
      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude expired tokens', async () => {
      await repository.findValidByTokenHash('hash123');
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('markUsed', () => {
    it('should mark token as used', async () => {
      const result = await repository.markUsed('token-1');

      expect(result).toBe(true);
      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should return false when token not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.markUsed('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired tokens', async () => {
      const result = await repository.deleteExpired();

      expect(result).toBe(1);
      expect(mockExecutor.delete).toHaveBeenCalled();
    });

    it('should return 0 when no expired tokens found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.deleteExpired();
      expect(result).toBe(0);
    });
  });

  describe('withTransaction', () => {
    it('should execute function within transaction', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');
      await repository.withTransaction(mockFn);
      expect(baseRepository.withTransaction).toHaveBeenCalledWith(mockFn);
    });
  });
});

describe('Token utilities', () => {
  it('should generate reset token', () => {
    const token = generateResetToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });

  it('should hash reset token', () => {
    const token = 'test-token';
    const hash = hashResetToken(token);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should produce different hashes for different tokens', () => {
    const hash1 = hashResetToken('token1');
    const hash2 = hashResetToken('token2');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce same hash for same token', () => {
    const hash1 = hashResetToken('token1');
    const hash2 = hashResetToken('token1');
    expect(hash1).toBe(hash2);
  });
});
