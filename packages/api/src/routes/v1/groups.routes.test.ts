/**
 * Integration tests for Group routes
 * Tests group CRUD operations and member management within organizations
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
  mockGroupData,
  mockUserData,
} from '../__tests__/test-helpers.js';
import * as repositories from '../../repositories/index.js';

// Mock repositories module
vi.mock('../../repositories/index.js', () => ({
  getGroupRepository: vi.fn(),
  getOrganizationRepository: vi.fn(),
  getUserRepository: vi.fn(),
  getUserOrganizationRepository: vi.fn(),
}));

describe('Group Routes', () => {
  let app: FastifyInstance;
  let mocks: ReturnType<typeof createMockRepositories>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks = createMockRepositories();
    setupSuccessfulMocks(mocks);

    // Setup repository getters
    vi.mocked(repositories.getGroupRepository).mockReturnValue(mocks.groupRepo as any);
    vi.mocked(repositories.getOrganizationRepository).mockReturnValue(mocks.orgRepo as any);
    vi.mocked(repositories.getUserRepository).mockReturnValue(mocks.userRepo as any);
    vi.mocked(repositories.getUserOrganizationRepository).mockReturnValue(mocks.userOrgRepo as any);

    app = await buildApp();
    await app.ready();
    mockAuthenticate(app, mockUser);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/organizations/:orgId/groups', () => {
    it('should list groups in organization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups',
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
        url: '/api/v1/organizations/org-123/groups?page=2&pageSize=10',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.groupRepo.findByOrganization).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ page: 2, pageSize: 10 })
      );
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/nonexistent-id/groups',
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
        url: '/api/v1/organizations/org-123/groups',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should include member count in response', async () => {
      const groups = [
        { ...mockGroupData.createGroup(), memberCount: 5 },
      ];
      mocks.groupRepo.findByOrganization.mockResolvedValue({
        data: groups,
        pagination: {
          page: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const body = response.json();
      expect(body.data[0].memberCount).toBe(5);
    });
  });

  describe('GET /api/v1/organizations/:orgId/groups/:id', () => {
    it('should get group by id', async () => {
      const group = mockGroupData.createGroup();
      mocks.groupRepo.findById.mockResolvedValue(group);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups/group-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('description');
    });

    it('should return 404 for non-existent group', async () => {
      mocks.groupRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if group belongs to different organization', async () => {
      const group = mockGroupData.createGroup({ organizationId: 'org-999' });
      mocks.groupRepo.findById.mockResolvedValue(group);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups/group-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if user is not a member of organization', async () => {
      mocks.userOrgRepo.findMembershipOrSuperAdmin.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups/group-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/organizations/:orgId/groups', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
    });

    it('should create a new group', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Group',
          description: 'Test group description',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Test Group');
      expect(mocks.groupRepo.create).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Group',
          description: 'Test group',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if group name already exists', async () => {
      mocks.groupRepo.isNameAvailable.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Existing Group',
          description: 'Test group',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(mocks.groupRepo.create).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/nonexistent-id/groups',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Group',
          description: 'Test group',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should set createdBy to current user', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Group',
          description: 'Test group',
        },
      });

      expect(mocks.groupRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: mockAdminUser.id,
        })
      );
    });
  });

  describe('PATCH /api/v1/organizations/:orgId/groups/:id', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
    });

    it('should update group', async () => {
      const updatedGroup = mockGroupData.createGroup({ name: 'Updated Group' });
      mocks.groupRepo.update.mockResolvedValue(updatedGroup);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/groups/group-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Group',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Updated Group');
      expect(mocks.groupRepo.update).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/groups/group-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Group',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent group', async () => {
      mocks.groupRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/groups/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Group',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if new name already exists', async () => {
      const existingGroup = mockGroupData.createGroup({ name: 'Old Name' });
      mocks.groupRepo.findById.mockResolvedValue(existingGroup);
      mocks.groupRepo.isNameAvailable.mockResolvedValue(false);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/groups/group-123',
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
      const group = mockGroupData.createGroup();
      mocks.groupRepo.findById.mockResolvedValue(group);
      mocks.groupRepo.update.mockResolvedValue(group);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123/groups/group-123',
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

  describe('DELETE /api/v1/organizations/:orgId/groups/:id', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
    });

    it('should delete group', async () => {
      mocks.groupRepo.delete.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/groups/group-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(mocks.groupRepo.delete).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/groups/group-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent group', async () => {
      mocks.groupRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/groups/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/organizations/:orgId/groups/:id/members', () => {
    it('should list group members', async () => {
      mocks.groupRepo.getGroupMembers = vi.fn().mockResolvedValue({
        data: [
          {
            userId: 'user-123',
            user: mockUserData.createUser(),
            addedAt: new Date(),
            addedBy: 'admin-123',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups/group-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should return 404 for non-existent group', async () => {
      mocks.groupRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups/nonexistent-id/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should support pagination', async () => {
      mocks.groupRepo.getGroupMembers = vi.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 2,
          pageSize: 10,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/groups/group-123/members?page=2&pageSize=10',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/organizations/:orgId/groups/:id/members', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
      mocks.groupRepo.isMember = vi.fn().mockResolvedValue(false);
      mocks.userOrgRepo.findMembership = vi.fn().mockResolvedValue({
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'member' as const,
      });
      mocks.groupRepo.addMember.mockResolvedValue({
        userId: 'user-456',
        addedAt: new Date(),
        addedBy: 'admin-123',
      } as any);
    });

    it('should add member to group', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups/group-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.userId).toBe('user-456');
      expect(mocks.groupRepo.addMember).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups/group-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if target user does not exist', async () => {
      mocks.userRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups/group-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'nonexistent-user',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if user is not member of organization', async () => {
      mocks.userOrgRepo.findMembership = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups/group-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 409 if user is already a member', async () => {
      mocks.groupRepo.isMember = vi.fn().mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/groups/group-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('DELETE /api/v1/organizations/:orgId/groups/:id/members/:userId', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
      mocks.groupRepo.isMember = vi.fn().mockResolvedValue(true);
      mocks.groupRepo.removeMember.mockResolvedValue(true);
    });

    it('should remove member from group', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/groups/group-123/members/user-456',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(mocks.groupRepo.removeMember).toHaveBeenCalled();
    });

    it('should allow user to remove themselves', async () => {
      mockAuthenticate(app, mockUser);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/org-123/groups/group-123/members/${mockUser.id}`,
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 403 if user is not admin and not removing self', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/groups/group-123/members/user-456',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 if user is not a member of group', async () => {
      mocks.groupRepo.isMember = vi.fn().mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123/groups/group-123/members/user-456',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
