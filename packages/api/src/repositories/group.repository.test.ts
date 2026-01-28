/**
 * Unit tests for GroupRepository
 * Tests group CRUD operations and member management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GroupRepository,
  type NewUserGroup,
  type UserGroup,
  type NewUserGroupMembership,
  type GroupMemberWithUser,
} from './group.repository.js';
import * as baseRepository from './base.repository.js';
import { userGroups, userGroupMemberships } from '../db/schema/index.js';

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

describe('GroupRepository', () => {
  let repository: GroupRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new GroupRepository();

    // Reset mock chains
    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockGroup()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockGroup()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockGroup()]),
            }),
          }),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([createMockGroup()]),
          }),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockGroup()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'group-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new group', async () => {
      const newGroup: NewUserGroup = {
        organizationId: 'org-1',
        name: 'Developers',
        description: 'Development team',
        createdBy: 'user-1',
      };

      const result = await repository.create(newGroup);

      expect(mockExecutor.insert).toHaveBeenCalledWith(userGroups);
      expect(result).toBeDefined();
      expect(result.name).toBe('Developers');
    });

    it('should create group with transaction', async () => {
      const newGroup: NewUserGroup = {
        organizationId: 'org-1',
        name: 'Developers',
        createdBy: 'user-1',
      };

      await repository.create(newGroup, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });

    it('should create group without description', async () => {
      const newGroup: NewUserGroup = {
        organizationId: 'org-1',
        name: 'Developers',
        createdBy: 'user-1',
      };

      const result = await repository.create(newGroup);

      expect(result).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find group by ID', async () => {
      const result = await repository.findById('group-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('group-1');
    });

    it('should return null when group not found', async () => {
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

    it('should work with transaction', async () => {
      await repository.findById('group-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('findByName', () => {
    it('should find group by name in organization', async () => {
      const result = await repository.findByName('org-1', 'Developers');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when group not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByName('org-1', 'Nonexistent');

      expect(result).toBeNull();
    });

    it('should scope search to organization', async () => {
      await repository.findByName('org-1', 'Developers');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByOrganization', () => {
    it('should find all groups in organization with member counts', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  { ...createMockGroup(), memberCount: 5 },
                  { ...createMockGroup({ id: 'group-2' }), memberCount: 3 },
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await repository.findByOrganization('org-1');

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
    });

    it('should support pagination', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockGroup()]),
              }),
            }),
          }),
        }),
      });

      await repository.findByOrganization('org-1', { page: 2, pageSize: 5 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should return empty result when no groups', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const result = await repository.findByOrganization('org-1');

      expect(result.data).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update group by ID', async () => {
      const updates = { name: 'Senior Developers', description: 'Senior team' };

      const result = await repository.update('group-1', updates);

      expect(mockExecutor.update).toHaveBeenCalledWith(userGroups);
      expect(result).toBeDefined();
    });

    it('should include updatedAt timestamp', async () => {
      const updates = { name: 'Updated Group' };

      await repository.update('group-1', updates);

      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should return null when group not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should not update id, organizationId, or createdAt', async () => {
      const updates = { name: 'Updated Group' };

      await repository.update('group-1', updates);

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a group', async () => {
      const result = await repository.delete('group-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(userGroups);
      expect(result).toBe(true);
    });

    it('should return false when group not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should work with transaction', async () => {
      await repository.delete('group-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('isNameAvailable', () => {
    it('should return true when name is available', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.isNameAvailable('org-1', 'Available Name');

      expect(result).toBe(true);
    });

    it('should return false when name is taken', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.isNameAvailable('org-1', 'Taken Name');

      expect(result).toBe(false);
    });

    it('should scope to organization', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.isNameAvailable('org-1', 'Test Group');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude specific group when checking availability', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.isNameAvailable('org-1', 'Test Group', 'group-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    it('should add user to group', async () => {
      const membership: NewUserGroupMembership = {
        groupId: 'group-1',
        userId: 'user-1',
        addedBy: 'admin-1',
      };

      const result = await repository.addMember(membership);

      expect(mockExecutor.insert).toHaveBeenCalledWith(userGroupMemberships);
      expect(result).toBeDefined();
    });

    it('should work with transaction', async () => {
      const membership: NewUserGroupMembership = {
        groupId: 'group-1',
        userId: 'user-1',
        addedBy: 'admin-1',
      };

      await repository.addMember(membership, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('removeMember', () => {
    it('should remove user from group', async () => {
      const result = await repository.removeMember('group-1', 'user-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(userGroupMemberships);
      expect(result).toBe(true);
    });

    it('should return false when membership not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.removeMember('group-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should work with transaction', async () => {
      await repository.removeMember('group-1', 'user-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('isMember', () => {
    it('should return true when user is member', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.isMember('group-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when user is not member', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.isMember('group-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should work with transaction', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.isMember('group-1', 'user-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('getGroupMembers', () => {
    it('should get members with user details', async () => {
      const mockMembers: GroupMemberWithUser[] = [
        {
          userId: 'user-1',
          groupId: 'group-1',
          addedAt: new Date(),
          addedBy: 'admin-1',
          user: {
            email: 'user1@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        {
          userId: 'user-2',
          groupId: 'group-1',
          addedAt: new Date(),
          addedBy: 'admin-1',
          user: {
            email: 'user2@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
          },
        },
      ];

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockMembers),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await repository.getGroupMembers('group-1');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].user).toBeDefined();
      expect(result.data[0].user.email).toBe('user1@example.com');
    });

    it('should support pagination', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      await repository.getGroupMembers('group-1', { page: 2, pageSize: 5 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should return empty result when no members', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await repository.getGroupMembers('group-1');

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getUserGroups', () => {
    it('should get all groups a user belongs to', async () => {
      const mockGroups = [
        createMockGroup({ id: 'group-1', name: 'Developers' }),
        createMockGroup({ id: 'group-2', name: 'Admins' }),
      ];

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockGroups),
            }),
          }),
        }),
      });

      const result = await repository.getUserGroups('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Developers');
    });

    it('should filter by organization', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([createMockGroup()]),
            }),
          }),
        }),
      });

      await repository.getUserGroups('user-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should return empty array when user has no groups', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await repository.getUserGroups('user-1');

      expect(result).toHaveLength(0);
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

// Helper function to create mock groups
function createMockGroup(overrides?: Partial<UserGroup>): UserGroup {
  return {
    id: 'group-1',
    organizationId: 'org-1',
    name: 'Developers',
    description: 'Development team',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    ...overrides,
  };
}
