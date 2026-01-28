/**
 * Integration tests for Auth routes
 * Tests authentication endpoints: register, login, refresh, logout, password reset
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import {
  createMockRepositories,
  setupSuccessfulMocks,
  mockUserData,
  mockAuthenticate,
  mockUser,
} from '../__tests__/test-helpers.js';
import * as repositories from '../../repositories/index.js';
import * as passwordUtils from '../../utils/password.js';
import * as jwtUtils from '../../utils/jwt.js';

// Mock repositories module
vi.mock('../../repositories/index.js', () => ({
  getUserRepository: vi.fn(),
  getUserOrganizationRepository: vi.fn(),
  getRefreshTokenRepository: vi.fn(),
  getPasswordResetTokenRepository: vi.fn(),
  hashRefreshToken: vi.fn((token) => `hashed-${token}`),
  hashResetToken: vi.fn((token) => `hashed-${token}`),
}));

// Mock password utilities
vi.mock('../../utils/password.js', () => ({
  hashPassword: vi.fn(() => Promise.resolve('$argon2id$mockhash')),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));

// Mock JWT utilities
vi.mock('../../utils/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'mock-access-token'),
  verifyAccessToken: vi.fn(),
}));

describe('Auth Routes', () => {
  let app: FastifyInstance;
  let mocks: ReturnType<typeof createMockRepositories>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks = createMockRepositories();
    setupSuccessfulMocks(mocks);

    // Setup repository getters to return our mocks
    vi.mocked(repositories.getUserRepository).mockReturnValue(mocks.userRepo as any);
    vi.mocked(repositories.getUserOrganizationRepository).mockReturnValue(mocks.userOrgRepo as any);
    vi.mocked(repositories.getRefreshTokenRepository).mockReturnValue(mocks.refreshTokenRepo as any);
    vi.mocked(repositories.getPasswordResetTokenRepository).mockReturnValue(mocks.passwordResetRepo as any);

    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      mocks.userRepo.existsByEmail.mockResolvedValue(false);
      mocks.userRepo.create.mockResolvedValue(mockUserData.createUser());

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'User',
          organizationId: 'org-123',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body.email).toBe('test@example.com');
      expect(mocks.userRepo.create).toHaveBeenCalled();
      expect(mocks.userOrgRepo.addMember).toHaveBeenCalled();
    });

    it('should return 409 if email already exists', async () => {
      mocks.userRepo.existsByEmail.mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'existing@example.com',
          password: 'SecurePass123!',
          organizationId: 'org-123',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty('error');
      expect(mocks.userRepo.create).not.toHaveBeenCalled();
    });

    it('should return 400 if organizationId is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'SecurePass123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'SecurePass123!',
          organizationId: 'org-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should hash the password before storing', async () => {
      mocks.userRepo.existsByEmail.mockResolvedValue(false);

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'SecurePass123!',
          organizationId: 'org-123',
        },
      });

      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('SecurePass123!');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = mockUserData.createUser();
      mocks.userRepo.findByEmail.mockResolvedValue(user);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('expiresIn');
      expect(body).toHaveProperty('user');
      expect(body.user.email).toBe('test@example.com');
    });

    it('should return 401 for invalid email', async () => {
      mocks.userRepo.findByEmail.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for invalid password', async () => {
      const user = mockUserData.createUser();
      mocks.userRepo.findByEmail.mockResolvedValue(user);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for inactive user', async () => {
      const user = mockUserData.createUser({ status: 'suspended' });
      mocks.userRepo.findByEmail.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.message).toContain('not active');
    });

    it('should return 401 for SSO-only users', async () => {
      const user = mockUserData.createUser({ passwordHash: null });
      mocks.userRepo.findByEmail.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.message).toContain('SSO');
    });

    it('should update last login timestamp', async () => {
      const user = mockUserData.createUser();
      mocks.userRepo.findByEmail.mockResolvedValue(user);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(mocks.userRepo.updateLastLogin).toHaveBeenCalled();
    });

    it('should create refresh token with metadata', async () => {
      const user = mockUserData.createUser();
      mocks.userRepo.findByEmail.mockResolvedValue(user);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
        headers: {
          'user-agent': 'Test Browser',
        },
      });

      expect(mocks.refreshTokenRepo.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userAgent: 'Test Browser',
        })
      );
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const user = mockUserData.createUser();
      mocks.userRepo.findById.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.refreshToken).toBe('new-refresh-token');
    });

    it('should return 401 for invalid refresh token', async () => {
      mocks.refreshTokenRepo.findByTokenHashIncludeRevoked.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for revoked refresh token', async () => {
      const revokedToken = { ...mocks.refreshTokenRepo.findByTokenHashIncludeRevoked(), isRevoked: true };
      mocks.refreshTokenRepo.findByTokenHashIncludeRevoked.mockResolvedValue(revokedToken as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'revoked-token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mocks.refreshTokenRepo.revokeFamilyTokens).toHaveBeenCalled();
    });

    it('should return 401 for expired refresh token', async () => {
      const expiredToken = {
        ...mocks.refreshTokenRepo.findByTokenHashIncludeRevoked(),
        expiresAt: new Date(Date.now() - 1000),
      };
      mocks.refreshTokenRepo.findByTokenHashIncludeRevoked.mockResolvedValue(expiredToken as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'expired-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 if user is inactive', async () => {
      const inactiveUser = mockUserData.createUser({ status: 'suspended' });
      mocks.userRepo.findById.mockResolvedValue(inactiveUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'valid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mocks.refreshTokenRepo.revokeFamilyTokens).toHaveBeenCalled();
    });

    it('should rotate the refresh token', async () => {
      const user = mockUserData.createUser();
      mocks.userRepo.findById.mockResolvedValue(user);

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'valid-token',
        },
      });

      expect(mocks.refreshTokenRepo.rotate).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {
          refreshToken: 'valid-token',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(mocks.refreshTokenRepo.revokeById).toHaveBeenCalled();
    });

    it('should return 204 even for invalid token', async () => {
      mocks.refreshTokenRepo.findByTokenHashIncludeRevoked.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should not revoke already revoked token', async () => {
      const revokedToken = { id: 'token-123', isRevoked: true };
      mocks.refreshTokenRepo.findByTokenHashIncludeRevoked.mockResolvedValue(revokedToken as any);

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {
          refreshToken: 'revoked-token',
        },
      });

      expect(mocks.refreshTokenRepo.revokeById).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockUser);
    });

    it('should logout all sessions for authenticated user', async () => {
      mocks.refreshTokenRepo.revokeAllUserTokens.mockResolvedValue(3);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.revokedCount).toBe(3);
    });

    it('should return 401 without authentication', async () => {
      // Remove authentication mock
      app.decorate('authenticate', async () => {
        throw { statusCode: 401, message: 'Unauthorized' };
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should create password reset token for existing user', async () => {
      const user = mockUserData.createUser({ status: 'active' });
      mocks.userRepo.findByEmail.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.passwordResetRepo.create).toHaveBeenCalled();
      const body = response.json();
      expect(body.message).toContain('reset link');
    });

    it('should return success even for non-existent email', async () => {
      mocks.userRepo.findByEmail.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: 'nonexistent@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.passwordResetRepo.create).not.toHaveBeenCalled();
    });

    it('should not create token for inactive users', async () => {
      const user = mockUserData.createUser({ status: 'suspended' });
      mocks.userRepo.findByEmail.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: 'suspended@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.passwordResetRepo.create).not.toHaveBeenCalled();
    });

    it('should return reset token in development', async () => {
      process.env.NODE_ENV = 'development';
      const user = mockUserData.createUser({ status: 'active' });
      mocks.userRepo.findByEmail.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('resetToken');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const user = mockUserData.createUser({ status: 'active' });
      mocks.userRepo.findById.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: 'valid-reset-token',
          password: 'NewSecurePass123!',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.userRepo.updatePassword).toHaveBeenCalled();
      expect(mocks.passwordResetRepo.markUsed).toHaveBeenCalled();
      expect(mocks.refreshTokenRepo.revokeAllUserTokens).toHaveBeenCalled();
    });

    it('should return 400 for invalid token', async () => {
      mocks.passwordResetRepo.findValidByTokenHash.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: 'invalid-token',
          password: 'NewSecurePass123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if user is inactive', async () => {
      const user = mockUserData.createUser({ status: 'suspended' });
      mocks.userRepo.findById.mockResolvedValue(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: 'valid-token',
          password: 'NewSecurePass123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should revoke all refresh tokens after password reset', async () => {
      const user = mockUserData.createUser({ status: 'active' });
      mocks.userRepo.findById.mockResolvedValue(user);

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: 'valid-token',
          password: 'NewSecurePass123!',
        },
      });

      expect(mocks.refreshTokenRepo.revokeAllUserTokens).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/auth/organizations', () => {
    beforeEach(() => {
      mockAuthenticate(app, mockUser);
    });

    it('should return user organizations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('organizations');
      expect(body).toHaveProperty('currentOrganizationId');
      expect(Array.isArray(body.organizations)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      app.decorate('authenticate', async () => {
        throw { statusCode: 401, message: 'Unauthorized' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/organizations',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should include organization details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/organizations',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const body = response.json();
      if (body.organizations.length > 0) {
        const org = body.organizations[0];
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('name');
        expect(org).toHaveProperty('slug');
        expect(org).toHaveProperty('role');
        expect(org).toHaveProperty('isPrimary');
      }
    });
  });
});
