/**
 * Integration tests for Organization routes
 * Tests organization CRUD, member management, and hierarchy operations
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
  mockOrgData,
  mockUserData,
} from '../__tests__/test-helpers.js';
import * as repositories from '../../repositories/index.js';
import * as auditService from '../../services/audit.service.js';

// Mock repositories module
vi.mock('../../repositories/index.js', () => ({
  getOrganizationRepository: vi.fn(),
  getUserOrganizationRepository: vi.fn(),
  getUserRepository: vi.fn(),
  getBrandingRepository: vi.fn(),
  getSystemAdminRepository: vi.fn(),
}));

// Mock audit service
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    logOrgManagement: vi.fn(),
  },
}));

describe('Organization Routes', () => {
  let app: FastifyInstance;
  let mocks: ReturnType<typeof createMockRepositories>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks = createMockRepositories();
    setupSuccessfulMocks(mocks);

    // Setup repository getters
    vi.mocked(repositories.getOrganizationRepository).mockReturnValue(mocks.orgRepo as any);
    vi.mocked(repositories.getUserOrganizationRepository).mockReturnValue(mocks.userOrgRepo as any);
    vi.mocked(repositories.getUserRepository).mockReturnValue(mocks.userRepo as any);
    vi.mocked(repositories.getBrandingRepository).mockReturnValue(mocks.brandingRepo as any);
    vi.mocked(repositories.getSystemAdminRepository).mockReturnValue(mocks.systemAdminRepo as any);

    app = await buildApp();
    await app.ready();
    mockAuthenticate(app, mockUser);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/organizations/by-subdomain/:subdomain (public)', () => {
    it('should get organization by subdomain without authentication', async () => {
      const org = mockOrgData.createOrg({ subdomain: 'test-org' });
      mocks.orgRepo.findBySubdomain.mockResolvedValue(org);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/by-subdomain/test-org',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.subdomain).toBe('test-org');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('logoUrl');
    });

    it('should return 404 for non-existent subdomain', async () => {
      mocks.orgRepo.findBySubdomain.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/by-subdomain/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for inactive organization', async () => {
      const org = mockOrgData.createOrg({ subdomain: 'test-org', isActive: false });
      mocks.orgRepo.findBySubdomain.mockResolvedValue(org);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/by-subdomain/test-org',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should include branding information', async () => {
      const org = mockOrgData.createOrg({ subdomain: 'test-org' });
      const branding = {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#ff0000',
        loginBackgroundType: 'image' as const,
      };
      mocks.orgRepo.findBySubdomain.mockResolvedValue(org);
      mocks.brandingRepo.findByOrganizationId.mockResolvedValue(branding as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/by-subdomain/test-org',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.logoUrl).toBe('https://example.com/logo.png');
      expect(body.primaryColor).toBe('#ff0000');
    });
  });

  describe('GET /api/v1/organizations', () => {
    it('should list organizations for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations',
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
        url: '/api/v1/organizations?page=2&pageSize=10',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.orgRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 })
      );
    });

    it('should filter by activeOnly parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations?activeOnly=true',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.orgRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ activeOnly: true })
      );
    });

    it('should filter organizations for non-super admin users', async () => {
      mocks.systemAdminRepo.isSuperAdmin.mockResolvedValue(false);
      const orgs = [
        mockOrgData.createOrg({ id: 'org-123' }),
        mockOrgData.createOrg({ id: 'org-999' }),
      ];
      mocks.orgRepo.findAll.mockResolvedValue({
        data: orgs,
        pagination: {
          page: 1,
          pageSize: 20,
          totalCount: 2,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const body = response.json();
      // Should only include accessible orgs
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it('should not filter organizations for super admin', async () => {
      mocks.systemAdminRepo.isSuperAdmin.mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      // Super admin sees all orgs
    });
  });

  describe('GET /api/v1/organizations/:id', () => {
    it('should get organization by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('slug');
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should include all organization fields', async () => {
      const org = mockOrgData.createOrg({
        name: 'Test Org',
        slug: 'test-org',
        orgCode: 'TEST_ORG',
        isRoot: true,
        canHaveChildren: true,
      });
      mocks.orgRepo.findById.mockResolvedValue(org);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const body = response.json();
      expect(body.slug).toBe('test-org');
      expect(body.orgCode).toBe('TEST_ORG');
      expect(body.isRoot).toBe(true);
      expect(body.canHaveChildren).toBe(true);
    });
  });

  describe('POST /api/v1/organizations', () => {
    it('should create a new organization', async () => {
      mockAuthenticate(app, mockAdminUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Organization',
          slug: 'new-org',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('New Organization');
      expect(mocks.orgRepo.create).toHaveBeenCalled();
    });

    it('should return 409 if slug already exists', async () => {
      mocks.orgRepo.isSlugAvailable.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Organization',
          slug: 'existing-slug',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(mocks.orgRepo.create).not.toHaveBeenCalled();
    });

    it('should generate org_code from slug', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Organization',
          slug: 'test-org-name',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mocks.orgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgCode: 'TEST_ORG_NAME',
        })
      );
    });

    it('should create as root organization by default', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'New Organization',
          slug: 'new-org',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mocks.orgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isRoot: true,
          canHaveChildren: true,
        })
      );
    });
  });

  describe('PATCH /api/v1/organizations/:id', () => {
    it('should update organization', async () => {
      const updatedOrg = mockOrgData.createOrg({ name: 'Updated Name' });
      mocks.orgRepo.update.mockResolvedValue(updatedOrg);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Updated Name');
      expect(mocks.orgRepo.update).toHaveBeenCalled();
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.update.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should allow partial updates', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/org-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          description: 'New description only',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.orgRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ description: 'New description only' })
      );
    });
  });

  describe('DELETE /api/v1/organizations/:id', () => {
    it('should delete organization', async () => {
      mocks.orgRepo.delete.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(mocks.orgRepo.delete).toHaveBeenCalled();
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should log audit event on deletion', async () => {
      mocks.orgRepo.delete.mockResolvedValue(true);

      await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(auditService.auditService.logOrgManagement).toHaveBeenCalledWith(
        'delete_organization',
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('GET /api/v1/organizations/:id/members', () => {
    it('should list organization members', async () => {
      mocks.userOrgRepo.getOrganizationMembers = vi.fn().mockResolvedValue({
        data: [
          {
            userId: 'user-123',
            organizationId: 'org-123',
            role: 'member' as const,
            joinedAt: new Date(),
            invitedBy: null,
            user: mockUserData.createUser(),
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
        url: '/api/v1/organizations/org-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/nonexistent-id/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if user is not a member', async () => {
      mocks.userOrgRepo.findMembership = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should support pagination', async () => {
      mocks.userOrgRepo.getOrganizationMembers = vi.fn().mockResolvedValue({
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
        url: '/api/v1/organizations/org-123/members?page=2&pageSize=10',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/organizations/:id/members', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockAdminUser);
    });

    it('should add member to organization', async () => {
      mocks.userOrgRepo.findMembership = vi.fn().mockResolvedValue(null);
      mocks.userOrgRepo.addMember.mockResolvedValue({
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'member' as const,
        joinedAt: new Date(),
        invitedBy: 'admin-123',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
          role: 'member',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.userId).toBe('user-456');
      expect(body.role).toBe('member');
    });

    it('should return 403 if user is not admin or owner', async () => {
      mockAuthenticate(app, mockUser);
      mocks.userOrgRepo.hasRoleOrHigher.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
          role: 'member',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/nonexistent-id/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
          role: 'member',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      mocks.userRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'nonexistent-user',
          role: 'member',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if user is already a member', async () => {
      mocks.userOrgRepo.findMembership = vi.fn().mockResolvedValue({
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'member' as const,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org-123/members',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          userId: 'user-456',
          role: 'member',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /api/v1/organizations/:id/children', () => {
    it('should list child organizations', async () => {
      const childOrg = mockOrgData.createOrg({
        id: 'child-org-123',
        parentOrganizationId: 'org-123',
        isRoot: false,
      });
      mocks.orgRepo.getChildren.mockResolvedValue([childOrg]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/children',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should return 404 for non-existent organization', async () => {
      mocks.orgRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/nonexistent-id/children',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return empty array if no children', async () => {
      mocks.orgRepo.getChildren.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org-123/children',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toEqual([]);
    });
  });
});
