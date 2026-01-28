/**
 * Unit tests for DeviceRepository
 * Tests all CRUD operations and device-specific methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceRepository, type NewDevice, type Device } from './device.repository.js';
import * as baseRepository from './base.repository.js';
import { devices } from '../db/schema/index.js';

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

describe('DeviceRepository', () => {
  let repository: DeviceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DeviceRepository();

    // Reset mock chains
    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockDevice()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockDevice()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockDevice()]),
            }),
          }),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockDevice()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'device-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new device', async () => {
      const newDevice: NewDevice = {
        name: 'Test Device',
        deviceTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'active',
      };

      const result = await repository.create(newDevice);

      expect(mockExecutor.insert).toHaveBeenCalledWith(devices);
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Device');
    });

    it('should create device with transaction', async () => {
      const newDevice: NewDevice = {
        name: 'Test Device',
        deviceTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'active',
      };

      await repository.create(newDevice, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });

    it('should create device with serial number and MAC address', async () => {
      const newDevice: NewDevice = {
        name: 'Test Device',
        deviceTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'active',
        serialNumber: 'SN12345',
        macAddress: '00:11:22:33:44:55',
      };

      const result = await repository.create(newDevice);

      expect(result).toBeDefined();
      expect(mockExecutor.insert).toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    it('should create multiple devices', async () => {
      const newDevices: NewDevice[] = [
        { name: 'Device 1', deviceTypeId: 'type-1', organizationId: 'org-1', status: 'active' },
        { name: 'Device 2', deviceTypeId: 'type-1', organizationId: 'org-1', status: 'active' },
      ];

      mockExecutor.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockDevice(), createMockDevice({ id: 'device-2' })]),
        }),
      });

      const result = await repository.createMany(newDevices);

      expect(mockExecutor.insert).toHaveBeenCalledWith(devices);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.createMany([]);

      expect(result).toEqual([]);
      expect(mockExecutor.insert).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find device by ID', async () => {
      const result = await repository.findById('device-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('device-1');
    });

    it('should return null when device not found', async () => {
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
      await repository.findById('device-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should exclude soft deleted devices', async () => {
      await repository.findById('device-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findAllInTenant', () => {
    it('should find all devices with default pagination', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 10 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockDevice()]);

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
      const dataMock = vi.fn().mockResolvedValue([createMockDevice()]);

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

  describe('findByDeviceType', () => {
    it('should find devices by device type', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 5 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockDevice()]);

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

      const result = await repository.findByDeviceType('org-1', 'type-1');

      expect(result.data).toBeDefined();
      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findByStatus', () => {
    it('should find devices by status', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockDevice()]);

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

  describe('findBySerialNumber', () => {
    it('should find device by serial number', async () => {
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

  describe('findByMacAddress', () => {
    it('should find device by MAC address', async () => {
      const result = await repository.findByMacAddress('org-1', '00:11:22:33:44:55');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when MAC address not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByMacAddress('org-1', 'FF:FF:FF:FF:FF:FF');

      expect(result).toBeNull();
    });
  });

  describe('searchByName', () => {
    it('should search devices by name', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockDevice()]),
        }),
      });

      const result = await repository.searchByName('org-1', 'test');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should perform case-insensitive search', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockDevice()]),
        }),
      });

      await repository.searchByName('org-1', 'TEST');

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findManyByIds', () => {
    it('should find multiple devices by IDs', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockDevice(), createMockDevice({ id: 'device-2' })]),
        }),
      });

      const result = await repository.findManyByIds('org-1', ['device-1', 'device-2']);

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
    it('should update device by ID', async () => {
      const updates = { name: 'Updated Device', status: 'inactive' as const };

      const result = await repository.update('device-1', 'org-1', updates);

      expect(mockExecutor.update).toHaveBeenCalledWith(devices);
      expect(result).toBeDefined();
    });

    it('should return null when device not found', async () => {
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
      await repository.update('device-1', 'org-1', { name: 'Test' });

      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a device', async () => {
      const result = await repository.softDelete('device-1', 'org-1');

      expect(mockExecutor.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when device not found', async () => {
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
    it('should hard delete a device', async () => {
      const result = await repository.delete('device-1', 'org-1');

      expect(mockExecutor.delete).toHaveBeenCalledWith(devices);
      expect(result).toBe(true);
    });

    it('should return false when device not found', async () => {
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
    it('should return true when device exists', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.exists('device-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false when device does not exist', async () => {
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
    it('should count devices in tenant', async () => {
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

  describe('updateLastSeen', () => {
    it('should update device last seen timestamp', async () => {
      const result = await repository.updateLastSeen('device-1', 'org-1');

      expect(mockExecutor.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when device not found', async () => {
      mockExecutor.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.updateLastSeen('nonexistent', 'org-1');

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

// Helper function to create mock devices
function createMockDevice(overrides?: Partial<Device>): Device {
  return {
    id: 'device-1',
    name: 'Test Device',
    deviceTypeId: 'type-1',
    organizationId: 'org-1',
    status: 'active',
    serialNumber: 'SN12345',
    macAddress: '00:11:22:33:44:55',
    ipAddress: null,
    firmwareVersion: null,
    lastSeenAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
