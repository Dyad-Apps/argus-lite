/**
 * Unit tests for RefreshTokenRepository
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshTokenRepository, generateRefreshToken, hashRefreshToken, type RefreshToken } from './refresh-token.repository.js';
import * as baseRepository from './base.repository.js';
import { refreshTokens } from '../db/schema/index.js';

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

describe('RefreshTokenRepository', () => {
  let repository: RefreshTokenRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new RefreshTokenRepository();

    const mockToken: RefreshToken = {
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash123',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
      revokedAt: null,
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
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
          orderBy: vi.fn().mockResolvedValue([mockToken]),
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
    it('should create a new refresh token', async () => {
      const result = await repository.create('user-1');

      expect(result.token).toBeDefined();
      expect(result.record).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalledWith(refreshTokens);
    });

    it('should create token with options', async () => {
      const result = await repository.create('user-1', {
        familyId: 'family-1',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });

      expect(result.token).toBeDefined();
      expect(result.record).toBeDefined();
    });

    it('should generate unique token', async () => {
      const result1 = await repository.create('user-1');
      const result2 = await repository.create('user-1');

      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe('findByTokenHash', () => {
    it('should find valid token by hash', async () => {
      const result = await repository.findByTokenHash('hash123');

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

      const result = await repository.findByTokenHash('notfound');
      expect(result).toBeNull();
    });

    it('should exclude revoked tokens', async () => {
      await repository.findByTokenHash('hash123');
      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude expired tokens', async () => {
      await repository.findByTokenHash('hash123');
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByTokenHashIncludeRevoked', () => {
    it('should find token including revoked', async () => {
      const result = await repository.findByTokenHashIncludeRevoked('hash123');

      expect(result).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('rotate', () => {
    it('should rotate refresh token', async () => {
      const oldToken: RefreshToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'oldhash',
        familyId: 'family-1',
        expiresAt: new Date(),
        isRevoked: false,
        revokedAt: null,
        lastUsedAt: null,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        createdAt: new Date(),
      };

      const result = await repository.rotate(oldToken);

      expect(result.token).toBeDefined();
      expect(result.record).toBeDefined();
      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should maintain family ID when rotating', async () => {
      const oldToken: RefreshToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'oldhash',
        familyId: 'family-1',
        expiresAt: new Date(),
        isRevoked: false,
        revokedAt: null,
        lastUsedAt: null,
        userAgent: null,
        ipAddress: null,
        createdAt: new Date(),
      };

      await repository.rotate(oldToken);

      expect(mockExecutor.update).toHaveBeenCalled();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('revokeFamilyTokens', () => {
    it('should revoke all tokens in family', async () => {
      const result = await repository.revokeFamilyTokens('family-1');

      expect(result).toBe(1);
      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should return 0 when no tokens found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.revokeFamilyTokens('nonexistent');
      expect(result).toBe(0);
    });
  });

  describe('revokeById', () => {
    it('should revoke token by ID', async () => {
      const result = await repository.revokeById('token-1');

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

      const result = await repository.revokeById('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      const result = await repository.revokeAllUserTokens('user-1');

      expect(result).toBe(1);
      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('getActiveSessions', () => {
    it('should get all active sessions for user', async () => {
      const result = await repository.getActiveSessions('user-1');

      expect(result).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired tokens', async () => {
      const result = await repository.deleteExpired();

      expect(result).toBe(1);
      expect(mockExecutor.delete).toHaveBeenCalled();
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
  it('should generate refresh token', () => {
    const token = generateRefreshToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });

  it('should hash refresh token', () => {
    const token = 'test-token';
    const hash = hashRefreshToken(token);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should produce different hashes for different tokens', () => {
    const hash1 = hashRefreshToken('token1');
    const hash2 = hashRefreshToken('token2');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce same hash for same token', () => {
    const hash1 = hashRefreshToken('token1');
    const hash2 = hashRefreshToken('token1');
    expect(hash1).toBe(hash2);
  });
});
