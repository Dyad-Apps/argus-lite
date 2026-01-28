/**
 * Integration tests for User routes
 * Tests user CRUD operations and organization filtering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import {
  createMockRepositories,
  setupSuccessfulMocks,
  mockAuthenticate,
  mockUser,
  mockUserData,
} from '../__tests__/test-helpers.js';
import * as repositories from '../../repositories/index.js';

// Mock repositories module
vi.mock('../../repositories/index.js', () => ({
  getUserRepository: vi.fn(),
  getUserOrganizationRepository: vi.fn(),
  getSystemAdminRepository: vi.fn(),
}));

describe('User Routes', () => {
  let app: FastifyInstance;
  let mocks: ReturnType<typeof createMockRepositories>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks = createMockRepositories();
    setupSuccessfulMocks(mocks);

    // Setup repository getters
    vi.mocked(repositories.getUserRepository).mockReturnValue(mocks.userRepo as any);
    vi.mocked(repositories.getUserOrganizationRepository).mockReturnValue(mocks.userOrgRepo as any);
    vi.mocked(repositories.getSystemAdminRepository).mockReturnValue(mocks.systemAdminRepo as any);

    app = await buildApp();
    await app.ready();
    mockAuthenticate(app, mockUser);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/users', () => {
    it('should list users for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
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
        url: '/api/v1/users?page=2&pageSize=10',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.userRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 })
      );
    });

    it('should filter by organizationId parameter', async () => {
      mocks.systemAdminRepo.isSuperAdmin.mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users?organizationId=org-456',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.userRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: expect.anything(),
        })
      );
    });

    it('should filter to current organization for non-super admin', async () => {
      mocks.systemAdminRepo.isSuperAdmin.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.userRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: expect.anything(),
        })
      );
    });

    it('should return empty list if user has no organization context', async () => {
      const userWithoutOrg = {
        ...mockUser,
        organizationContext: undefined,
      };
      mockAuthenticate(app, userWithoutOrg);
      mocks.systemAdminRepo.isSuperAdmin.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.totalCount).toBe(0);
    });

    it('should allow super admin to see all users', async () => {
      mocks.systemAdminRepo.isSuperAdmin.mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return user fields in correct format', async () => {
      const users = [
        mockUserData.createUser({
          id: 'user-1',
          email: 'user1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          status: 'active',
        }),
      ];
      mocks.userRepo.findAll.mockResolvedValue({
        data: users,
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
        url: '/api/v1/users',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const body = response.json();
      expect(body.data[0]).toHaveProperty('id');
      expect(body.data[0]).toHaveProperty('email');
      expect(body.data[0]).toHaveProperty('firstName');
      expect(body.data[0]).toHaveProperty('lastName');
      expect(body.data[0]).toHaveProperty('status');
      expect(body.data[0]).toHaveProperty('createdAt');
      expect(body.data[0]).toHaveProperty('updatedAt');
    });

    it('should return 401 without authentication', async () => {
      app.decorate('authenticate', async () => {
        throw { statusCode: 401, message: 'Unauthorized' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by id', async () => {
      const user = mockUserData.createUser({ id: 'user-123' });
      mocks.userRepo.findById.mockResolvedValue(user);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('email');
      expect(body).toHaveProperty('firstName');
      expect(body).toHaveProperty('lastName');
    });

    it('should return 404 for non-existent user', async () => {
      mocks.userRepo.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should include all user fields', async () => {
      const user = mockUserData.createUser({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        emailVerifiedAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-01-15'),
      });
      mocks.userRepo.findById.mockResolvedValue(user);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const body = response.json();
      expect(body.email).toBe('test@example.com');
      expect(body.firstName).toBe('Test');
      expect(body.lastName).toBe('User');
      expect(body.status).toBe('active');
    });

    it('should return 401 without authentication', async () => {
      app.decorate('authenticate', async () => {
        throw { statusCode: 401, message: 'Unauthorized' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/user-123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate UUID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/invalid-uuid',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user', async () => {
      const updatedUser = mockUserData.createUser({
        id: 'user-123',
        firstName: 'Updated',
        lastName: 'Name',
      });
      mocks.userRepo.update.mockResolvedValue(updatedUser);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          firstName: 'Updated',
          lastName: 'Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.firstName).toBe('Updated');
      expect(body.lastName).toBe('Name');
      expect(mocks.userRepo.update).toHaveBeenCalled();
    });

    it('should return 404 for non-existent user', async () => {
      mocks.userRepo.update.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          firstName: 'Updated',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should allow partial updates', async () => {
      const updatedUser = mockUserData.createUser({ firstName: 'JustFirstName' });
      mocks.userRepo.update.mockResolvedValue(updatedUser);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          firstName: 'JustFirstName',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.userRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ firstName: 'JustFirstName' })
      );
    });

    it('should update status field', async () => {
      const updatedUser = mockUserData.createUser({ status: 'suspended' });
      mocks.userRepo.update.mockResolvedValue(updatedUser);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          status: 'suspended',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('suspended');
    });

    it('should validate input data', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
        payload: {
          status: 'invalid-status',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      app.decorate('authenticate', async () => {
        throw { statusCode: 401, message: 'Unauthorized' };
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/user-123',
        payload: {
          firstName: 'Updated',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should soft delete user', async () => {
      mocks.userRepo.softDelete.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(mocks.userRepo.softDelete).toHaveBeenCalled();
    });

    it('should return 404 for non-existent user', async () => {
      mocks.userRepo.softDelete.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/nonexistent-id',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not return content on success', async () => {
      mocks.userRepo.softDelete.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/user-123',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    });

    it('should return 401 without authentication', async () => {
      app.decorate('authenticate', async () => {
        throw { statusCode: 401, message: 'Unauthorized' };
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/user-123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate UUID format', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/invalid-uuid',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
