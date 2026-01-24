/**
 * Organization routes - CRUD operations for organizations
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationResponseSchema,
  organizationListResponseSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  memberListResponseSchema,
  memberResponseSchema,
  organizationRoleSchema,
  userResponseSchema,
  Errors,
  createOrganizationId,
  createUserId,
  type UserStatus,
} from '@argus/shared';
import {
  getOrganizationRepository,
  getUserOrganizationRepository,
  getUserRepository,
} from '../../repositories/index.js';

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  const orgRepo = getOrganizationRepository();
  const memberRepo = getUserOrganizationRepository();
  const userRepo = getUserRepository();

  // All organization routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /organizations - List all organizations
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          activeOnly: z.coerce.boolean().default(false),
        }),
        response: {
          200: organizationListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, activeOnly } = request.query;
      const result = await orgRepo.findAll({ page, pageSize, activeOnly });

      return {
        data: result.data.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          isActive: org.isActive,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /organizations/:id - Get organization by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: organizationResponseSchema,
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
      const orgId = createOrganizationId(request.params.id);
      const org = await orgRepo.findById(orgId);

      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      };
    }
  );

  // POST /organizations - Create a new organization
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createOrganizationSchema,
        response: {
          201: organizationResponseSchema,
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
      const { name, slug } = request.body;

      // Check if slug is available
      const isAvailable = await orgRepo.isSlugAvailable(slug);
      if (!isAvailable) {
        throw Errors.conflict('Organization with this slug already exists');
      }

      const org = await orgRepo.create({
        name,
        slug: slug.toLowerCase(),
      });

      return reply.status(201).send({
        id: org.id,
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /organizations/:id - Update organization
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateOrganizationSchema,
        response: {
          200: organizationResponseSchema,
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
      const orgId = createOrganizationId(request.params.id);
      const org = await orgRepo.update(orgId, request.body);

      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /organizations/:id - Delete organization
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.null(),
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
      const orgId = createOrganizationId(request.params.id);
      const deleted = await orgRepo.delete(orgId);

      if (!deleted) {
        throw Errors.notFound('Organization', request.params.id);
      }

      return reply.status(204).send(null);
    }
  );

  // ===========================================
  // Member Management Routes
  // ===========================================

  // GET /organizations/:id/members - List organization members
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id/members',
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
          200: memberListResponseSchema,
          403: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
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
      const orgId = createOrganizationId(request.params.id);
      const { page, pageSize } = request.query;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      // Check if user is a member (any role can view members)
      const isMember = await memberRepo.findMembership(request.user!.id, orgId);
      if (!isMember) {
        throw Errors.forbidden('You are not a member of this organization');
      }

      const result = await memberRepo.getOrganizationMembers(orgId, {
        page,
        pageSize,
      });

      return {
        data: result.data.map((member) => ({
          userId: member.userId,
          organizationId: member.organizationId,
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
          invitedBy: member.invitedBy,
          user: {
            id: member.user.id,
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            status: member.user.status as UserStatus,
            emailVerifiedAt: null,
            lastLoginAt: null,
            createdAt: '',
            updatedAt: '',
          },
        })),
        pagination: result.pagination,
      };
    }
  );

  // POST /organizations/:id/members - Add member to organization
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:id/members',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: addMemberSchema,
        response: {
          201: memberResponseSchema,
          403: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
          404: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
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
      const orgId = createOrganizationId(request.params.id);
      const { userId: newUserId, role } = request.body;
      const targetUserId = createUserId(newUserId);

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      // Check if current user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can add members');
      }

      // Verify target user exists
      const targetUser = await userRepo.findById(targetUserId);
      if (!targetUser) {
        throw Errors.notFound('User', newUserId);
      }

      // Check if already a member
      const existingMembership = await memberRepo.findMembership(
        targetUserId,
        orgId
      );
      if (existingMembership) {
        throw Errors.conflict('User is already a member of this organization');
      }

      // Add member
      const membership = await memberRepo.addMember({
        userId: targetUserId,
        organizationId: orgId,
        role,
        invitedBy: request.user!.id,
      });

      return reply.status(201).send({
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
        invitedBy: membership.invitedBy,
      });
    }
  );

  // PATCH /organizations/:id/members/:userId - Update member role
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id/members/:userId',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
          userId: z.string().uuid(),
        }),
        body: updateMemberRoleSchema,
        response: {
          200: memberResponseSchema,
          403: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
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
      const orgId = createOrganizationId(request.params.id);
      const targetUserId = createUserId(request.params.userId);
      const { role } = request.body;

      // Check if current user is owner (only owners can change roles)
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'owner'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only owners can change member roles');
      }

      // Update role
      const membership = await memberRepo.updateRole(targetUserId, orgId, role);
      if (!membership) {
        throw Errors.notFound('Membership');
      }

      return {
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
        invitedBy: membership.invitedBy,
      };
    }
  );

  // DELETE /organizations/:id/members/:userId - Remove member
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id/members/:userId',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
          userId: z.string().uuid(),
        }),
        response: {
          204: z.null(),
          403: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
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
      const orgId = createOrganizationId(request.params.id);
      const targetUserId = createUserId(request.params.userId);
      const currentUserId = request.user!.id;

      // Check if removing self (anyone can leave)
      const isSelf = targetUserId === currentUserId;

      if (!isSelf) {
        // Only admins/owners can remove others
        const hasPermission = await memberRepo.hasRoleOrHigher(
          currentUserId,
          orgId,
          'admin'
        );
        if (!hasPermission) {
          throw Errors.forbidden('Only admins and owners can remove members');
        }
      }

      // Check if target is the last owner
      const targetMembership = await memberRepo.findMembership(
        targetUserId,
        orgId
      );
      if (targetMembership?.role === 'owner') {
        const ownerCount = await memberRepo.countOwners(orgId);
        if (ownerCount <= 1) {
          throw Errors.forbidden(
            'Cannot remove the last owner. Transfer ownership first.'
          );
        }
      }

      const removed = await memberRepo.removeMember(targetUserId, orgId);
      if (!removed) {
        throw Errors.notFound('Membership');
      }

      return reply.status(204).send(null);
    }
  );
}
