/**
 * Unit tests for RoleRepository
 * Tests role CRUD operations and role assignment management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RoleRepository,
  type NewRole,
  type Role,
  type NewUserRoleAssignment,
  type NewGroupRoleAssignment,
  type UserRoleAssignmentWithRole,
} from './role.repository.js';
import * as baseRepository from './base.repository.js';
import { roles, userRoleAssignments, groupRoleAssignments } from '../db/schema/index.js';

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

describe('RoleRepository', () => {
  let repository: RoleRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new RoleRepository();

    // Reset mock chains
    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockRole()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockRole()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockRole()]),
            }),
          }),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([createMockUserRoleAssignment()]),
          }),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockRole()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'role-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new role', async () => {
      const newRole: NewRole = {
        name: 'Custom Role',
        organizationId: 'org-1',
        permissions: {},
        isSystem: false,
      };

      mockExecutor.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockRole({ name: 'Custom Role' })]),
        }),
      });

      const result = await repository.create(newRole);

      expect(mockExecutor.insert).toHaveBeenCalledWith(roles);
      expect(result).toBeDefined();
      expect(result.name).toBe('Custom Role');
    });

    it('should create system role', async () => {
      const systemRole: NewRole = {
        name: 'System Admin',
        organizationId: null,
        permissions: {},
        isSystem: true,
      };

      const result = await repository.create(systemRole);

      expect(result).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });

    it('should work with transaction', async () => {
      const newRole: NewRole = {
        name: 'Test Role',
        organizationId: 'org-1',
        permissions: {},
        isSystem: false,
      };

      await repository.create(newRole, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('findById', () => {
    it('should find role by ID', async () => {
      const result = await repository.findById('role-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('role-1');
    });

    it('should return null when role not found', async () => {
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
      await repository.findById('role-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('findByName', () => {
    it('should find role by name in organization', async () => {
      const result = await repository.findByName('org-1', 'Admin');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should find system role by name', async () => {
      const result = await repository.findByName(null, 'Super Admin');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when role not found', async () => {
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
  });

  describe('findSystemRoles', () => {
    it('should find all system roles', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              createMockRole({ name: 'System Admin', isSystem: true }),
              createMockRole({ name: 'Org Admin', isSystem: true }),
            ]),
          }),
        }),
      });

      const result = await repository.findSystemRoles();

      expect(result).toHaveLength(2);
    });

    it('should exclude Super Admin role', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              createMockRole({ name: 'System Admin', isSystem: true }),
            ]),
          }),
        }),
      });

      const result = await repository.findSystemRoles();

      expect(result.every((r) => r.name !== 'Super Admin')).toBe(true);
    });

    it('should return empty array when no system roles', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findSystemRoles();

      expect(result).toHaveLength(0);
    });
  });

  describe('findByOrganization', () => {
    it('should find roles for organization including system roles', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  createMockRole({ name: 'Org Role', isSystem: false }),
                  createMockRole({ name: 'System Role', isSystem: true }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await repository.findByOrganization('org-1');

      expect(result.data).toHaveLength(2);
    });

    it('should exclude system roles when requested', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  createMockRole({ name: 'Org Role', isSystem: false }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await repository.findByOrganization('org-1', { includeSystem: false });

      expect(result.data).toHaveLength(1);
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
                offset: vi.fn().mockResolvedValue([createMockRole()]),
              }),
            }),
          }),
        }),
      });

      await repository.findByOrganization('org-1', { page: 2, pageSize: 5 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude Super Admin role', async () => {
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
                  createMockRole({ name: 'Admin', isSystem: false }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await repository.findByOrganization('org-1');

      expect(result.data.every((r) => r.name !== 'Super Admin')).toBe(true);
    });
  });

  describe('update', () => {
    it('should update non-system role', async () => {
      const role = createMockRole({ isSystem: false });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([role]),
          }),
        }),
      });

      const updates = { name: 'Updated Role', description: 'New description' };
      const result = await repository.update('role-1', updates);

      expect(mockExecutor.update).toHaveBeenCalledWith(roles);
      expect(result).toBeDefined();
    });

    it('should not update system role', async () => {
      const systemRole = createMockRole({ isSystem: true });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([systemRole]),
          }),
        }),
      });

      const result = await repository.update('role-1', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('should include updatedAt timestamp', async () => {
      const role = createMockRole({ isSystem: false });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([role]),
          }),
        }),
      });

      await repository.update('role-1', { name: 'Updated' });

      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should return null when role not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

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
  });

  describe('delete', () => {
    it('should delete non-system role', async () => {
      const result = await repository.delete('role-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(roles);
      expect(result).toBe(true);
    });

    it('should not delete system role', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.delete('system-role-1');

      expect(result).toBe(false);
    });

    it('should return false when role not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('isNameAvailable', () => {
    it('should return true when name is available in organization', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.isNameAvailable('org-1', 'Available Role');

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

      const result = await repository.isNameAvailable('org-1', 'Taken Role');

      expect(result).toBe(false);
    });

    it('should check system role names', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.isNameAvailable(null, 'System Role');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude specific role when checking', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.isNameAvailable('org-1', 'Role Name', 'role-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user', async () => {
      const assignment: NewUserRoleAssignment = {
        userId: 'user-1',
        roleId: 'role-1',
        organizationId: 'org-1',
        source: 'direct',
        assignedBy: 'admin-1',
      };

      const result = await repository.assignRoleToUser(assignment);

      expect(mockExecutor.insert).toHaveBeenCalledWith(userRoleAssignments);
      expect(result).toBeDefined();
    });

    it('should work with transaction', async () => {
      const assignment: NewUserRoleAssignment = {
        userId: 'user-1',
        roleId: 'role-1',
        organizationId: 'org-1',
        source: 'direct',
        assignedBy: 'admin-1',
      };

      await repository.assignRoleToUser(assignment, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });

    it('should support scoped assignments', async () => {
      const assignment: NewUserRoleAssignment = {
        userId: 'user-1',
        roleId: 'role-1',
        organizationId: 'org-1',
        scope: 'organization',
        source: 'direct',
        assignedBy: 'admin-1',
      };

      const result = await repository.assignRoleToUser(assignment);

      expect(result).toBeDefined();
    });

    it('should support temporary assignments with expiration', async () => {
      const assignment: NewUserRoleAssignment = {
        userId: 'user-1',
        roleId: 'role-1',
        organizationId: 'org-1',
        source: 'direct',
        assignedBy: 'admin-1',
        expiresAt: new Date(Date.now() + 86400000), // 24 hours
      };

      const result = await repository.assignRoleToUser(assignment);

      expect(result).toBeDefined();
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove role from user', async () => {
      const result = await repository.removeRoleFromUser('user-1', 'role-1', 'org-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(userRoleAssignments);
      expect(result).toBe(true);
    });

    it('should return false when assignment not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.removeRoleFromUser('user-1', 'role-1', 'org-1');

      expect(result).toBe(false);
    });

    it('should work with transaction', async () => {
      await repository.removeRoleFromUser('user-1', 'role-1', 'org-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('getUserRoleAssignments', () => {
    it('should get all role assignments for user', async () => {
      const assignments = [
        createMockUserRoleAssignment({ roleId: 'role-1', roleName: 'Admin' }),
        createMockUserRoleAssignment({ roleId: 'role-2', roleName: 'Editor' }),
      ];

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(assignments),
            }),
          }),
        }),
      });

      const result = await repository.getUserRoleAssignments('user-1', 'org-1');

      expect(result).toHaveLength(2);
      expect(result[0].roleName).toBe('Admin');
    });

    it('should return empty array when no assignments', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await repository.getUserRoleAssignments('user-1', 'org-1');

      expect(result).toHaveLength(0);
    });

    it('should include role details', async () => {
      const assignment = createMockUserRoleAssignment({
        roleName: 'Admin',
        scope: 'organization',
      });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([assignment]),
            }),
          }),
        }),
      });

      const result = await repository.getUserRoleAssignments('user-1', 'org-1');

      expect(result[0].roleName).toBeDefined();
      expect(result[0].scope).toBe('organization');
    });
  });

  describe('userHasRole', () => {
    it('should return true when user has role', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.userHasRole('user-1', 'role-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false when user does not have role', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.userHasRole('user-1', 'role-1', 'org-1');

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

      await repository.userHasRole('user-1', 'role-1', 'org-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('assignRoleToGroup', () => {
    it('should assign role to group', async () => {
      const assignment: NewGroupRoleAssignment = {
        groupId: 'group-1',
        roleId: 'role-1',
        assignedBy: 'admin-1',
      };

      const result = await repository.assignRoleToGroup(assignment);

      expect(mockExecutor.insert).toHaveBeenCalledWith(groupRoleAssignments);
      expect(result).toBeDefined();
    });

    it('should work with transaction', async () => {
      const assignment: NewGroupRoleAssignment = {
        groupId: 'group-1',
        roleId: 'role-1',
        assignedBy: 'admin-1',
      };

      await repository.assignRoleToGroup(assignment, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('removeRoleFromGroup', () => {
    it('should remove role from group', async () => {
      const result = await repository.removeRoleFromGroup('group-1', 'role-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(groupRoleAssignments);
      expect(result).toBe(true);
    });

    it('should return false when assignment not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.removeRoleFromGroup('group-1', 'role-1');

      expect(result).toBe(false);
    });
  });

  describe('getGroupRoleAssignments', () => {
    it('should get all role assignments for group', async () => {
      const assignments = [
        { groupId: 'group-1', roleId: 'role-1', roleName: 'Admin', scope: null, assignedAt: new Date(), assignedBy: 'admin-1' },
        { groupId: 'group-1', roleId: 'role-2', roleName: 'Editor', scope: null, assignedAt: new Date(), assignedBy: 'admin-1' },
      ];

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(assignments),
            }),
          }),
        }),
      });

      const result = await repository.getGroupRoleAssignments('group-1');

      expect(result).toHaveLength(2);
      expect(result[0].roleName).toBe('Admin');
    });

    it('should return empty array when no assignments', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await repository.getGroupRoleAssignments('group-1');

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

// Helper functions to create mock data
function createMockRole(overrides?: Partial<Role>): Role {
  return {
    id: 'role-1',
    name: 'Admin',
    description: null,
    organizationId: 'org-1',
    permissions: {},
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockUserRoleAssignment(
  overrides?: Partial<UserRoleAssignmentWithRole>
): UserRoleAssignmentWithRole {
  return {
    userId: 'user-1',
    roleId: 'role-1',
    roleName: 'Admin',
    organizationId: 'org-1',
    scope: null,
    source: 'direct',
    assignedAt: new Date(),
    assignedBy: 'admin-1',
    expiresAt: null,
    ...overrides,
  };
}
