/**
 * Auth routes - registration, login, and token management
 * Note: Login and token routes will be added in subsequent issues
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createUserSchema,
  userResponseSchema,
  passwordSchema,
  Errors,
} from '@argus/shared';
import {
  getUserRepository,
  getUserOrganizationRepository,
  getRefreshTokenRepository,
  hashRefreshToken,
  getPasswordResetTokenRepository,
  hashResetToken,
} from '../../repositories/index.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
} from '../../utils/index.js';
import { createUserId } from '@argus/shared';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const userRepo = getUserRepository();
  const userOrgRepo = getUserOrganizationRepository();
  const refreshTokenRepo = getRefreshTokenRepository();
  const passwordResetRepo = getPasswordResetTokenRepository();

  // POST /auth/register - Create a new user account
  // ADR-002: Users must belong to a root organization
  app.withTypeProvider<ZodTypeProvider>().post(
    '/register',
    {
      schema: {
        body: createUserSchema.extend({
          // Organization context from subdomain or explicit parameter
          organizationId: z.string().uuid().optional(),
        }),
        response: {
          201: userResponseSchema,
          409: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password, firstName, lastName, organizationId } = request.body;

      // For now, organizationId is required - in a full implementation,
      // this would come from subdomain resolution or invitation context
      if (!organizationId) {
        throw Errors.badRequest('Organization context required for registration');
      }

      // Check if email already exists in this organization
      // ADR-002: Email is unique per root organization
      const existingUser = await userRepo.existsByEmail(email);
      if (existingUser) {
        throw Errors.conflict('User with this email already exists');
      }

      // Hash password with Argon2id
      const passwordHash = await hashPassword(password);

      // Create user with organization context
      // ADR-002: rootOrganizationId and primaryOrganizationId are required
      const user = await userRepo.create({
        email,
        passwordHash,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        rootOrganizationId: organizationId,
        primaryOrganizationId: organizationId,
      });

      // Add user to organization as a member
      // This creates the user_organizations entry needed for membership checks
      await userOrgRepo.addMember({
        userId: user.id,
        organizationId: organizationId,
        role: 'member',
        isPrimary: true,
      });

      return reply.status(201).send({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      });
    }
  );

  // POST /auth/login - Authenticate and get tokens
  app.withTypeProvider<ZodTypeProvider>().post(
    '/login',
    {
      schema: {
        body: z.object({
          email: z.string().email().transform((e) => e.toLowerCase().trim()),
          password: z.string().min(1, 'Password is required'),
        }),
        response: {
          200: z.object({
            accessToken: z.string(),
            refreshToken: z.string(),
            expiresIn: z.number(),
            user: userResponseSchema,
          }),
          401: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { email, password } = request.body;

      // Find user by email
      const user = await userRepo.findByEmail(email);
      if (!user) {
        throw Errors.unauthorized('Invalid email or password');
      }

      // Check if account is active
      if (user.status !== 'active') {
        throw Errors.unauthorized('Account is not active');
      }

      // Check if user has a password (SSO-only users don't)
      if (!user.passwordHash) {
        throw Errors.unauthorized('Please use SSO to sign in');
      }

      // Verify password
      const isValid = await verifyPassword(user.passwordHash, password);
      if (!isValid) {
        throw Errors.unauthorized('Invalid email or password');
      }

      // Update last login timestamp
      const userId = createUserId(user.id);
      await userRepo.updateLastLogin(userId);

      // Generate tokens
      const accessToken = signAccessToken(userId, user.email);
      const { token: refreshToken } = await refreshTokenRepo.create(userId, {
        userAgent: request.headers['user-agent'] ?? undefined,
        ipAddress: request.ip,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
          lastLoginAt: new Date().toISOString(), // Use current time since we just updated it
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      };
    }
  );

  // POST /auth/refresh - Refresh access token using refresh token
  app.withTypeProvider<ZodTypeProvider>().post(
    '/refresh',
    {
      schema: {
        body: z.object({
          refreshToken: z.string().min(1, 'Refresh token is required'),
        }),
        response: {
          200: z.object({
            accessToken: z.string(),
            refreshToken: z.string(),
            expiresIn: z.number(),
          }),
          401: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { refreshToken } = request.body;
      const tokenHash = hashRefreshToken(refreshToken);

      // Check if token exists (including revoked for theft detection)
      const existingToken = await refreshTokenRepo.findByTokenHashIncludeRevoked(tokenHash);

      if (!existingToken) {
        throw Errors.unauthorized('Invalid refresh token');
      }

      // Check for token reuse (potential theft)
      if (existingToken.isRevoked) {
        // Revoke all tokens in this family
        await refreshTokenRepo.revokeFamilyTokens(existingToken.familyId);
        throw Errors.unauthorized('Refresh token has been revoked');
      }

      // Check expiration
      if (new Date() > existingToken.expiresAt) {
        throw Errors.unauthorized('Refresh token has expired');
      }

      // Get user to verify they're still active
      const userId = createUserId(existingToken.userId);
      const user = await userRepo.findById(userId);

      if (!user || user.status !== 'active') {
        await refreshTokenRepo.revokeFamilyTokens(existingToken.familyId);
        throw Errors.unauthorized('User account is not active');
      }

      // Rotate the refresh token (revoke old, create new in same family)
      const { token: newRefreshToken } = await refreshTokenRepo.rotate(
        existingToken,
        {
          userAgent: request.headers['user-agent'] ?? undefined,
          ipAddress: request.ip,
        }
      );

      // Generate new access token
      const accessToken = signAccessToken(userId, user.email);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900, // 15 minutes in seconds
      };
    }
  );

  // POST /auth/logout - Logout current session
  app.withTypeProvider<ZodTypeProvider>().post(
    '/logout',
    {
      schema: {
        body: z.object({
          refreshToken: z.string().min(1, 'Refresh token is required'),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;
      const tokenHash = hashRefreshToken(refreshToken);

      // Find and revoke the token (even if already revoked or expired)
      const token = await refreshTokenRepo.findByTokenHashIncludeRevoked(tokenHash);
      if (token && !token.isRevoked) {
        await refreshTokenRepo.revokeById(token.id);
      }

      // Always return success (don't reveal if token was valid)
      return reply.status(204).send(null);
    }
  );

  // POST /auth/logout-all - Logout all sessions (requires authentication)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/logout-all',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: z.object({
            revokedCount: z.number(),
          }),
          401: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      // user is attached by authenticate preHandler
      const revokedCount = await refreshTokenRepo.revokeAllUserTokens(request.user!.id);

      return { revokedCount };
    }
  );

  // POST /auth/forgot-password - Request password reset
  app.withTypeProvider<ZodTypeProvider>().post(
    '/forgot-password',
    {
      schema: {
        body: z.object({
          email: z.string().email().transform((e) => e.toLowerCase().trim()),
        }),
        response: {
          200: z.object({
            message: z.string(),
            // In development, return the token for testing
            resetToken: z.string().optional(),
          }),
        },
      },
    },
    async (request) => {
      const { email } = request.body;

      // Find user by email (always return success to prevent email enumeration)
      const user = await userRepo.findByEmail(email);

      if (user && user.status === 'active') {
        const userId = createUserId(user.id);
        const { token } = await passwordResetRepo.create(userId);

        // In production, this would send an email
        // For development/testing, return the token
        const isDev = process.env.NODE_ENV !== 'production';

        if (isDev) {
          return {
            message: 'If an account exists with that email, a reset link has been sent.',
            resetToken: token,
          };
        }
      }

      return {
        message: 'If an account exists with that email, a reset link has been sent.',
      };
    }
  );

  // POST /auth/reset-password - Reset password with token
  app.withTypeProvider<ZodTypeProvider>().post(
    '/reset-password',
    {
      schema: {
        body: z.object({
          token: z.string().min(1, 'Reset token is required'),
          password: passwordSchema,
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          400: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { token, password } = request.body;
      const tokenHash = hashResetToken(token);

      // Find valid token
      const resetToken = await passwordResetRepo.findValidByTokenHash(tokenHash);

      if (!resetToken) {
        throw Errors.badRequest('Invalid or expired reset token');
      }

      // Get user
      const userId = createUserId(resetToken.userId);
      const user = await userRepo.findById(userId);

      if (!user || user.status !== 'active') {
        throw Errors.badRequest('Invalid or expired reset token');
      }

      // Hash new password and update
      const passwordHash = await hashPassword(password);
      await userRepo.updatePassword(userId, passwordHash);

      // Mark token as used
      await passwordResetRepo.markUsed(resetToken.id);

      // Revoke all refresh tokens (force re-login on all devices)
      await refreshTokenRepo.revokeAllUserTokens(userId);

      return {
        message: 'Password has been reset successfully. Please log in with your new password.',
      };
    }
  );
}
