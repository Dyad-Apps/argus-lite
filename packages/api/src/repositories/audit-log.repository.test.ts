/**
 * Unit tests for Audit Log Repository
 * Tests audit log query functions and filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findAuditLogs,
  getRecentActivity,
  findAuditLogById,
  findAuditLogsByUserId,
  findAuditLogsByOrganizationId,
  findAuditLogsByResource,
  type AuditLogFilter,
  type RecentActivityItem,
} from './audit-log.repository.js';
import * as baseRepository from './base.repository.js';
import type { AuditLog } from '../db/schema/index.js';

// Mock the database
const mockExecutor = {
  select: vi.fn(),
};

// Mock the base repository utilities
vi.mock('./base.repository.js', async () => {
  const actual = await vi.importActual('./base.repository.js');
  return {
    ...actual,
    getExecutor: vi.fn(() => mockExecutor),
    getPageSize: vi.fn((options) => options?.pageSize ?? 20),
    calculateOffset: vi.fn((options) => {
      const page = options?.page ?? 1;
      const pageSize = options?.pageSize ?? 20;
      return (page - 1) * pageSize;
    }),
    buildPaginatedResult: vi.fn((data, totalCount, options) => ({
      data,
      pagination: {
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 20,
        totalCount,
        totalPages: Math.ceil(totalCount / (options?.pageSize ?? 20)),
        hasNext: (options?.page ?? 1) < Math.ceil(totalCount / (options?.pageSize ?? 20)),
        hasPrevious: (options?.page ?? 1) > 1,
      },
    })),
  };
});

describe('Audit Log Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup
    mockExecutor.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
            }),
          }),
          limit: vi.fn().mockResolvedValue([createMockAuditLog()]),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([createMockRecentActivity()]),
        }),
      }),
    });
  });

  describe('findAuditLogs', () => {
    it('should find all audit logs with default pagination', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs();

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by organization ID', async () => {
      const filter: AuditLogFilter = {
        organizationId: 'org-1',
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it('should filter by user ID', async () => {
      const filter: AuditLogFilter = {
        userId: 'user-1',
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(result.data).toBeDefined();
    });

    it('should filter by category', async () => {
      const filter: AuditLogFilter = {
        category: 'authentication',
      };

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
                  createMockAuditLog({ category: 'authentication' }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(result.data[0].category).toBe('authentication');
    });

    it('should filter by action', async () => {
      const filter: AuditLogFilter = {
        action: 'login',
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 4 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  createMockAuditLog({ action: 'login' }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(result.data[0].action).toBe('login');
    });

    it('should filter by resource type and ID', async () => {
      const filter: AuditLogFilter = {
        resourceType: 'user',
        resourceId: 'user-1',
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  createMockAuditLog({ resourceType: 'user', resourceId: 'user-1' }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(result.data[0].resourceType).toBe('user');
      expect(result.data[0].resourceId).toBe('user-1');
    });

    it('should filter by outcome', async () => {
      const filter: AuditLogFilter = {
        outcome: 'success',
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 8 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  createMockAuditLog({ outcome: 'success' }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(result.data[0].outcome).toBe('success');
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const filter: AuditLogFilter = {
        startDate,
        endDate,
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 6 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should support search across multiple fields', async () => {
      const filter: AuditLogFilter = {
        search: 'test',
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should support pagination', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 100 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      await findAuditLogs(undefined, { page: 2, pageSize: 10 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });

    it('should combine multiple filters', async () => {
      const filter: AuditLogFilter = {
        organizationId: 'org-1',
        userId: 'user-1',
        category: 'authentication',
        outcome: 'success',
      };

      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogs(filter);

      expect(result.data).toBeDefined();
    });

    it('should work with transaction', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      await findAuditLogs(undefined, undefined, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('getRecentActivity', () => {
    it('should get recent activity with default limit', async () => {
      const activities = Array.from({ length: 10 }, (_, i) =>
        createMockRecentActivity({ id: `log-${i}` })
      );

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(activities),
            }),
          }),
        }),
      });

      const result = await getRecentActivity();

      expect(result).toHaveLength(10);
    });

    it('should filter by organization', async () => {
      const activities = [createMockRecentActivity()];

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(activities),
            }),
          }),
        }),
      });

      const result = await getRecentActivity('org-1');

      expect(mockExecutor.select).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should respect custom limit', async () => {
      const activities = Array.from({ length: 5 }, (_, i) =>
        createMockRecentActivity({ id: `log-${i}` })
      );

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(activities),
            }),
          }),
        }),
      });

      const result = await getRecentActivity(undefined, 5);

      expect(result).toHaveLength(5);
    });

    it('should return simplified activity items', async () => {
      const activities = [createMockRecentActivity()];

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(activities),
            }),
          }),
        }),
      });

      const result = await getRecentActivity();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('action');
      expect(result[0]).toHaveProperty('outcome');
    });

    it('should work with transaction', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await getRecentActivity(undefined, 10, mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('findAuditLogById', () => {
    it('should find audit log by ID', async () => {
      const log = createMockAuditLog();

      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([log]),
          }),
        }),
      });

      const result = await findAuditLogById('1');

      expect(result).toBeDefined();
      expect(result?.id).toBe(BigInt(1));
    });

    it('should return null when log not found', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await findAuditLogById('999');

      expect(result).toBeNull();
    });

    it('should work with transaction', async () => {
      mockExecutor.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await findAuditLogById('1', mockExecutor as any);

      expect(baseRepository.getExecutor).toHaveBeenCalledWith(mockExecutor);
    });
  });

  describe('findAuditLogsByUserId', () => {
    it('should find audit logs for user', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogsByUserId('user-1');

      expect(result.data).toBeDefined();
    });

    it('should support pagination', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 20 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      await findAuditLogsByUserId('user-1', { page: 2, pageSize: 10 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findAuditLogsByOrganizationId', () => {
    it('should find audit logs for organization', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 15 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogsByOrganizationId('org-1');

      expect(result.data).toBeDefined();
    });

    it('should support pagination', async () => {
      mockExecutor.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 50 }]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      await findAuditLogsByOrganizationId('org-1', { page: 3, pageSize: 15 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });

  describe('findAuditLogsByResource', () => {
    it('should find audit logs for resource', async () => {
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
                  createMockAuditLog({ resourceType: 'user', resourceId: 'user-1' }),
                ]),
              }),
            }),
          }),
        }),
      });

      const result = await findAuditLogsByResource('user', 'user-1');

      expect(result.data[0].resourceType).toBe('user');
      expect(result.data[0].resourceId).toBe('user-1');
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
                offset: vi.fn().mockResolvedValue([createMockAuditLog()]),
              }),
            }),
          }),
        }),
      });

      await findAuditLogsByResource('organization', 'org-1', { page: 1, pageSize: 5 });

      expect(mockExecutor.select).toHaveBeenCalled();
    });
  });
});

// Helper functions to create mock data
function createMockAuditLog(overrides?: Partial<AuditLog>): AuditLog {
  return {
    id: BigInt(1),
    category: 'authentication',
    action: 'login',
    userId: 'user-1',
    userEmail: 'test@example.com',
    organizationId: 'org-1',
    resourceType: null,
    resourceId: null,
    details: null,
    outcome: 'success',
    requestId: 'req-1',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockRecentActivity(overrides?: Partial<RecentActivityItem>): any {
  return {
    id: BigInt(1),
    category: 'authentication',
    action: 'login',
    userEmail: 'test@example.com',
    resourceType: null,
    resourceId: null,
    outcome: 'success',
    createdAt: new Date(),
    ...overrides,
  };
}
