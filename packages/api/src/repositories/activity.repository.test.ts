/**
 * Unit tests for ActivityRepository
 * Tests all CRUD operations and activity-specific methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityRepository, type NewActivity, type Activity } from './activity.repository.js';
import * as baseRepository from './base.repository.js';
import { activities } from '../db/schema/index.js';

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

describe('ActivityRepository', () => {
  let repository: ActivityRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ActivityRepository();

    mockExecutor.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createMockActivity()]),
      }),
    });

    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockActivity()]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockActivity()]),
            }),
          }),
        }),
      }),
    });

    mockExecutor.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockActivity()]),
        }),
      }),
    });

    mockExecutor.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'activity-1' }]),
      }),
    });
  });

  describe('create', () => {
    it('should create a new activity', async () => {
      const newActivity: NewActivity = {
        name: 'Test Activity',
        activityTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'pending',
        priority: 'medium',
        initiatorType: 'person',
        targetType: 'asset',
        targetId: 'asset-1',
      };

      const result = await repository.create(newActivity);

      expect(mockExecutor.insert).toHaveBeenCalledWith(activities);
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Activity');
    });

    it('should create activity with transaction', async () => {
      const newActivity: NewActivity = {
        name: 'Test Activity',
        activityTypeId: 'type-1',
        organizationId: 'org-1',
        status: 'pending',
        priority: 'medium',
        initiatorType: 'person',
        targetType: 'asset',
        targetId: 'asset-1',
      };

      await repository.create(newActivity, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('createMany', () => {
    it('should create multiple activities', async () => {
      const newActivities: NewActivity[] = [
        {
          name: 'Activity 1',
          activityTypeId: 'type-1',
          organizationId: 'org-1',
          status: 'pending',
          priority: 'medium',
          initiatorType: 'person',
          targetType: 'asset',
          targetId: 'asset-1',
        },
        {
          name: 'Activity 2',
          activityTypeId: 'type-1',
          organizationId: 'org-1',
          status: 'pending',
          priority: 'medium',
          initiatorType: 'person',
          targetType: 'asset',
          targetId: 'asset-2',
        },
      ];

      mockExecutor.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockActivity(), createMockActivity({ id: 'activity-2' })]),
        }),
      });

      const result = await repository.createMany(newActivities);

      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.createMany([]);
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should find activity by ID', async () => {
      const result = await repository.findById('activity-1', 'org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when activity not found', async () => {
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

  describe('findByStatus', () => {
    it('should find activities by status', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 5 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockActivity()]);

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

      const result = await repository.findByStatus('org-1', 'pending');
      expect(result.data).toBeDefined();
    });
  });

  describe('findByPriority', () => {
    it('should find activities by priority', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockActivity()]);

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

      const result = await repository.findByPriority('org-1', 'high');
      expect(result.data).toBeDefined();
    });
  });

  describe('findAssignedToUser', () => {
    it('should find activities assigned to user', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 4 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockActivity()]);

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

      const result = await repository.findAssignedToUser('org-1', 'user-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('findInitiatedByUser', () => {
    it('should find activities initiated by user', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 2 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockActivity()]);

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

      const result = await repository.findInitiatedByUser('org-1', 'user-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('findByTarget', () => {
    it('should find activities by target', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockActivity()]);

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

      const result = await repository.findByTarget('org-1', 'asset', 'asset-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('findChildren', () => {
    it('should find child activities', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 2 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockActivity()]);

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

  describe('findPendingApproval', () => {
    it('should find activities pending approval', async () => {
      const countMock = vi.fn().mockResolvedValue([{ count: 1 }]);
      const dataMock = vi.fn().mockResolvedValue([createMockActivity()]);

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

      const result = await repository.findPendingApproval('org-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('searchByName', () => {
    it('should search activities by name', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockActivity()]),
        }),
      });

      const result = await repository.searchByName('org-1', 'test');
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update activity by ID', async () => {
      const result = await repository.update('activity-1', 'org-1', { name: 'Updated Activity' });

      expect(mockExecutor.update).toHaveBeenCalledWith(activities);
      expect(result).toBeDefined();
    });

    it('should return null when activity not found', async () => {
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
    it('should soft delete an activity', async () => {
      const result = await repository.softDelete('activity-1', 'org-1');
      expect(mockExecutor.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should hard delete an activity', async () => {
      const result = await repository.delete('activity-1', 'org-1');
      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true when activity exists', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await repository.exists('activity-1', 'org-1');
      expect(result).toBe(true);
    });
  });

  describe('count', () => {
    it('should count activities in tenant', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      });

      const result = await repository.count('org-1');
      expect(result).toBe(42);
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

function createMockActivity(overrides?: Partial<Activity>): Activity {
  return {
    id: 'activity-1',
    name: 'Test Activity',
    description: null,
    activityTypeId: 'type-1',
    organizationId: 'org-1',
    status: 'pending',
    priority: 'medium',
    initiatorType: 'person',
    initiatorUserId: 'user-1',
    targetType: 'asset',
    targetId: 'asset-1',
    assignedToUserId: 'user-2',
    parentActivityId: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    requiresApproval: false,
    approvalStatus: null,
    approvedBy: null,
    approvedAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
