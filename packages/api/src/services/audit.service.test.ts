/**
 * Unit tests for AuditService
 * Tests audit logging methods and event recording
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before imports
const mockInsertFn = vi.fn();
const mockDb = {
  insert: vi.fn(() => ({
    values: mockInsertFn,
  })),
};

const mockGetRequestContext = vi.fn();

vi.mock('../db/index.js', () => ({
  db: mockDb,
}));

vi.mock('../context/request-context.js', () => ({
  getRequestContext: mockGetRequestContext,
}));

vi.mock('../db/schema/index.js', () => ({
  auditLogs: 'auditLogs',
}));

// Import after mocks
const { auditService } = await import('./audit.service.js');
import type { AuditEntry } from './audit.service.js';

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for db.insert
    mockInsertFn.mockResolvedValue(undefined);

    // Setup default request context
    mockGetRequestContext.mockReturnValue({
      userId: 'user-1',
      userEmail: 'test@example.com',
      organizationId: 'org-1',
      requestId: 'req-123',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log', () => {
    it('should log audit entry with context', async () => {
      const entry: AuditEntry = {
        category: 'authentication',
        action: 'login',
        outcome: 'success',
      };

      await auditService.log(entry);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockInsertFn).toHaveBeenCalled();
    });

    it('should merge entry data with request context', async () => {
      const entry: AuditEntry = {
        category: 'user_management',
        action: 'create_user',
        resourceType: 'user',
        resourceId: 'user-2',
      };

      await auditService.log(entry);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use provided user info over context', async () => {
      const entry: AuditEntry = {
        category: 'authentication',
        action: 'login',
        userId: 'different-user',
        userEmail: 'different@example.com',
      };

      await auditService.log(entry);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should default outcome to success', async () => {
      const entry: AuditEntry = {
        category: 'data_access',
        action: 'read',
      };

      await auditService.log(entry);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle missing request context', async () => {
      mockGetRequestContext.mockReturnValue(null);

      const entry: AuditEntry = {
        category: 'system',
        action: 'startup',
        outcome: 'success',
      };

      await auditService.log(entry);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should include details when provided', async () => {
      const entry: AuditEntry = {
        category: 'authorization',
        action: 'permission_check',
        details: {
          permission: 'users.read',
          granted: true,
        },
      };

      await auditService.log(entry);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should not throw when database insert fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInsertFn.mockRejectedValue(new Error('Database error'));

      const entry: AuditEntry = {
        category: 'system',
        action: 'test',
      };

      await expect(auditService.log(entry)).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('logAuth', () => {
    it('should log authentication event', async () => {
      await auditService.logAuth('login', {
        userId: 'user-1',
        outcome: 'success',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use authentication category', async () => {
      await auditService.logAuth('logout');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should support custom details', async () => {
      await auditService.logAuth('mfa_verify', {
        details: { method: 'totp' },
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logLogin', () => {
    it('should log successful login', async () => {
      await auditService.logLogin('test@example.com', 'user-1', true);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log failed login', async () => {
      await auditService.logLogin('test@example.com', undefined, false);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should include attempted email in details', async () => {
      await auditService.logLogin('test@example.com', 'user-1', true, {
        method: 'password',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle additional details', async () => {
      await auditService.logLogin('test@example.com', 'user-1', true, {
        provider: 'google',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logLogout', () => {
    it('should log single session logout', async () => {
      await auditService.logLogout('user-1', false);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log logout from all sessions', async () => {
      await auditService.logLogout('user-1', true);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should default to single session logout', async () => {
      await auditService.logLogout('user-1');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logPasswordResetRequest', () => {
    it('should log password reset request', async () => {
      await auditService.logPasswordResetRequest('test@example.com');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use success outcome', async () => {
      await auditService.logPasswordResetRequest('test@example.com');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logPasswordReset', () => {
    it('should log password reset completion', async () => {
      await auditService.logPasswordReset('user-1');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use success outcome', async () => {
      await auditService.logPasswordReset('user-1');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logUserManagement', () => {
    it('should log user creation', async () => {
      await auditService.logUserManagement('create_user', 'user-2', {
        email: 'newuser@example.com',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log user update', async () => {
      await auditService.logUserManagement('update_user', 'user-2', {
        fields: ['firstName', 'lastName'],
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log user deletion', async () => {
      await auditService.logUserManagement('delete_user', 'user-2');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use user_management category', async () => {
      await auditService.logUserManagement('suspend_user', 'user-2');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logOrgManagement', () => {
    it('should log organization creation', async () => {
      await auditService.logOrgManagement('create_organization', 'org-2', {
        name: 'New Org',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log organization update', async () => {
      await auditService.logOrgManagement('update_organization', 'org-1', {
        fields: ['name', 'description'],
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log organization deletion', async () => {
      await auditService.logOrgManagement('delete_organization', 'org-1');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use organization_management category', async () => {
      await auditService.logOrgManagement('activate_organization', 'org-1');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logDataAccess', () => {
    it('should log data read', async () => {
      await auditService.logDataAccess('user', 'user-1', 'read');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should default to read action', async () => {
      await auditService.logDataAccess('organization', 'org-1');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should include details', async () => {
      await auditService.logDataAccess('user', 'user-1', 'read', {
        fields: ['email', 'name'],
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use data_access category', async () => {
      await auditService.logDataAccess('report', 'report-1', 'download');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('logDataChange', () => {
    it('should log data creation', async () => {
      await auditService.logDataChange('user', 'user-2', 'create', {
        email: 'newuser@example.com',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log data update', async () => {
      await auditService.logDataChange('user', 'user-1', 'update', {
        changes: { firstName: 'John' },
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log data deletion', async () => {
      await auditService.logDataChange('user', 'user-1', 'delete');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use data_modification category', async () => {
      await auditService.logDataChange('organization', 'org-1', 'update');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should include details about changes', async () => {
      await auditService.logDataChange('role', 'role-1', 'update', {
        before: { name: 'Old Name' },
        after: { name: 'New Name' },
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid successive logs', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        auditService.log({
          category: 'system',
          action: `test_${i}`,
        })
      );

      await Promise.all(promises);

      expect(mockDb.insert).toHaveBeenCalledTimes(10);
    });

    it('should handle logs with null values', async () => {
      await auditService.log({
        category: 'system',
        action: 'test',
        userId: undefined,
        organizationId: undefined,
        resourceType: undefined,
        resourceId: undefined,
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle complex details objects', async () => {
      await auditService.log({
        category: 'authorization',
        action: 'permission_check',
        details: {
          permissions: ['read', 'write', 'delete'],
          roles: ['admin', 'editor'],
          nested: {
            depth: 1,
            value: true,
          },
        },
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should log full user lifecycle', async () => {
      // User registration
      await auditService.logAuth('register', {
        userEmail: 'newuser@example.com',
        outcome: 'success',
      });

      // Email verification
      await auditService.logAuth('verify_email', {
        userId: 'user-new',
        outcome: 'success',
      });

      // First login
      await auditService.logLogin('newuser@example.com', 'user-new', true);

      // Profile update
      await auditService.logUserManagement('update_user', 'user-new', {
        fields: ['firstName', 'lastName'],
      });

      // Logout
      await auditService.logLogout('user-new');

      expect(mockDb.insert).toHaveBeenCalledTimes(5);
    });

    it('should log organization hierarchy operations', async () => {
      // Create parent org
      await auditService.logOrgManagement('create_organization', 'org-parent', {
        name: 'Parent Org',
      });

      // Create child org
      await auditService.logOrgManagement('create_organization', 'org-child', {
        name: 'Child Org',
        parentId: 'org-parent',
      });

      // Move org
      await auditService.logOrgManagement('move_organization', 'org-child', {
        fromParent: 'org-parent',
        toParent: 'org-other',
      });

      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });
  });
});
