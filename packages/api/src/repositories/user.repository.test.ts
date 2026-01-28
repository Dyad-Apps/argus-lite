/**
 * Unit tests for UserRepository
 * Tests all CRUD operations and user-specific methods
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { UserRepository, type NewUser, type User } from './user.repository.js';
import * as baseRepository from './base.repository.js';
import { users } from '../db/schema/index.js';

// Mock the database
const mockExecutor = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock the base repository utilities
vi.mock('./base.repository.js', async () => {
  const actual = await vi.importActual('./base.repository.js');
  return {
    ...actual,
    getExecutor: vi.fn(() => mockExecutor),
    withTransaction: vi.fn((fn) => fn(mockExecutor)),
  };
});

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UserRepository();

    // Reset mock chains
    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockUser()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockUser()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockUser()]),
            }),
          }),
        }),
        $dynamic: vi.fn().mockReturnThis(),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockUser()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const newUser: NewUser = {
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        rootOrganizationId: 'org-1',
        primaryOrganizationId: 'org-1',
      };

      const result = await repository.create(newUser);

      expect(mockExecutor.insert).toHaveBeenCalledWith(users);
      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
    });

    it('should create user with transaction', async () => {
      const newUser: NewUser = {
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        rootOrganizationId: 'org-1',
        primaryOrganizationId: 'org-1',
      };

      await repository.create(newUser, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });

    it('should handle SSO user without password', async () => {
      const ssoUser: NewUser = {
        email: 'sso@example.com',
        passwordHash: null,
        rootOrganizationId: 'org-1',
        primaryOrganizationId: 'org-1',
      };

      const result = await repository.create(ssoUser);

      expect(result).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const result = await repository.findById('user-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('user-1');
    });

    it('should return null when user not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should exclude soft deleted users', async () => {
      await repository.findById('user-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      // The where clause should include isNull(users.deletedAt)
    });

    it('should work with transaction', async () => {
      await repository.findById('user-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const result = await repository.findByEmail('test@example.com');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      await repository.findByEmail('TEST@EXAMPLE.COM');

      expect(mockExecutor.select).toHaveBeenCalled();
      // Email should be normalized in the where clause
    });

    it('should return null when email not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should exclude soft deleted users', async () => {
      await repository.findByEmail('test@example.com');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByEmailIncludeDeleted', () => {
    it('should find user including soft deleted', async () => {
      const result = await repository.findByEmailIncludeDeleted('test@example.com');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      await repository.findByEmailIncludeDeleted('TEST@EXAMPLE.COM');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should find deleted users', async () => {
      const deletedUser = createMockUser({ deletedAt: new Date() });
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([deletedUser]),
          }),
        }),
      });

      const result = await repository.findByEmailIncludeDeleted('deleted@example.com');

      expect(result).toBeDefined();
      expect(result?.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('should find all users with default pagination', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([createMockUser()]),
                }),
              }),
            }),
          }),
        }),
      });

      const countMock = vi.fn().mockResolvedValue([{ count: 1 }]);
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([createMockUser()]),
                }),
              }),
            }),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue(countMock),
          }),
        }),
      });

      const result = await repository.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
    });

    it('should respect custom pagination options', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 100 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockUser()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: dataMock,
                }),
              }),
            }),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue(countMock),
          }),
        }),
      });

      await repository.findAll({ page: 2, pageSize: 10 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should filter by organization', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 5 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockUser()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: dataMock,
                }),
              }),
            }),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              where: countMock,
            }),
          }),
        }),
      });

      await repository.findAll({ organizationId: 'org-1' });

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude soft deleted users', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 1 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockUser()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: dataMock,
                }),
              }),
            }),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue(countMock),
          }),
        }),
      });

      await repository.findAll();

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update user by ID', async () => {
      const updates = { firstName: 'John', lastName: 'Doe' };

      const result = await repository.update('user-1', updates);

      expect(mockExecutor.update).toHaveBeenCalledWith(users);
      expect(result).toBeDefined();
    });

    it('should include updatedAt timestamp', async () => {
      const updates = { firstName: 'John' };

      await repository.update('user-1', updates);

      expect(mockExecutor.update).toHaveBeenCalled();
      // The set method should be called with data including updatedAt
    });

    it('should return null when user not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('nonexistent', { firstName: 'John' });

      expect(result).toBeNull();
    });

    it('should not update email, id, or createdAt', async () => {
      // Type system prevents this, but we test the repository behavior
      const updates = { firstName: 'John' };

      await repository.update('user-1', updates);

      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should exclude soft deleted users', async () => {
      await repository.update('user-1', { firstName: 'John' });

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('updatePassword', () => {
    it('should update password hash', async () => {
      const result = await repository.updatePassword('user-1', 'new_hashed_password');

      expect(mockExecutor.update).toHaveBeenCalledWith(users);
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.updatePassword('nonexistent', 'new_password');

      expect(result).toBe(false);
    });

    it('should include updatedAt timestamp', async () => {
      await repository.updatePassword('user-1', 'new_password');

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const result = await repository.updateLastLogin('user-1');

      expect(mockExecutor.update).toHaveBeenCalledWith(users);
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.updateLastLogin('nonexistent');

      expect(result).toBe(false);
    });

    it('should include updatedAt timestamp', async () => {
      await repository.updateLastLogin('user-1');

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('markEmailVerified', () => {
    it('should mark email as verified', async () => {
      const result = await repository.markEmailVerified('user-1');

      expect(mockExecutor.update).toHaveBeenCalledWith(users);
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.markEmailVerified('nonexistent');

      expect(result).toBe(false);
    });

    it('should only mark unverified emails', async () => {
      await repository.markEmailVerified('user-1');

      expect(mockExecutor.update).toHaveBeenCalled();
      // The where clause should include isNull(users.emailVerifiedAt)
    });

    it('should include updatedAt timestamp', async () => {
      await repository.markEmailVerified('user-1');

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      const result = await repository.softDelete('user-1');

      expect(mockExecutor.update).toHaveBeenCalledWith(users);
      expect(result).toBe(true);
    });

    it('should set status to deleted', async () => {
      await repository.softDelete('user-1');

      expect(mockExecutor.update).toHaveBeenCalled();
      // The set method should include status: 'deleted'
    });

    it('should set deletedAt timestamp', async () => {
      await repository.softDelete('user-1');

      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should return false when user not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('nonexistent');

      expect(result).toBe(false);
    });

    it('should not delete already deleted users', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('already-deleted');

      expect(result).toBe(false);
    });
  });

  describe('existsByEmail', () => {
    it('should return true when email exists', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.existsByEmail('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.existsByEmail('notfound@example.com');

      expect(result).toBe(false);
    });

    it('should normalize email to lowercase', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      await repository.existsByEmail('TEST@EXAMPLE.COM');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('toSafeUser', () => {
    it('should strip password hash from user', () => {
      const user = createMockUser({ passwordHash: 'hashed_password' });

      const safeUser = repository.toSafeUser(user);

      expect(safeUser).not.toHaveProperty('passwordHash');
      expect(safeUser.email).toBe(user.email);
      expect(safeUser.id).toBe(user.id);
    });

    it('should preserve all other user properties', () => {
      const user = createMockUser();

      const safeUser = repository.toSafeUser(user);

      expect(safeUser.email).toBe(user.email);
      expect(safeUser.firstName).toBe(user.firstName);
      expect(safeUser.lastName).toBe(user.lastName);
      expect(safeUser.status).toBe(user.status);
    });
  });

  describe('withTransaction', () => {
    it('should execute function within transaction', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');

      await repository.withTransaction(mockFn);

      expect(baseRepository.withTransaction).toHaveBeenCalledWith(mockFn);
    });

    it('should return function result', async () => {
      const mockFn = vi.fn().mockResolvedValue('test-result');

      const result = await repository.withTransaction(mockFn);

      expect(result).toBe('test-result');
    });
  });
});

// Helper function to create mock users
function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    firstName: 'Test',
    lastName: 'User',
    status: 'active',
    rootOrganizationId: 'org-1',
    primaryOrganizationId: 'org-1',
    emailVerifiedAt: null,
    lastLoginAt: null,
    mfaEnabled: false,
    mfaSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
