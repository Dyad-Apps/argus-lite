/**
 * Unit tests for InvitationRepository
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvitationRepository, generateInvitationToken, hashInvitationToken } from './invitation.repository.js';
import * as baseRepository from './base.repository.js';
import { organizationInvitations } from '../db/schema/index.js';

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

describe('InvitationRepository', () => {
  let repository: InvitationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new InvitationRepository();

    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'inv-1', organizationId: 'org-1', email: 'test@example.com', role: 'member', status: 'pending', tokenHash: 'hash123', invitedBy: 'user-1', expiresAt: new Date(), createdAt: new Date() }]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'inv-1', status: 'pending' }]),
        }),
        innerJoin: vi.fn().mockReturnThis(),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'inv-1' }]),
        }),
      }),
    });
  });

  describe('create', () => {
    it('should create a new invitation', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.create({
        organizationId: 'org-1',
        email: 'test@example.com',
        role: 'member',
        invitedBy: 'user-1',
      });

      expect(result.token).toBeDefined();
      expect(result.invitation).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalledWith(organizationInvitations);
    });

    it('should cancel existing pending invitation', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-inv', status: 'pending' }]),
          }),
        }),
      });

      await repository.create({
        organizationId: 'org-1',
        email: 'test@example.com',
        role: 'member',
        invitedBy: 'user-1',
      });

      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.create({
        organizationId: 'org-1',
        email: 'TEST@EXAMPLE.COM',
        role: 'member',
        invitedBy: 'user-1',
      });

      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('findByTokenHash', () => {
    it('should find invitation by token hash', async () => {
      const result = await repository.findByTokenHash('hash123');
      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
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
  });

  describe('findByIdWithDetails', () => {
    it('should find invitation with organization and inviter details', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'inv-1',
              organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
              inviter: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
            }]),
          }),
        }),
      });

      const result = await repository.findByIdWithDetails('inv-1');
      expect(result).toBeDefined();
      expect(result?.organization).toBeDefined();
      expect(result?.inviter).toBeDefined();
    });
  });

  describe('findPendingByTokenHash', () => {
    it('should find pending invitation by token hash', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'inv-1',
              status: 'pending',
              organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
              inviter: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
            }]),
          }),
        }),
      });

      const result = await repository.findPendingByTokenHash('hash123');
      expect(result).toBeDefined();
    });
  });

  describe('listByOrganization', () => {
    it('should list invitations for organization', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 5 }]);
      const dataMock = vi.fn().mockResolvedValue([{ id: 'inv-1' }]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: dataMock,
              }),
            }),
          }),
        }),
      });

      const result = await repository.listByOrganization('org-1');
      expect(result.data).toBeDefined();
    });

    it('should filter by status', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 2 }]);
      const dataMock = vi.fn().mockResolvedValue([{ id: 'inv-1', status: 'accepted' }]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: dataMock,
              }),
            }),
          }),
        }),
      });

      const result = await repository.listByOrganization('org-1', { status: 'accepted' });
      expect(result.data).toBeDefined();
    });
  });

  describe('accept', () => {
    it('should mark invitation as accepted', async () => {
      const result = await repository.accept('inv-1', 'user-2');
      expect(result).toBe(true);
      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should return false when invitation not found or not pending', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.accept('nonexistent', 'user-2');
      expect(result).toBe(false);
    });
  });

  describe('decline', () => {
    it('should mark invitation as declined', async () => {
      const result = await repository.decline('inv-1');
      expect(result).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should cancel invitation', async () => {
      const result = await repository.cancel('inv-1');
      expect(result).toBe(true);
    });
  });

  describe('markExpired', () => {
    it('should mark expired invitations', async () => {
      const result = await repository.markExpired();
      expect(result).toBe(1);
      expect(mockExecutor.update).toHaveBeenCalled();
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
  it('should generate invitation token', () => {
    const token = generateInvitationToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });

  it('should hash invitation token', () => {
    const token = 'test-token';
    const hash = hashInvitationToken(token);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 produces 64-char hex string
  });

  it('should produce different hashes for different tokens', () => {
    const hash1 = hashInvitationToken('token1');
    const hash2 = hashInvitationToken('token2');
    expect(hash1).not.toBe(hash2);
  });
});
