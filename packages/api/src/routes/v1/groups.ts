/**
 * Group routes - CRUD operations for user groups within organizations
 * Groups allow organizing users and assigning roles at the group level
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  groupResponseSchema,
  groupListResponseSchema,
  groupMemberListResponseSchema,
  groupMemberResponseSchema,
  apiErrorResponseSchema,
  Errors,
  createOrganizationId,
  createUserId,
} from '@argus/shared';
import {
  getGroupRepository,
  getOrganizationRepository,
  getUserRepository,
  getUserOrganizationRepository,
} from '../../repositories/index.js';

export async function groupRoutes(app: FastifyInstance): Promise<void> {
  const groupRepo = getGroupRepository();
  const orgRepo = getOrganizationRepository();
  const userRepo = getUserRepository();
  const memberRepo = getUserOrganizationRepository();

  // All group routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /organizations/:orgId/groups - List all groups in an organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/groups',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: groupListResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { page, pageSize } = request.query;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is a member of the organization (or super admin)
      const isMember = await memberRepo.findMembershipOrSuperAdmin(request.user!.id, orgId);
      if (!isMember) {
        throw Errors.forbidden('You are not a member of this organization');
      }

      const result = await groupRepo.findByOrganization(orgId, { page, pageSize });

      return {
        data: result.data.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          organizationId: group.organizationId,
          memberCount: group.memberCount,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
          createdBy: group.createdBy,
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /organizations/:orgId/groups/:id - Get group by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/groups/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        response: {
          200: groupResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id } = request.params;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is a member of the organization (or super admin)
      const isMember = await memberRepo.findMembershipOrSuperAdmin(request.user!.id, orgId);
      if (!isMember) {
        throw Errors.forbidden('You are not a member of this organization');
      }

      const group = await groupRepo.findById(id);
      if (!group || group.organizationId !== orgId) {
        throw Errors.notFound('Group', id);
      }

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        organizationId: group.organizationId,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        createdBy: group.createdBy,
      };
    }
  );

  // POST /organizations/:orgId/groups - Create a new group
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/groups',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        body: createGroupSchema,
        response: {
          201: groupResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { name, description } = request.body;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can create groups');
      }

      // Check if name is available
      const isAvailable = await groupRepo.isNameAvailable(orgId, name);
      if (!isAvailable) {
        throw Errors.conflict('Group with this name already exists in this organization');
      }

      const group = await groupRepo.create({
        name,
        description,
        organizationId: orgId,
        createdBy: request.user!.id,
      });

      return reply.status(201).send({
        id: group.id,
        name: group.name,
        description: group.description,
        organizationId: group.organizationId,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        createdBy: group.createdBy,
      });
    }
  );

  // PATCH /organizations/:orgId/groups/:id - Update group
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/organizations/:orgId/groups/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        body: updateGroupSchema,
        response: {
          200: groupResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id } = request.params;
      const { name, description } = request.body;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can update groups');
      }

      // Check if group exists in this organization
      const existing = await groupRepo.findById(id);
      if (!existing || existing.organizationId !== orgId) {
        throw Errors.notFound('Group', id);
      }

      // If name is being changed, check availability
      if (name && name !== existing.name) {
        const isAvailable = await groupRepo.isNameAvailable(orgId, name, id);
        if (!isAvailable) {
          throw Errors.conflict('Group with this name already exists in this organization');
        }
      }

      const group = await groupRepo.update(id, { name, description });

      if (!group) {
        throw Errors.notFound('Group', id);
      }

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        organizationId: group.organizationId,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        createdBy: group.createdBy,
      };
    }
  );

  // DELETE /organizations/:orgId/groups/:id - Delete group
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/organizations/:orgId/groups/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        response: {
          204: z.null(),
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id } = request.params;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can delete groups');
      }

      // Check if group exists in this organization
      const existing = await groupRepo.findById(id);
      if (!existing || existing.organizationId !== orgId) {
        throw Errors.notFound('Group', id);
      }

      const deleted = await groupRepo.delete(id);
      if (!deleted) {
        throw Errors.notFound('Group', id);
      }

      return reply.status(204).send(null);
    }
  );

  // ===========================================
  // Group Member Management Routes
  // ===========================================

  // GET /organizations/:orgId/groups/:id/members - List group members
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/groups/:id/members',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: groupMemberListResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id } = request.params;
      const { page, pageSize } = request.query;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is a member of the organization (or super admin)
      const isMember = await memberRepo.findMembershipOrSuperAdmin(request.user!.id, orgId);
      if (!isMember) {
        throw Errors.forbidden('You are not a member of this organization');
      }

      // Check if group exists in this organization
      const group = await groupRepo.findById(id);
      if (!group || group.organizationId !== orgId) {
        throw Errors.notFound('Group', id);
      }

      const result = await groupRepo.getGroupMembers(id, { page, pageSize });

      return {
        data: result.data.map((member) => ({
          userId: member.userId,
          email: member.user.email,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          addedAt: member.addedAt.toISOString(),
          addedBy: member.addedBy,
        })),
        pagination: result.pagination,
      };
    }
  );

  // POST /organizations/:orgId/groups/:id/members - Add member to group
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/groups/:id/members',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        body: addGroupMemberSchema,
        response: {
          201: groupMemberResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id: groupId } = request.params;
      const { userId: newUserId } = request.body;
      const targetUserId = createUserId(newUserId);

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can add members to groups');
      }

      // Check if group exists in this organization
      const group = await groupRepo.findById(groupId);
      if (!group || group.organizationId !== orgId) {
        throw Errors.notFound('Group', groupId);
      }

      // Verify target user exists
      const targetUser = await userRepo.findById(targetUserId);
      if (!targetUser) {
        throw Errors.notFound('User', newUserId);
      }

      // Verify target user is a member of the organization
      const targetMembership = await memberRepo.findMembership(targetUserId, orgId);
      if (!targetMembership) {
        throw Errors.forbidden('User is not a member of this organization');
      }

      // Check if already a member of the group
      const isMember = await groupRepo.isMember(groupId, targetUserId);
      if (isMember) {
        throw Errors.conflict('User is already a member of this group');
      }

      const membership = await groupRepo.addMember({
        groupId,
        userId: targetUserId,
        addedBy: request.user!.id,
      });

      return reply.status(201).send({
        userId: membership.userId,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        addedAt: membership.addedAt.toISOString(),
        addedBy: membership.addedBy,
      });
    }
  );

  // DELETE /organizations/:orgId/groups/:id/members/:userId - Remove member from group
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/organizations/:orgId/groups/:id/members/:userId',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
          userId: z.string().uuid(),
        }),
        response: {
          204: z.null(),
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id: groupId, userId: targetUserIdStr } = request.params;
      const targetUserId = createUserId(targetUserIdStr);

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner (or removing self)
      const isSelf = targetUserId === request.user!.id;
      if (!isSelf) {
        const hasPermission = await memberRepo.hasRoleOrHigher(
          request.user!.id,
          orgId,
          'admin'
        );
        if (!hasPermission) {
          throw Errors.forbidden('Only admins and owners can remove members from groups');
        }
      }

      // Check if group exists in this organization
      const group = await groupRepo.findById(groupId);
      if (!group || group.organizationId !== orgId) {
        throw Errors.notFound('Group', groupId);
      }

      // Check if user is a member of the group
      const isMember = await groupRepo.isMember(groupId, targetUserId);
      if (!isMember) {
        throw Errors.notFound('GroupMember', targetUserIdStr);
      }

      const removed = await groupRepo.removeMember(groupId, targetUserId);
      if (!removed) {
        throw Errors.notFound('GroupMember', targetUserIdStr);
      }

      return reply.status(204).send(null);
    }
  );
}
