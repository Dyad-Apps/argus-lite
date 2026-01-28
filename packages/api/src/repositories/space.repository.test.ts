/**
 * Unit tests for SpaceRepository
 * Tests all CRUD operations and space-specific methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceRepository, type NewSpace, type Space } from './space.repository.js';
import * as baseRepository from './base.repository.js';
import { spaces } from '../db/schema/index.js';

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

describe('SpaceRepository', () => {
  let repository: SpaceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SpaceRepository();

    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockSpace()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockSpace()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockSpace()]),
            }),
          }),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockSpace()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'space-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new space', async () => {
      const newSpace: NewSpace = {
        name: 'Test Space',
        spaceTypeId: 'type-1',
        organizationId: 'org-1',
      };

      const result = await repository.create(newSpace);

      expect(mockExecutor.insert).toHaveBeenCalledWith(spaces);
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Space');
    });

    it('should create space with transaction', async () => {
      const newSpace: NewSpace = {
        name: 'Test Space',
        spaceTypeId: 'type-1',
        organizationId: 'org-1',
      };

      await repository.create(newSpace, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('createMany', () => {
    it('should create multiple spaces', async () => {
      const newSpaces: NewSpace[] = [
        { name: 'Space 1', spaceTypeId: 'type-1', organizationId: 'org-1' },
        { name: 'Space 2', spaceTypeId: 'type-1', organizationId: 'org-1' },
      ];

      mockExecutor.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockSpace(), createMockSpace({ id: 'space-2' })]),
        }),
      });

      const result = await repository.createMany(newSpaces);

      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.createMany([]);
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should find space by ID', async () => {
      const result = await repository.findById('space-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when space not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('nonexistent', 'org-1');
      expect(result).toBeNull();
    });
  });

  describe('findBySpaceType', () => {
    it('should find spaces by space type', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 5 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockSpace()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: dataMock,
            }),
          }),
        }),
      });

      const result = await repository.findBySpaceType('org-1', 'type-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('findChildren', () => {
    it('should find child spaces', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 2 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockSpace()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: dataMock,
            }),
          }),
        }),
      });

      const result = await repository.findChildren('org-1', 'parent-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('findRootSpaces', () => {
    it('should find root-level spaces', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockSpace()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: dataMock,
            }),
          }),
        }),
      });

      const result = await repository.findRootSpaces('org-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('findByFloorLevel', () => {
    it('should find spaces by floor level', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 4 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockSpace()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: dataMock,
            }),
          }),
        }),
      });

      const result = await repository.findByFloorLevel('org-1', 2);
      expect(result.data).toBeDefined();
    });
  });

  describe('findBySpaceCode', () => {
    it('should find space by space code', async () => {
      const result = await repository.findBySpaceCode('org-1', 'SPACE-001');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when space code not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findBySpaceCode('org-1', 'NOTFOUND');
      expect(result).toBeNull();
    });
  });

  describe('searchByName', () => {
    it('should search spaces by name', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockSpace()]),
        }),
      });

      const result = await repository.searchByName('org-1', 'test');
      expect(result).toBeDefined();
    });
  });

  describe('findNearby', () => {
    it('should find spaces within radius', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockSpace()]),
        }),
      });

      const result = await repository.findNearby('org-1', 40.7128, -74.006, 1000);
      expect(result).toBeDefined();
    });
  });

  describe('findContainingPoint', () => {
    it('should find spaces containing a point', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockSpace()]),
        }),
      });

      const result = await repository.findContainingPoint('org-1', 40.7128, -74.006);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update space by ID', async () => {
      const result = await repository.update('space-1', 'org-1', { name: 'Updated Space' });

      expect(mockExecutor.update).toHaveBeenCalledWith(spaces);
      expect(result).toBeDefined();
    });

    it('should return null when space not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('nonexistent', 'org-1', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a space', async () => {
      const result = await repository.softDelete('space-1', 'org-1');
      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should hard delete a space', async () => {
      const result = await repository.delete('space-1', 'org-1');
      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true when space exists', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.exists('space-1', 'org-1');
      expect(result).toBe(true);
    });
  });

  describe('count', () => {
    it('should count spaces in tenant', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      });

      const result = await repository.count('org-1');
      expect(result).toBe(42);
    });
  });

  describe('updateGeolocation', () => {
    it('should update space geolocation', async () => {
      const result = await repository.updateGeolocation('space-1', 'org-1', 40.7128, -74.006);
      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('updateGeofence', () => {
    it('should update space geofence', async () => {
      const coordinates: [number, number][] = [
        [-74.006, 40.7128],
        [-74.005, 40.7128],
        [-74.005, 40.7138],
        [-74.006, 40.7138],
      ];

      const result = await repository.updateGeofence('space-1', 'org-1', coordinates);
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

function createMockSpace(overrides?: Partial<Space>): Space {
  return {
    id: 'space-1',
    name: 'Test Space',
    spaceTypeId: 'type-1',
    organizationId: 'org-1',
    spaceCode: 'SPACE-001',
    parentSpaceId: null,
    floorLevel: null,
    geolocation: null,
    geofence: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
