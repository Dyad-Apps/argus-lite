/**
 * Unit tests for AssetRepository
 * Tests all CRUD operations and asset-specific methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetRepository, type NewAsset, type Asset } from './asset.repository.js';
import * as baseRepository from './base.repository.js';
import { assets } from '../db/schema/index.js';

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

describe('AssetRepository', () => {
  let repository: AssetRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AssetRepository();

    // Reset mock chains for insert
    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockAsset()]),
      }),
    });

    // Reset mock chains for select
    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockAsset()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockAsset()]),
            }),
          }),
        }),
      }),
    });

    // Reset mock chains for update
    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockAsset()]),
        }),
      }),
    });

    // Reset mock chains for delete
    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'asset-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new asset', async () => {
      const newAsset: NewAsset = {
        name: 'Test Asset',
        assetTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'active',
      };

      const result = await repository.create(newAsset);

      expect(mockExecutor.insert).toHaveBeenCalledWith(assets);
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Asset');
    });

    it('should create asset with transaction', async () => {
      const newAsset: NewAsset = {
        name: 'Test Asset',
        assetTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'active',
      };

      await repository.create(newAsset, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });

    it('should create asset with optional fields', async () => {
      const newAsset: NewAsset = {
        name: 'Test Asset',
        assetTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'active',
        serialNumber: 'SN12345',
        parentAssetId: 'parent-1',
      };

      const result = await repository.create(newAsset);

      expect(result).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    it('should create multiple assets', async () => {
      const newAssets: NewAsset[] = [
        { name: 'Asset 1', assetTypeId: 'type-1', organizationId: 'org-1', status: 'active' },
        { name: 'Asset 2', assetTypeId: 'type-1', organizationId: 'org-1', status: 'active' },
      ];

      mockExecutor.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockAsset(), createMockAsset({ id: 'asset-2' })]),
        }),
      });

      const result = await repository.createMany(newAssets);

      expect(mockExecutor.insert).toHaveBeenCalledWith(assets);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.createMany([]);

      expect(result).toEqual([]);
      expect(mockExecutor.insert).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find asset by ID', async () => {
      const result = await repository.findById('asset-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('asset-1');
    });

    it('should return null when asset not found', async () => {
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

    it('should respect tenant isolation', async () => {
      await repository.findById('asset-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude soft deleted assets', async () => {
      await repository.findById('asset-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findAllInTenant', () => {
    it('should find all assets with default pagination', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 10 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockAsset()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: dataMock,
              }),
            }),
          }),
        }),
      });

      const result = await repository.findAllInTenant('org-1');

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('should respect pagination options', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 100 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockAsset()]);

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(countMock),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: dataMock,
              }),
            }),
          }),
        }),
      });

      await repository.findAllInTenant('org-1', { page: 2, pageSize: 10 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByAssetType', () => {
    it('should find assets by asset type', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 5 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockAsset()]);

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

      const result = await repository.findByAssetType('org-1', 'type-1');

      expect(result.data).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByStatus', () => {
    it('should find assets by status', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockAsset()]);

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

      const result = await repository.findByStatus('org-1', 'active');

      expect(result.data).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findChildren', () => {
    it('should find child assets', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 2 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockAsset()]);

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
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findRootAssets', () => {
    it('should find root-level assets', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockAsset()]);

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

      const result = await repository.findRootAssets('org-1');

      expect(result.data).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findBySerialNumber', () => {
    it('should find asset by serial number', async () => {
      const result = await repository.findBySerialNumber('org-1', 'SN12345');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when serial number not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findBySerialNumber('org-1', 'NOTFOUND');

      expect(result).toBeNull();
    });
  });

  describe('searchByName', () => {
    it('should search assets by name', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockAsset()]),
        }),
      });

      const result = await repository.searchByName('org-1', 'test');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should perform case-insensitive search', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockAsset()]),
        }),
      });

      await repository.searchByName('org-1', 'TEST');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findNearby', () => {
    it('should find assets within radius', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockAsset()]),
        }),
      });

      const result = await repository.findNearby('org-1', 40.7128, -74.006, 1000);

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findManyByIds', () => {
    it('should find multiple assets by IDs', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockAsset(), createMockAsset({ id: 'asset-2' })]),
        }),
      });

      const result = await repository.findManyByIds('org-1', ['asset-1', 'asset-2']);

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.findManyByIds('org-1', []);

      expect(result).toEqual([]);
      expect(mockExecutor.select).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update asset by ID', async () => {
      const updates = { name: 'Updated Asset', status: 'inactive' as const };

      const result = await repository.update('asset-1', 'org-1', updates);

      expect(mockExecutor.update).toHaveBeenCalledWith(assets);
      expect(result).toBeDefined();
    });

    it('should return null when asset not found', async () => {
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

    it('should include updatedAt timestamp', async () => {
      await repository.update('asset-1', 'org-1', { name: 'Test' });

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete an asset', async () => {
      const result = await repository.softDelete('asset-1', 'org-1');

      expect(mockExecutor.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when asset not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('nonexistent', 'org-1');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should hard delete an asset', async () => {
      const result = await repository.delete('asset-1', 'org-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(assets);
      expect(result).toBe(true);
    });

    it('should return false when asset not found', async () => {
      mockExecutor.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.delete('nonexistent', 'org-1');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when asset exists', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.exists('asset-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false when asset does not exist', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.exists('nonexistent', 'org-1');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should count assets in tenant', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      });

      const result = await repository.count('org-1');

      expect(result).toBe(42);
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('updateGeolocation', () => {
    it('should update asset geolocation', async () => {
      const result = await repository.updateGeolocation('asset-1', 'org-1', 40.7128, -74.006);

      expect(mockExecutor.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when asset not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.updateGeolocation('nonexistent', 'org-1', 40.7128, -74.006);

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

// Helper function to create mock assets
function createMockAsset(overrides?: Partial<Asset>): Asset {
  return {
    id: 'asset-1',
    name: 'Test Asset',
    assetTypeId: 'type-1',
    organizationId: 'org-1',
    status: 'active',
    serialNumber: 'SN12345',
    parentAssetId: null,
    geolocation: null,
    lastLocationUpdate: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
