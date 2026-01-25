/**
 * Role routes - CRUD operations for roles and role assignments
 * Supports both system roles (global) and organization-specific custom roles
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createRoleSchema,
  updateRoleSchema,
  assignUserRoleSchema,
  assignGroupRoleSchema,
  roleResponseSchema,
  roleListResponseSchema,
  userRoleAssignmentsResponseSchema,
  userRoleAssignmentResponseSchema,
  roleScopeSchema,
  roleSourceSchema,
  apiErrorResponseSchema,
  Errors,
  createOrganizationId,
  createUserId,
} from '@argus/shared';
import {
  getRoleRepository,
  getOrganizationRepository,
  getUserRepository,
  getUserOrganizationRepository,
  getGroupRepository,
} from '../../repositories/index.js';

export async function roleRoutes(app: FastifyInstance): Promise<void> {
  const roleRepo = getRoleRepository();
  const orgRepo = getOrganizationRepository();
  const userRepo = getUserRepository();
  const memberRepo = getUserOrganizationRepository();
  const groupRepo = getGroupRepository();

  // All role routes require authentication
  app.addHook('preHandler', app.authenticate);

  // ===========================================
  // System Roles (Global, Read-only)
  // ===========================================

  // GET /roles/system - List all system roles
  app.withTypeProvider<ZodTypeProvider>().get(
    '/roles/system',
    {
      schema: {
        response: {
          200: z.object({
            data: z.array(roleResponseSchema),
          }),
        },
      },
    },
    async () => {
      const systemRoles = await roleRepo.findSystemRoles();

      return {
        data: systemRoles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          organizationId: role.organizationId,
          isSystem: role.isSystem,
          defaultScope: role.defaultScope,
          permissions: role.permissions ?? { resources: [], menuAccess: [] },
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString(),
        })),
      };
    }
  );

  // ===========================================
  // Organization Roles
  // ===========================================

  // GET /organizations/:orgId/roles - List roles available to an organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/roles',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          includeSystem: z.coerce.boolean().default(true),
        }),
        response: {
          200: roleListResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { page, pageSize, includeSystem } = request.query;

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

      const result = await roleRepo.findByOrganization(orgId, {
        page,
        pageSize,
        includeSystem,
      });

      return {
        data: result.data.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          organizationId: role.organizationId,
          isSystem: role.isSystem,
          defaultScope: role.defaultScope,
          permissions: role.permissions ?? { resources: [], menuAccess: [] },
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /organizations/:orgId/roles/:id - Get role by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/roles/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        response: {
          200: roleResponseSchema,
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

      const role = await roleRepo.findById(id);
      if (!role) {
        throw Errors.notFound('Role', id);
      }

      // Role must belong to this org or be a system role
      if (role.organizationId !== null && role.organizationId !== orgId) {
        throw Errors.notFound('Role', id);
      }

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        organizationId: role.organizationId,
        isSystem: role.isSystem,
        defaultScope: role.defaultScope,
        permissions: role.permissions ?? { resources: [], menuAccess: [] },
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      };
    }
  );

  // POST /organizations/:orgId/roles - Create a custom role
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/roles',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        body: createRoleSchema,
        response: {
          201: roleResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { name, description, defaultScope, permissions } = request.body;

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
        throw Errors.forbidden('Only admins and owners can create roles');
      }

      // Check if name is available in this org
      const isAvailable = await roleRepo.isNameAvailable(orgId, name);
      if (!isAvailable) {
        throw Errors.conflict('Role with this name already exists in this organization');
      }

      const role = await roleRepo.create({
        name,
        description,
        organizationId: orgId,
        defaultScope,
        permissions: permissions ?? { resources: [], menuAccess: [] },
        isSystem: false,
      });

      return reply.status(201).send({
        id: role.id,
        name: role.name,
        description: role.description,
        organizationId: role.organizationId,
        isSystem: role.isSystem,
        defaultScope: role.defaultScope,
        permissions: role.permissions ?? { resources: [], menuAccess: [] },
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /organizations/:orgId/roles/:id - Update a custom role
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/organizations/:orgId/roles/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        body: updateRoleSchema,
        response: {
          200: roleResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id } = request.params;
      const { name, description, defaultScope, permissions } = request.body;

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
        throw Errors.forbidden('Only admins and owners can update roles');
      }

      // Check if role exists and belongs to this org
      const existing = await roleRepo.findById(id);
      if (!existing || existing.organizationId !== orgId) {
        throw Errors.notFound('Role', id);
      }

      // Cannot update system roles
      if (existing.isSystem) {
        throw Errors.forbidden('Cannot modify system roles');
      }

      // If name is being changed, check availability
      if (name && name !== existing.name) {
        const isAvailable = await roleRepo.isNameAvailable(orgId, name, id);
        if (!isAvailable) {
          throw Errors.conflict('Role with this name already exists in this organization');
        }
      }

      const role = await roleRepo.update(id, { name, description, defaultScope, permissions });

      if (!role) {
        throw Errors.notFound('Role', id);
      }

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        organizationId: role.organizationId,
        isSystem: role.isSystem,
        defaultScope: role.defaultScope,
        permissions: role.permissions ?? { resources: [], menuAccess: [] },
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /organizations/:orgId/roles/:id - Delete a custom role
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/organizations/:orgId/roles/:id',
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
        throw Errors.forbidden('Only admins and owners can delete roles');
      }

      // Check if role exists and belongs to this org
      const existing = await roleRepo.findById(id);
      if (!existing || existing.organizationId !== orgId) {
        throw Errors.notFound('Role', id);
      }

      // Cannot delete system roles
      if (existing.isSystem) {
        throw Errors.forbidden('Cannot delete system roles');
      }

      const deleted = await roleRepo.delete(id);
      if (!deleted) {
        throw Errors.notFound('Role', id);
      }

      return reply.status(204).send(null);
    }
  );

  // ===========================================
  // User Role Assignments
  // ===========================================

  // GET /organizations/:orgId/users/:userId/roles - Get user's role assignments
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/users/:userId/roles',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          userId: z.string().uuid(),
        }),
        response: {
          200: userRoleAssignmentsResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const targetUserId = createUserId(request.params.userId);

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

      // Verify target user exists
      const targetUser = await userRepo.findById(targetUserId);
      if (!targetUser) {
        throw Errors.notFound('User', request.params.userId);
      }

      const assignments = await roleRepo.getUserRoleAssignments(targetUserId, orgId);

      return {
        data: assignments.map((assignment) => ({
          userId: assignment.userId,
          roleId: assignment.roleId,
          roleName: assignment.roleName,
          organizationId: assignment.organizationId,
          scope: assignment.scope,
          source: assignment.source,
          assignedAt: assignment.assignedAt.toISOString(),
          assignedBy: assignment.assignedBy,
          expiresAt: assignment.expiresAt?.toISOString() ?? null,
        })),
      };
    }
  );

  // POST /organizations/:orgId/users/:userId/roles - Assign role to user
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/users/:userId/roles',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          userId: z.string().uuid(),
        }),
        body: assignUserRoleSchema,
        response: {
          201: userRoleAssignmentResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const targetUserId = createUserId(request.params.userId);
      const { roleId, scope, expiresAt } = request.body;

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
        throw Errors.forbidden('Only admins and owners can assign roles');
      }

      // Verify target user exists and is a member
      const targetUser = await userRepo.findById(targetUserId);
      if (!targetUser) {
        throw Errors.notFound('User', request.params.userId);
      }

      const targetMembership = await memberRepo.findMembership(targetUserId, orgId);
      if (!targetMembership) {
        throw Errors.forbidden('User is not a member of this organization');
      }

      // Verify role exists and is available to this org
      const role = await roleRepo.findById(roleId);
      if (!role) {
        throw Errors.notFound('Role', roleId);
      }
      if (role.organizationId !== null && role.organizationId !== orgId) {
        throw Errors.notFound('Role', roleId);
      }

      // Check if already assigned
      const hasRole = await roleRepo.userHasRole(targetUserId, roleId, orgId);
      if (hasRole) {
        throw Errors.conflict('User already has this role');
      }

      const assignment = await roleRepo.assignRoleToUser({
        userId: targetUserId,
        roleId,
        organizationId: orgId,
        scope,
        source: 'direct',
        assignedBy: request.user!.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      return reply.status(201).send({
        userId: assignment.userId,
        roleId: assignment.roleId,
        roleName: role.name,
        organizationId: assignment.organizationId,
        scope: assignment.scope,
        source: assignment.source,
        assignedAt: assignment.assignedAt.toISOString(),
        assignedBy: assignment.assignedBy,
        expiresAt: assignment.expiresAt?.toISOString() ?? null,
      });
    }
  );

  // DELETE /organizations/:orgId/users/:userId/roles/:roleId - Remove role from user
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/organizations/:orgId/users/:userId/roles/:roleId',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          userId: z.string().uuid(),
          roleId: z.string().uuid(),
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
      const targetUserId = createUserId(request.params.userId);
      const { roleId } = request.params;

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
        throw Errors.forbidden('Only admins and owners can remove roles');
      }

      // Check if assignment exists
      const hasRole = await roleRepo.userHasRole(targetUserId, roleId, orgId);
      if (!hasRole) {
        throw Errors.notFound('RoleAssignment');
      }

      const removed = await roleRepo.removeRoleFromUser(targetUserId, roleId, orgId);
      if (!removed) {
        throw Errors.notFound('RoleAssignment');
      }

      return reply.status(204).send(null);
    }
  );

  // ===========================================
  // Group Role Assignments
  // ===========================================

  // POST /organizations/:orgId/groups/:groupId/roles - Assign role to group
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/groups/:groupId/roles',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          groupId: z.string().uuid(),
        }),
        body: assignGroupRoleSchema,
        response: {
          201: z.object({
            groupId: z.string().uuid(),
            roleId: z.string().uuid(),
            roleName: z.string(),
            scope: roleScopeSchema.nullable(),
            assignedAt: z.string().datetime(),
            assignedBy: z.string().uuid().nullable(),
          }),
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { groupId } = request.params;
      const { roleId, scope } = request.body;

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
        throw Errors.forbidden('Only admins and owners can assign roles to groups');
      }

      // Verify group exists and belongs to this org
      const group = await groupRepo.findById(groupId);
      if (!group || group.organizationId !== orgId) {
        throw Errors.notFound('Group', groupId);
      }

      // Verify role exists and is available to this org
      const role = await roleRepo.findById(roleId);
      if (!role) {
        throw Errors.notFound('Role', roleId);
      }
      if (role.organizationId !== null && role.organizationId !== orgId) {
        throw Errors.notFound('Role', roleId);
      }

      // Check if already assigned
      const groupRoles = await roleRepo.getGroupRoleAssignments(groupId);
      const hasRole = groupRoles.some((r) => r.roleId === roleId);
      if (hasRole) {
        throw Errors.conflict('Group already has this role');
      }

      const assignment = await roleRepo.assignRoleToGroup({
        groupId,
        roleId,
        scope,
        assignedBy: request.user!.id,
      });

      return reply.status(201).send({
        groupId: assignment.groupId,
        roleId: assignment.roleId,
        roleName: role.name,
        scope: assignment.scope,
        assignedAt: assignment.assignedAt.toISOString(),
        assignedBy: assignment.assignedBy,
      });
    }
  );

  // DELETE /organizations/:orgId/groups/:groupId/roles/:roleId - Remove role from group
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/organizations/:orgId/groups/:groupId/roles/:roleId',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          groupId: z.string().uuid(),
          roleId: z.string().uuid(),
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
      const { groupId, roleId } = request.params;

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
        throw Errors.forbidden('Only admins and owners can remove roles from groups');
      }

      // Verify group exists and belongs to this org
      const group = await groupRepo.findById(groupId);
      if (!group || group.organizationId !== orgId) {
        throw Errors.notFound('Group', groupId);
      }

      // Check if assignment exists
      const groupRoles = await roleRepo.getGroupRoleAssignments(groupId);
      const hasRole = groupRoles.some((r) => r.roleId === roleId);
      if (!hasRole) {
        throw Errors.notFound('RoleAssignment');
      }

      const removed = await roleRepo.removeRoleFromGroup(groupId, roleId);
      if (!removed) {
        throw Errors.notFound('RoleAssignment');
      }

      return reply.status(204).send(null);
    }
  );
}
