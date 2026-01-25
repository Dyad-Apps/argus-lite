/**
 * Impersonation Routes
 * Admin endpoints for user impersonation functionality
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  Errors,
  createUserId,
  createOrganizationId,
} from '@argus/shared';
import { impersonationService } from '../../services/impersonation.service.js';
import { getImpersonationRepository } from '../../repositories/index.js';

// Response schemas
const userInfoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

const impersonationSessionResponseSchema = z.object({
  id: z.string().uuid(),
  impersonator: userInfoSchema,
  target: userInfoSchema,
  organizationId: z.string().uuid().nullable(),
  reason: z.string(),
  status: z.enum(['active', 'ended', 'expired', 'revoked']),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  expiresAt: z.string(),
});

const impersonationListResponseSchema = z.object({
  data: z.array(impersonationSessionResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});

const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.string(),
  }),
});

export async function impersonationRoutes(app: FastifyInstance): Promise<void> {
  const impersonationRepo = getImpersonationRepository();

  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /admin/impersonate/start - Start impersonation session
  app.withTypeProvider<ZodTypeProvider>().post(
    '/admin/impersonate/start',
    {
      schema: {
        body: z.object({
          targetUserId: z.string().uuid(),
          organizationId: z.string().uuid().optional(),
          reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
          durationMinutes: z.number().int().min(5).max(480).optional().default(60),
        }),
        response: {
          200: z.object({
            sessionId: z.string().uuid(),
            accessToken: z.string(),
            expiresAt: z.string(),
            targetUser: userInfoSchema,
          }),
          400: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { targetUserId, organizationId, reason, durationMinutes } = request.body;

      try {
        const result = await impersonationService.startImpersonation({
          impersonatorId: request.user!.id,
          targetUserId: createUserId(targetUserId),
          organizationId: organizationId ? createOrganizationId(organizationId) : undefined,
          reason,
          durationMs: durationMinutes * 60 * 1000,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        return {
          sessionId: result.sessionId,
          accessToken: result.accessToken,
          expiresAt: result.expiresAt.toISOString(),
          targetUser: result.targetUser,
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('permission')) {
            throw Errors.forbidden(error.message);
          }
          if (error.message.includes('not found')) {
            throw Errors.notFound('User', targetUserId);
          }
          throw Errors.badRequest(error.message);
        }
        throw error;
      }
    }
  );

  // POST /admin/impersonate/end - End impersonation session
  app.withTypeProvider<ZodTypeProvider>().post(
    '/admin/impersonate/end',
    {
      schema: {
        body: z.object({
          sessionId: z.string().uuid().optional(),
        }).passthrough().optional(),
        response: {
          200: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
          400: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const sessionId = request.body?.sessionId;

      console.log('End impersonation request:', {
        userId: request.user!.id,
        sessionId,
      });

      try {
        await impersonationService.endImpersonation(request.user!.id, sessionId);
        return {
          success: true as const,
          message: 'Impersonation session ended',
        };
      } catch (error) {
        console.error('End impersonation error:', error);
        if (error instanceof Error) {
          if (error.message.includes('not found') || error.message.includes('No active')) {
            throw Errors.notFound('ImpersonationSession', sessionId ?? 'active');
          }
          throw Errors.badRequest(error.message);
        }
        throw error;
      }
    }
  );

  // GET /admin/impersonate/status - Get current impersonation status
  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/impersonate/status',
    {
      schema: {
        response: {
          200: z.object({
            isImpersonating: z.boolean(),
            sessionId: z.string().uuid().optional(),
            impersonator: userInfoSchema.optional(),
            target: userInfoSchema.optional(),
            startedAt: z.string().optional(),
            expiresAt: z.string().optional(),
            reason: z.string().optional(),
          }),
        },
      },
    },
    async (request) => {
      const status = await impersonationService.getActiveStatus(request.user!.id);

      return {
        isImpersonating: status.isImpersonating,
        sessionId: status.sessionId,
        impersonator: status.impersonator,
        target: status.target,
        startedAt: status.startedAt?.toISOString(),
        expiresAt: status.expiresAt?.toISOString(),
        reason: status.reason,
      };
    }
  );

  // GET /admin/impersonate/history - Get impersonation history for current user
  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/impersonate/history',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: impersonationListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize } = request.query;

      const result = await impersonationService.getHistory(request.user!.id, {
        page,
        pageSize,
      });

      return {
        data: result.data.map((session) => ({
          id: session.id,
          impersonator: session.impersonator,
          target: session.target,
          organizationId: session.organizationId,
          reason: session.reason,
          status: session.status,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() ?? null,
          expiresAt: session.expiresAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /admin/impersonate/sessions - Get all active sessions (admin only)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/impersonate/sessions',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: impersonationListResponseSchema,
          403: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      // Only Super Admins can view all sessions
      const canImpersonate = await impersonationService.canImpersonate(request.user!.id);
      if (!canImpersonate) {
        throw Errors.forbidden('Only Super Admins can view all impersonation sessions');
      }

      const { page, pageSize } = request.query;

      const result = await impersonationService.getActiveSessions({
        page,
        pageSize,
      });

      return {
        data: result.data.map((session) => ({
          id: session.id,
          impersonator: session.impersonator,
          target: session.target,
          organizationId: session.organizationId,
          reason: session.reason,
          status: session.status,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() ?? null,
          expiresAt: session.expiresAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // POST /admin/impersonate/sessions/:id/revoke - Revoke a session (admin only)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/admin/impersonate/sessions/:id/revoke',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
          400: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;

      // Only Super Admins can revoke sessions
      const canImpersonate = await impersonationService.canImpersonate(request.user!.id);
      if (!canImpersonate) {
        throw Errors.forbidden('Only Super Admins can revoke impersonation sessions');
      }

      try {
        await impersonationService.revokeSession(id, request.user!.id);
        return {
          success: true as const,
          message: 'Impersonation session revoked',
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw Errors.notFound('ImpersonationSession', id);
          }
          throw Errors.badRequest(error.message);
        }
        throw error;
      }
    }
  );

  // GET /admin/impersonate/can-impersonate - Check if current user can impersonate
  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/impersonate/can-impersonate',
    {
      schema: {
        response: {
          200: z.object({
            canImpersonate: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const canImpersonate = await impersonationService.canImpersonate(request.user!.id);
      return { canImpersonate };
    }
  );
}
