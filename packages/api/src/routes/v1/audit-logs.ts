/**
 * Audit Log routes - Query endpoints for audit logs
 * Read-only access to security and compliance audit data
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  findAuditLogs,
  findAuditLogById,
  getRecentActivity,
  type AuditLogFilter,
} from '../../repositories/audit-log.repository.js';
import { Errors, createOrganizationId, createUserId } from '@argus/shared';

// Response schema for a single audit log
const auditLogResponseSchema = z.object({
  id: z.string(),
  category: z.string(),
  action: z.string(),
  userId: z.string().nullable(),
  userEmail: z.string().nullable(),
  organizationId: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  outcome: z.string(),
  requestId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
});

// Response schema for audit log list
const auditLogListResponseSchema = z.object({
  data: z.array(auditLogResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});

// Response schema for recent activity
const recentActivityResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      action: z.string(),
      userEmail: z.string().nullable(),
      resourceType: z.string().nullable(),
      resourceId: z.string().nullable(),
      outcome: z.string(),
      createdAt: z.string(),
    })
  ),
});

export async function auditLogRoutes(app: FastifyInstance): Promise<void> {
  // GET /audit-logs - List audit logs with filters
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          organizationId: z.string().uuid().optional(),
          userId: z.string().uuid().optional(),
          category: z.string().optional(),
          action: z.string().optional(),
          resourceType: z.string().optional(),
          resourceId: z.string().optional(),
          outcome: z.string().optional(),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().optional(),
          search: z.string().optional(),
        }),
        response: {
          200: auditLogListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, startDate, endDate, organizationId, userId, ...rest } =
        request.query;

      const filter: AuditLogFilter = {
        ...rest,
        organizationId: organizationId
          ? createOrganizationId(organizationId)
          : undefined,
        userId: userId ? createUserId(userId) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      };

      const result = await findAuditLogs(filter, { page, pageSize });

      return {
        data: result.data.map((log) => ({
          id: log.id.toString(),
          category: log.category,
          action: log.action,
          userId: log.userId,
          userEmail: log.userEmail,
          organizationId: log.organizationId,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          details: log.details as Record<string, unknown> | null,
          outcome: log.outcome,
          requestId: log.requestId,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /audit-logs/recent - Get recent activity for dashboard
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recent',
    {
      schema: {
        querystring: z.object({
          organizationId: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(50).default(10),
        }),
        response: {
          200: recentActivityResponseSchema,
        },
      },
    },
    async (request) => {
      const { organizationId, limit } = request.query;

      const data = await getRecentActivity(
        organizationId ? createOrganizationId(organizationId) : undefined,
        limit
      );

      return {
        data: data.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    }
  );

  // GET /audit-logs/:id - Get a single audit log by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: auditLogResponseSchema,
          404: z.object({
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
      const log = await findAuditLogById(request.params.id);

      if (!log) {
        throw Errors.notFound('AuditLog', request.params.id);
      }

      return {
        id: log.id.toString(),
        category: log.category,
        action: log.action,
        userId: log.userId,
        userEmail: log.userEmail,
        organizationId: log.organizationId,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: log.details as Record<string, unknown> | null,
        outcome: log.outcome,
        requestId: log.requestId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      };
    }
  );
}
