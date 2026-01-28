/**
 * Activity routes - CRUD operations for work items and workflows
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createActivitySchema,
  updateActivitySchema,
  approveActivitySchema,
  activityResponseSchema,
  activityListResponseSchema,
  activityQuerySchema,
  Errors,
  type OrganizationId,
  type UserId,
} from '@argus/shared';
import { getActivityRepository } from '../../repositories/index.js';
import { auditService } from '../../services/audit.service.js';

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  const activityRepo = getActivityRepository();

  // All activity routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /activities - List all activities in current organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: activityQuerySchema,
        response: {
          200: activityListResponseSchema,
        },
      },
    },
    async (request) => {
      const {
        page,
        pageSize,
        status,
        priority,
        activityTypeId,
        assignedToUserId,
        initiatorUserId,
        targetType,
        targetId,
        pendingApproval,
        search,
      } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      let result;

      if (pendingApproval) {
        result = await activityRepo.findPendingApproval(
          organizationId,
          { page, pageSize }
        );
      } else if (status) {
        result = await activityRepo.findByStatus(
          organizationId,
          status,
          { page, pageSize }
        );
      } else if (priority) {
        result = await activityRepo.findByPriority(
          organizationId,
          priority,
          { page, pageSize }
        );
      } else if (assignedToUserId) {
        result = await activityRepo.findAssignedToUser(
          organizationId,
          assignedToUserId as UserId,
          { page, pageSize }
        );
      } else if (initiatorUserId) {
        result = await activityRepo.findInitiatedByUser(
          organizationId,
          initiatorUserId as UserId,
          { page, pageSize }
        );
      } else if (targetType && targetId) {
        result = await activityRepo.findByTarget(
          organizationId,
          targetType,
          targetId,
          { page, pageSize }
        );
      } else if (search) {
        // For search, get all results then manually paginate
        const activities = await activityRepo.searchByName(organizationId, search);
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = activities.slice(start, end);

        result = {
          data: paginatedData,
          pagination: {
            page,
            pageSize,
            totalCount: activities.length,
            totalPages: Math.ceil(activities.length / pageSize),
            hasNext: end < activities.length,
            hasPrevious: page > 1,
          },
        };
      } else {
        result = await activityRepo.findAllInTenant(
          organizationId,
          { page, pageSize }
        );
      }

      return {
        data: result.data.map((activity) => ({
          id: activity.id,
          organizationId: activity.organizationId,
          activityTypeId: activity.activityTypeId,
          parentActivityId: activity.parentActivityId,
          name: activity.name,
          description: activity.description,
          status: activity.status,
          priority: activity.priority,
          initiatorType: activity.initiatorType as 'person' | 'system' | 'rule' | 'alarm',
          initiatorUserId: activity.initiatorUserId,
          targetType: activity.targetType as 'asset' | 'device' | 'space' | 'person' | 'organization',
          targetId: activity.targetId,
          assignedToUserId: activity.assignedToUserId,
          assignedToRole: activity.assignedToRole,
          dueAt: activity.dueAt?.toISOString() ?? null,
          scheduledStart: activity.scheduledStart?.toISOString() ?? null,
          scheduledEnd: activity.scheduledEnd?.toISOString() ?? null,
          startedAt: activity.startedAt?.toISOString() ?? null,
          completedAt: activity.completedAt?.toISOString() ?? null,
          requiresApproval: activity.requiresApproval ?? false,
          approvalStatus: activity.approvalStatus as 'pending_approval' | 'approved' | 'rejected' | null,
          approvedByUserId: activity.approvedByUserId,
          approvedAt: activity.approvedAt?.toISOString() ?? null,
          completionNotes: activity.completionNotes,
          checklistResults: activity.checklistResults as Record<string, unknown> | null,
          ownerOrganizationId: activity.ownerOrganizationId,
          assigneeOrganizationId: activity.assigneeOrganizationId,
          customAttributes: activity.customAttributes as Record<string, unknown>,
          createdBy: activity.createdBy,
          createdAt: activity.createdAt.toISOString(),
          updatedAt: activity.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /activities/my-tasks - Get activities assigned to current user
  app.withTypeProvider<ZodTypeProvider>().get(
    '/my-tasks',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          status: z.enum(['pending', 'pending_approval', 'approved', 'in_progress', 'blocked', 'completed', 'cancelled', 'failed']).optional(),
        }),
        response: {
          200: activityListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, status } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id as UserId;

      let result = await activityRepo.findAssignedToUser(
        organizationId,
        userId,
        { page, pageSize }
      );

      // Filter by status if provided
      if (status) {
        result = {
          data: result.data.filter((activity) => activity.status === status),
          pagination: {
            ...result.pagination,
            totalCount: result.data.filter((activity) => activity.status === status).length,
            totalPages: Math.ceil(result.data.filter((activity) => activity.status === status).length / pageSize),
          },
        };
      }

      return {
        data: result.data.map((activity) => ({
          id: activity.id,
          organizationId: activity.organizationId,
          activityTypeId: activity.activityTypeId,
          parentActivityId: activity.parentActivityId,
          name: activity.name,
          description: activity.description,
          status: activity.status,
          priority: activity.priority,
          initiatorType: activity.initiatorType as 'person' | 'system' | 'rule' | 'alarm',
          initiatorUserId: activity.initiatorUserId,
          targetType: activity.targetType as 'asset' | 'device' | 'space' | 'person' | 'organization',
          targetId: activity.targetId,
          assignedToUserId: activity.assignedToUserId,
          assignedToRole: activity.assignedToRole,
          dueAt: activity.dueAt?.toISOString() ?? null,
          scheduledStart: activity.scheduledStart?.toISOString() ?? null,
          scheduledEnd: activity.scheduledEnd?.toISOString() ?? null,
          startedAt: activity.startedAt?.toISOString() ?? null,
          completedAt: activity.completedAt?.toISOString() ?? null,
          requiresApproval: activity.requiresApproval ?? false,
          approvalStatus: activity.approvalStatus as 'pending_approval' | 'approved' | 'rejected' | null,
          approvedByUserId: activity.approvedByUserId,
          approvedAt: activity.approvedAt?.toISOString() ?? null,
          completionNotes: activity.completionNotes,
          checklistResults: activity.checklistResults as Record<string, unknown> | null,
          ownerOrganizationId: activity.ownerOrganizationId,
          assigneeOrganizationId: activity.assigneeOrganizationId,
          customAttributes: activity.customAttributes as Record<string, unknown>,
          createdBy: activity.createdBy,
          createdAt: activity.createdAt.toISOString(),
          updatedAt: activity.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /activities/:id - Get a specific activity
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: activityResponseSchema,
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
      const { id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;

      const activity = await activityRepo.findById(id, organizationId);

      if (!activity) {
        throw Errors.notFound('Activity', id);
      }

      return {
        id: activity.id,
        organizationId: activity.organizationId,
        activityTypeId: activity.activityTypeId,
        parentActivityId: activity.parentActivityId,
        name: activity.name,
        description: activity.description,
        status: activity.status,
        priority: activity.priority,
        initiatorType: activity.initiatorType as 'person' | 'system' | 'rule' | 'alarm',
        initiatorUserId: activity.initiatorUserId,
        targetType: activity.targetType as 'asset' | 'device' | 'space' | 'person' | 'organization',
        targetId: activity.targetId,
        assignedToUserId: activity.assignedToUserId,
        assignedToRole: activity.assignedToRole,
        dueAt: activity.dueAt?.toISOString() ?? null,
        scheduledStart: activity.scheduledStart?.toISOString() ?? null,
        scheduledEnd: activity.scheduledEnd?.toISOString() ?? null,
        startedAt: activity.startedAt?.toISOString() ?? null,
        completedAt: activity.completedAt?.toISOString() ?? null,
        requiresApproval: activity.requiresApproval ?? false,
        approvalStatus: activity.approvalStatus as 'pending_approval' | 'approved' | 'rejected' | null,
        approvedByUserId: activity.approvedByUserId,
        approvedAt: activity.approvedAt?.toISOString() ?? null,
        completionNotes: activity.completionNotes,
        checklistResults: activity.checklistResults as Record<string, unknown> | null,
        ownerOrganizationId: activity.ownerOrganizationId,
        assigneeOrganizationId: activity.assigneeOrganizationId,
        customAttributes: activity.customAttributes as Record<string, unknown>,
        createdBy: activity.createdBy,
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
      };
    }
  );

  // GET /activities/:id/children - Get child activities
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id/children',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: activityListResponseSchema,
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
      const { id } = request.params;
      const { page, pageSize } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      // Check if parent activity exists
      const parentExists = await activityRepo.exists(id, organizationId);
      if (!parentExists) {
        throw Errors.notFound('Activity', id);
      }

      const result = await activityRepo.findChildren(
        organizationId,
        id,
        { page, pageSize }
      );

      return {
        data: result.data.map((activity) => ({
          id: activity.id,
          organizationId: activity.organizationId,
          activityTypeId: activity.activityTypeId,
          parentActivityId: activity.parentActivityId,
          name: activity.name,
          description: activity.description,
          status: activity.status,
          priority: activity.priority,
          initiatorType: activity.initiatorType as 'person' | 'system' | 'rule' | 'alarm',
          initiatorUserId: activity.initiatorUserId,
          targetType: activity.targetType as 'asset' | 'device' | 'space' | 'person' | 'organization',
          targetId: activity.targetId,
          assignedToUserId: activity.assignedToUserId,
          assignedToRole: activity.assignedToRole,
          dueAt: activity.dueAt?.toISOString() ?? null,
          scheduledStart: activity.scheduledStart?.toISOString() ?? null,
          scheduledEnd: activity.scheduledEnd?.toISOString() ?? null,
          startedAt: activity.startedAt?.toISOString() ?? null,
          completedAt: activity.completedAt?.toISOString() ?? null,
          requiresApproval: activity.requiresApproval ?? false,
          approvalStatus: activity.approvalStatus as 'pending_approval' | 'approved' | 'rejected' | null,
          approvedByUserId: activity.approvedByUserId,
          approvedAt: activity.approvedAt?.toISOString() ?? null,
          completionNotes: activity.completionNotes,
          checklistResults: activity.checklistResults as Record<string, unknown> | null,
          ownerOrganizationId: activity.ownerOrganizationId,
          assigneeOrganizationId: activity.assigneeOrganizationId,
          customAttributes: activity.customAttributes as Record<string, unknown>,
          createdBy: activity.createdBy,
          createdAt: activity.createdAt.toISOString(),
          updatedAt: activity.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // POST /activities - Create a new activity
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createActivitySchema,
        response: {
          201: activityResponseSchema,
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
    async (request, reply) => {
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      const {
        activityTypeId,
        parentActivityId,
        name,
        description,
        status,
        priority,
        initiatorType,
        initiatorUserId,
        targetType,
        targetId,
        assignedToUserId,
        assignedToRole,
        dueAt,
        scheduledStart,
        scheduledEnd,
        requiresApproval,
        customAttributes,
      } = request.body;

      // Verify parent activity exists (if provided)
      if (parentActivityId) {
        const parentExists = await activityRepo.exists(parentActivityId, organizationId);
        if (!parentExists) {
          throw Errors.notFound('Parent activity', parentActivityId);
        }
      }

      const activity = await activityRepo.create({
        organizationId,
        activityTypeId,
        parentActivityId: parentActivityId ?? null,
        name,
        description: description ?? null,
        status,
        priority,
        initiatorType,
        initiatorUserId: initiatorUserId ?? null,
        targetType,
        targetId,
        assignedToUserId: assignedToUserId ?? null,
        assignedToRole: assignedToRole ?? null,
        dueAt: dueAt ? new Date(dueAt) : null,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        startedAt: null,
        completedAt: null,
        requiresApproval,
        approvalStatus: requiresApproval ? 'pending_approval' : null,
        approvedByUserId: null,
        approvedAt: null,
        completionNotes: null,
        checklistResults: null,
        ownerOrganizationId: organizationId,
        assigneeOrganizationId: null,
        customAttributes,
        createdBy: userId,
      });

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'activity.created',
        resourceType: 'activity',
        resourceId: activity.id,
        details: { name: activity.name, targetType, targetId },
      });

      return reply.status(201).send({
        id: activity.id,
        organizationId: activity.organizationId,
        activityTypeId: activity.activityTypeId,
        parentActivityId: activity.parentActivityId,
        name: activity.name,
        description: activity.description,
        status: activity.status,
        priority: activity.priority,
        initiatorType: activity.initiatorType as 'person' | 'system' | 'rule' | 'alarm',
        initiatorUserId: activity.initiatorUserId,
        targetType: activity.targetType as 'asset' | 'device' | 'space' | 'person' | 'organization',
        targetId: activity.targetId,
        assignedToUserId: activity.assignedToUserId,
        assignedToRole: activity.assignedToRole,
        dueAt: activity.dueAt?.toISOString() ?? null,
        scheduledStart: activity.scheduledStart?.toISOString() ?? null,
        scheduledEnd: activity.scheduledEnd?.toISOString() ?? null,
        startedAt: activity.startedAt?.toISOString() ?? null,
        completedAt: activity.completedAt?.toISOString() ?? null,
        requiresApproval: activity.requiresApproval ?? false,
        approvalStatus: activity.approvalStatus as 'pending_approval' | 'approved' | 'rejected' | null,
        approvedByUserId: activity.approvedByUserId,
        approvedAt: activity.approvedAt?.toISOString() ?? null,
        completionNotes: activity.completionNotes,
        checklistResults: activity.checklistResults as Record<string, unknown> | null,
        ownerOrganizationId: activity.ownerOrganizationId,
        assigneeOrganizationId: activity.assigneeOrganizationId,
        customAttributes: activity.customAttributes as Record<string, unknown>,
        createdBy: activity.createdBy,
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /activities/:id - Update an activity
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateActivitySchema,
        response: {
          200: activityResponseSchema,
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
      const { id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      // Check if activity exists
      const exists = await activityRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Activity', id);
      }

      const updateData: any = { ...request.body };

      // Convert datetime strings to Date objects
      if (request.body.dueAt) {
        updateData.dueAt = new Date(request.body.dueAt);
      }
      if (request.body.scheduledStart) {
        updateData.scheduledStart = new Date(request.body.scheduledStart);
      }
      if (request.body.scheduledEnd) {
        updateData.scheduledEnd = new Date(request.body.scheduledEnd);
      }

      // Auto-update timestamps based on status changes
      if (request.body.status === 'in_progress' && !updateData.startedAt) {
        updateData.startedAt = new Date();
      }
      if (
        (request.body.status === 'completed' || request.body.status === 'cancelled' || request.body.status === 'failed') &&
        !updateData.completedAt
      ) {
        updateData.completedAt = new Date();
      }

      const activity = await activityRepo.update(id, organizationId, updateData);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'activity.updated',
        resourceType: 'activity',
        resourceId: id,
        details: { changes: Object.keys(request.body) },
      });

      return {
        id: activity!.id,
        organizationId: activity!.organizationId,
        activityTypeId: activity!.activityTypeId,
        parentActivityId: activity!.parentActivityId,
        name: activity!.name,
        description: activity!.description,
        status: activity!.status,
        priority: activity!.priority,
        initiatorType: activity!.initiatorType as 'person' | 'system' | 'rule' | 'alarm',
        initiatorUserId: activity!.initiatorUserId,
        targetType: activity!.targetType as 'asset' | 'device' | 'space' | 'person' | 'organization',
        targetId: activity!.targetId,
        assignedToUserId: activity!.assignedToUserId,
        assignedToRole: activity!.assignedToRole,
        dueAt: activity!.dueAt?.toISOString() ?? null,
        scheduledStart: activity!.scheduledStart?.toISOString() ?? null,
        scheduledEnd: activity!.scheduledEnd?.toISOString() ?? null,
        startedAt: activity!.startedAt?.toISOString() ?? null,
        completedAt: activity!.completedAt?.toISOString() ?? null,
        requiresApproval: activity!.requiresApproval ?? false,
        approvalStatus: activity!.approvalStatus as 'pending_approval' | 'approved' | 'rejected' | null,
        approvedByUserId: activity!.approvedByUserId,
        approvedAt: activity!.approvedAt?.toISOString() ?? null,
        completionNotes: activity!.completionNotes,
        checklistResults: activity!.checklistResults as Record<string, unknown> | null,
        ownerOrganizationId: activity!.ownerOrganizationId,
        assigneeOrganizationId: activity!.assigneeOrganizationId,
        customAttributes: activity!.customAttributes as Record<string, unknown>,
        createdBy: activity!.createdBy,
        createdAt: activity!.createdAt.toISOString(),
        updatedAt: activity!.updatedAt.toISOString(),
      };
    }
  );

  // POST /activities/:id/approve - Approve or reject an activity
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:id/approve',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: approveActivitySchema,
        response: {
          200: activityResponseSchema,
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
      const { id } = request.params;
      const { approved, notes } = request.body;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      // Check if activity exists
      const activity = await activityRepo.findById(id, organizationId);
      if (!activity) {
        throw Errors.notFound('Activity', id);
      }

      // Verify activity requires approval
      if (!activity.requiresApproval) {
        throw Errors.badRequest('Activity does not require approval');
      }

      // Verify activity is pending approval
      if (activity.approvalStatus !== 'pending_approval') {
        throw Errors.badRequest('Activity is not pending approval');
      }

      const updatedActivity = await activityRepo.update(id, organizationId, {
        approvalStatus: approved ? 'approved' : 'rejected',
        approvedByUserId: userId,
        approvedAt: new Date(),
        status: approved ? 'approved' : 'cancelled',
        completionNotes: notes ?? null,
      });

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: approved ? 'activity.approved' : 'activity.rejected',
        resourceType: 'activity',
        resourceId: id,
        details: { notes },
      });

      return {
        id: updatedActivity!.id,
        organizationId: updatedActivity!.organizationId,
        activityTypeId: updatedActivity!.activityTypeId,
        parentActivityId: updatedActivity!.parentActivityId,
        name: updatedActivity!.name,
        description: updatedActivity!.description,
        status: updatedActivity!.status,
        priority: updatedActivity!.priority,
        initiatorType: updatedActivity!.initiatorType as 'person' | 'system' | 'rule' | 'alarm',
        initiatorUserId: updatedActivity!.initiatorUserId,
        targetType: updatedActivity!.targetType as 'asset' | 'device' | 'space' | 'person' | 'organization',
        targetId: updatedActivity!.targetId,
        assignedToUserId: updatedActivity!.assignedToUserId,
        assignedToRole: updatedActivity!.assignedToRole,
        dueAt: updatedActivity!.dueAt?.toISOString() ?? null,
        scheduledStart: updatedActivity!.scheduledStart?.toISOString() ?? null,
        scheduledEnd: updatedActivity!.scheduledEnd?.toISOString() ?? null,
        startedAt: updatedActivity!.startedAt?.toISOString() ?? null,
        completedAt: updatedActivity!.completedAt?.toISOString() ?? null,
        requiresApproval: updatedActivity!.requiresApproval ?? false,
        approvalStatus: updatedActivity!.approvalStatus as 'pending_approval' | 'approved' | 'rejected' | null,
        approvedByUserId: updatedActivity!.approvedByUserId,
        approvedAt: updatedActivity!.approvedAt?.toISOString() ?? null,
        completionNotes: updatedActivity!.completionNotes,
        checklistResults: updatedActivity!.checklistResults as Record<string, unknown> | null,
        ownerOrganizationId: updatedActivity!.ownerOrganizationId,
        assigneeOrganizationId: updatedActivity!.assigneeOrganizationId,
        customAttributes: updatedActivity!.customAttributes as Record<string, unknown>,
        createdBy: updatedActivity!.createdBy,
        createdAt: updatedActivity!.createdAt.toISOString(),
        updatedAt: updatedActivity!.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /activities/:id - Soft delete an activity
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.undefined(),
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
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      // Check if activity exists
      const activity = await activityRepo.findById(id, organizationId);
      if (!activity) {
        throw Errors.notFound('Activity', id);
      }

      await activityRepo.softDelete(id, organizationId);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'activity.deleted',
        resourceType: 'activity',
        resourceId: id,
        details: { name: activity.name },
      });

      return reply.status(204).send();
    }
  );
}
