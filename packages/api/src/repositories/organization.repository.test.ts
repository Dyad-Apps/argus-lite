/**
 * Unit tests for OrganizationRepository
 * Tests CRUD operations, hierarchy management, and organization-specific methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OrganizationRepository,
  type NewOrganization,
  type Organization,
} from './organization.repository.js';
import * as baseRepository from './base.repository.js';
import { organizations } from '../db/schema/index.js';

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

describe('OrganizationRepository', () => {
  let repository: OrganizationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new OrganizationRepository();

    // Reset mock chains
    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockOrganization()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockOrganization()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockOrganization()]),
            }),
          }),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockOrganization()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'org-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new organization', async () => {
      const newOrg: NewOrganization = {
        name: 'Test Org',
        slug: 'test-org',
        isActive: true,
      };

      mockExecutor.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockOrganization({ name: 'Test Org', slug: 'test-org' })]),
        }),
      });

      const result = await repository.create(newOrg);

      expect(mockExecutor.insert).toHaveBeenCalledWith(organizations);
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Org');
    });

    it('should create organization with transaction', async () => {
      const newOrg: NewOrganization = {
        name: 'Test Org',
        slug: 'test-org',
        isActive: true,
      };

      await repository.create(newOrg, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });

    it('should create root organization', async () => {
      const rootOrg: NewOrganization = {
        name: 'Root Org',
        slug: 'root-org',
        isRoot: true,
        depth: 0,
        subdomain: 'root-org',
        isActive: true,
      };

      const result = await repository.create(rootOrg);

      expect(result).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find organization by ID', async () => {
      const result = await repository.findById('org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('org-1');
    });

    it('should return null when organization not found', async () => {
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
      await repository.findById('org-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('findBySlug', () => {
    it('should find organization by slug', async () => {
      const result = await repository.findBySlug('test-org');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should normalize slug to lowercase', async () => {
      await repository.findBySlug('TEST-ORG');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should return null when slug not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all organizations with default pagination', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockOrganization()]),
              }),
            }),
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
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 100 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockOrganization()]),
              }),
            }),
          }),
        }),
      });

      await repository.findAll({ page: 2, pageSize: 10 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should filter by active status', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockOrganization()]),
              }),
            }),
          }),
        }),
      });

      await repository.findAll({ activeOnly: true });

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update organization by ID', async () => {
      const updates = { name: 'Updated Org', description: 'New description' };

      const result = await repository.update('org-1', updates);

      expect(mockExecutor.update).toHaveBeenCalledWith(organizations);
      expect(result).toBeDefined();
    });

    it('should include updatedAt timestamp', async () => {
      const updates = { name: 'Updated Org' };

      await repository.update('org-1', updates);

      expect(mockExecutor.update).toHaveBeenCalled();
    });

    it('should return null when organization not found', async () => {
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

    it('should not update slug, id, or createdAt', async () => {
      const updates = { name: 'Updated Org' };

      await repository.update('org-1', updates);

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should hard delete an organization', async () => {
      const result = await repository.delete('org-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(organizations);
      expect(result).toBe(true);
    });

    it('should return false when organization not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should work with transaction', async () => {
      await repository.delete('org-1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('isSlugAvailable', () => {
    it('should return true when slug is available', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.isSlugAvailable('available-slug');

      expect(result).toBe(true);
    });

    it('should return false when slug is taken', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.isSlugAvailable('taken-slug');

      expect(result).toBe(false);
    });

    it('should normalize slug to lowercase', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.isSlugAvailable('TEST-SLUG');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('getChildren', () => {
    it('should get direct children of an organization', async () => {
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
                  createMockOrganization({ id: 'child-1' }),
                  createMockOrganization({ id: 'child-2' }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await repository.getChildren('parent-1');

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
    });

    it('should return empty array when no children', async () => {
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

      const result = await repository.getChildren('parent-1');

      expect(result.data).toHaveLength(0);
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
                offset: vi.fn().mockResolvedValue([createMockOrganization()]),
              }),
            }),
          }),
        }),
      });

      await repository.getChildren('parent-1', { page: 2, pageSize: 5 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('getDescendants', () => {
    it('should get all descendants of an organization', async () => {
      const parent = createMockOrganization({ path: 'root.parent' });

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([parent]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              createMockOrganization({ id: 'child-1' }),
              createMockOrganization({ id: 'grandchild-1' }),
            ]),
          }),
        }),
      });

      const result = await repository.getDescendants('parent-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when organization not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.getDescendants('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no path', async () => {
      const org = createMockOrganization({ path: null });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([org]),
          }),
        }),
      });

      const result = await repository.getDescendants('org-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAncestors', () => {
    it('should get all ancestors of an organization', async () => {
      const child = createMockOrganization({ path: 'root.parent.child' });

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([child]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              createMockOrganization({ id: 'root' }),
              createMockOrganization({ id: 'parent' }),
            ]),
          }),
        }),
      });

      const result = await repository.getAncestors('child-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when organization not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.getAncestors('nonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('getHierarchyTree', () => {
    it('should get full hierarchy tree from root', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              createMockOrganization({ id: 'root', depth: 0 }),
              createMockOrganization({ id: 'child', depth: 1 }),
              createMockOrganization({ id: 'grandchild', depth: 2 }),
            ]),
          }),
        }),
      });

      const result = await repository.getHierarchyTree('root-1');

      expect(result).toHaveLength(3);
    });

    it('should order by depth and name', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repository.getHierarchyTree('root-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('createChild', () => {
    it('should create a child organization', async () => {
      const parent = createMockOrganization({
        id: 'parent-1',
        depth: 0,
        path: 'parent',
        canHaveChildren: true,
        rootOrganizationId: 'root-1',
      });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([parent]),
          }),
        }),
      });

      const childData: Omit<
        NewOrganization,
        'parentOrganizationId' | 'rootOrganizationId' | 'isRoot' | 'depth'
      > = {
        name: 'Child Org',
        slug: 'child-org',
        isActive: true,
      };

      const result = await repository.createChild('parent-1', childData);

      expect(mockExecutor.insert).toHaveBeenCalledWith(organizations);
      expect(result).toBeDefined();
    });

    it('should throw error when parent not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const childData: Omit<
        NewOrganization,
        'parentOrganizationId' | 'rootOrganizationId' | 'isRoot' | 'depth'
      > = {
        name: 'Child Org',
        slug: 'child-org',
        isActive: true,
      };

      await expect(repository.createChild('nonexistent', childData)).rejects.toThrow(
        'Parent organization not found'
      );
    });

    it('should throw error when parent cannot have children', async () => {
      const parent = createMockOrganization({
        canHaveChildren: false,
      });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([parent]),
          }),
        }),
      });

      const childData: Omit<
        NewOrganization,
        'parentOrganizationId' | 'rootOrganizationId' | 'isRoot' | 'depth'
      > = {
        name: 'Child Org',
        slug: 'child-org',
        isActive: true,
      };

      await expect(repository.createChild('parent-1', childData)).rejects.toThrow(
        'Parent organization cannot have children'
      );
    });

    it('should calculate child depth correctly', async () => {
      const parent = createMockOrganization({
        depth: 2,
        canHaveChildren: true,
        path: 'root.parent',
      });

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([parent]),
          }),
        }),
      });

      const childData: Omit<
        NewOrganization,
        'parentOrganizationId' | 'rootOrganizationId' | 'isRoot' | 'depth'
      > = {
        name: 'Child Org',
        slug: 'child-org',
        isActive: true,
      };

      await repository.createChild('parent-1', childData);

      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('findBySubdomain', () => {
    it('should find organization by subdomain', async () => {
      const result = await repository.findBySubdomain('test-org');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should normalize subdomain to lowercase', async () => {
      await repository.findBySubdomain('TEST-ORG');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should only return root organizations', async () => {
      await repository.findBySubdomain('test-org');

      expect(mockExecutor.select).toHaveBeenCalled();
      // The where clause should include isRoot: true
    });

    it('should return null when subdomain not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findBySubdomain('nonexistent');

      expect(result).toBeNull();
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

// Helper function to create mock organizations
function createMockOrganization(overrides?: Partial<Organization>): Organization {
  return {
    id: 'org-1',
    name: 'Test Organization',
    slug: 'test-org',
    description: null,
    subdomain: null,
    isRoot: false,
    isActive: true,
    parentOrganizationId: null,
    rootOrganizationId: null,
    depth: 0,
    path: null,
    canHaveChildren: true,
    maxDepth: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
