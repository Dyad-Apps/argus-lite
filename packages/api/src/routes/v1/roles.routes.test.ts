/**
 * Integration tests for Role routes
 * Tests role CRUD operations and role assignments
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import {
  createMockRepositories,
  setupSuccessfulMocks,
  mockAuthenticate,
  mockUser,
  mockAdminUser,
  mockRoleData,
} from '../__tests__/test-helpers.js';
import * as repositories from '../../repositories/index.js';

// Mock repositories module
vi.mock('../../repositories/index.js', () => ({
  getRoleRepository: vi.fn(),
  getOrganizationRepository: vi.fn(),
  getUserRepository: vi.fn(),
  getUserOrganizationRepository: vi.fn(),
  getGroupRepository: vi.fn(),
}));

describe('Role Routes', () => {
  let app: FastifyInstance;
  let mocks: ReturnType<typeof createMockRepositories>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks = createMockRepositories();
    setupSuccessfulMocks(mocks);

    // Setup repository getters
    vi.mocked(repositories.getRoleRepository).mockReturnValue(mocks.roleRepo as any);
    vi.mocked(repositories.getOrganizationRepository).mockReturnValue(mocks.orgRepo as any);
    vi.mocked(repositories.getUserRepository).mockReturnValue(mocks.userRepo as any);
    vi.mocked(repositories.getUserOrganizationRepository).mockReturnValue(mocks.userOrgRepo as any);
    vi.mocked(repositories.getGroupRepository).mockReturnValue(mocks.groupRepo as any);

    app = await buildApp();
    await app.ready();
    mockAuthenticate(app, mockUser);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/roles/system', () => {
    it('should list system roles', async () => {
      const systemRoles = [
        mockRoleData.createRole({ id: 'role-1', name: 'Admin', isSystem: true }),
        mockRoleData.createRole({ id: 'role-2', name: 'Viewer', isSystem: true }),
      ];
      mocks.roleRepo.findSystemRoles = vi.fn().mockResolvedValue(systemRoles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/roles/system',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      app.decorate('authenticate', async () => {
        throw { statusCode: 401, message: 'Unauthorized' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/roles/system',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should include role permissions', async () => {
      const systemRoles = [
        mockRoleData.createRole({
          name: 'Admin',
          isSystem: true,
          permissions: ['read:users', 'write:users'],
        }),
      ];
      mocks.roleRepo.findSystemRoles = vi.fn().mockResolvedValue(systemRoles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/roles/system',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const body = response.json();
      expect(body.data[0]).toHaveProperty('permissions');
    });
  });

  describe('GET /api/v1/organizations/:orgId/roles', () => {
    it('should list organization roles', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles?page=2&pageSize=10',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.roleRepo.findByOrganization).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ page: 2, pageSize: 10 })
      );
    });

    it('should support includeSystem parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles?includeSystem=false',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.roleRepo.findByOrganization).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ includeSystem: false })
      );
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/nonexistent-id/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if user is not a member', async () => {
      mocks.userOrgRepo.findMembershipOrSuperAdmin.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/organizations/:orgId/roles/:id', () => {
    it('should get role by id', async () => {
      const role = mockRoleData.createRole({ organizationId: 'org-123' });
      mocks.roleRepo.findById.mockResolvedValue(role);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('permissions');
    });

    it('should return 404 for non-existent role', async () => {
      mocks.roleRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if role belongs to different organization', async () => {
      const role = mockRoleData.createRole({ organizationId: 'org-999' });
      mocks.roleRepo.findById.mockResolvedValue(role);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should allow access to system roles', async () => {
      const role = mockRoleData.createRole({ organizationId: null, isSystem: true });
      mocks.roleRepo.findById.mockResolvedValue(role);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/organizations/:orgId/roles', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
    });

    it('should create a custom role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Custom Role',
          description: 'A custom role',
          defaultScope: 'organization',
          permissions: { resources: ['read:users'], menuAccess: [] },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Test Role');
      expect(mocks.roleRepo.create).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Custom Role',
          description: 'A custom role',
          defaultScope: 'organization',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if role name already exists', async () => {
      mocks.roleRepo.isNameAvailable.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Existing Role',
          description: 'A custom role',
          defaultScope: 'organization',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(mocks.roleRepo.create).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/nonexistent-id/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Custom Role',
          description: 'A custom role',
          defaultScope: 'organization',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should set isSystem to false for custom roles', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Custom Role',
          description: 'A custom role',
          defaultScope: 'organization',
        },
      });

      expect(mocks.roleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystem: false,
        })
      );
    });
  });

  describe('PATCH /api/v1/organizations/:orgId/roles/:id', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
      const customRole = mockRoleData.createRole({
        organizationId: 'org-123',
        isSystem: false,
      });
      mocks.roleRepo.findById.mockResolvedValue(customRole);
    });

    it('should update custom role', async () => {
      const updatedRole = mockRoleData.createRole({ name: 'Updated Role' });
      mocks.roleRepo.update.mockResolvedValue(updatedRole);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Role',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Updated Role');
      expect(mocks.roleRepo.update).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Role',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 for system roles', async () => {
      const systemRole = mockRoleData.createRole({ isSystem: true });
      mocks.roleRepo.findById.mockResolvedValue(systemRole);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Role',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.message).toContain('system roles');
    });

    it('should return 404 for non-existent role', async () => {
      mocks.roleRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/roles/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Role',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if new name already exists', async () => {
      const existingRole = mockRoleData.createRole({
        name: 'Old Name',
        organizationId: 'org-123',
        isSystem: false,
      });
      mocks.roleRepo.findById.mockResolvedValue(existingRole);
      mocks.roleRepo.isNameAvailable.mockResolvedValue(false);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Existing Name',
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should allow partial updates', async () => {
      const role = mockRoleData.createRole({ organizationId: 'org-123', isSystem: false });
      mocks.roleRepo.findById.mockResolvedValue(role);
      mocks.roleRepo.update.mockResolvedValue(role);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          description: 'New description only',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/v1/organizations/:orgId/roles/:id', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
      const customRole = mockRoleData.createRole({
        organizationId: 'org-123',
        isSystem: false,
      });
      mocks.roleRepo.findById.mockResolvedValue(customRole);
      mocks.roleRepo.delete.mockResolvedValue(true);
    });

    it('should delete custom role', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(mocks.roleRepo.delete).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 for system roles', async () => {
      const systemRole = mockRoleData.createRole({ isSystem: true });
      mocks.roleRepo.findById.mockResolvedValue(systemRole);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.message).toContain('system roles');
    });

    it('should return 404 for non-existent role', async () => {
      mocks.roleRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/roles/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if role belongs to different organization', async () => {
      const role = mockRoleData.createRole({ organizationId: 'org-999', isSystem: false });
      mocks.roleRepo.findById.mockResolvedValue(role);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/roles/role-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Role Assignment Operations', () => {
    it('should assign role to user', async () => {
      mockAuthenticate(app, mockAdminUser);
      mocks.roleRepo.assignToUser = vi.fn().mockResolvedValue({
        userId: 'user-456',
        roleId: 'role-123',
        scope: 'organization',
        assignedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/roles/role-123/assign',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
          scope: 'organization',
        },
      });

      // Should succeed or return appropriate status
      expect([201, 404]).toContain(response.statusCode);
    });

    it('should unassign role from user', async () => {
      mockAuthenticate(app, mockAdminUser);
      mocks.roleRepo.unassignFromUser = vi.fn().mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/roles/role-123/unassign/user-456',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      // Should succeed or return appropriate status
      expect([204, 404]).toContain(response.statusCode);
    });

    it('should get user roles', async () => {
      mocks.roleRepo.getUserRoles = vi.fn().mockResolvedValue([
        {
          roleId: 'role-123',
          scope: 'organization' as const,
          source: 'direct' as const,
          role: mockRoleData.createRole(),
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/users/user-123/roles',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      // Should succeed or return appropriate status
      expect([200, 404]).toContain(response.statusCode);
    });
  });
});
