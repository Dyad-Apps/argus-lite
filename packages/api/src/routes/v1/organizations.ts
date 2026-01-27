/**
 * Organization routes - CRUD operations for organizations
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createOrganizationSchema,
  createRootOrganizationSchema,
  createChildOrganizationSchema,
  updateOrganizationSchema,
  updateOrganizationBrandingSchema,
  organizationResponseSchema,
  organizationListResponseSchema,
  organizationHierarchyNodeSchema,
  organizationHierarchyResponseSchema,
  organizationBrandingResponseSchema,
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
  getBrandingRepository,
  getSystemAdminRepository,
} from '../../repositories/index.js';
import { auditService } from '../../services/audit.service.js';
import { hashPassword, generateRandomPassword } from '../../utils/password.js';

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  const orgRepo = getOrganizationRepository();
  const memberRepo = getUserOrganizationRepository();
  const userRepo = getUserRepository();
  const brandingRepo = getBrandingRepository();
  const systemAdminRepo = getSystemAdminRepository();

  // ===========================================
  // Public Routes (no authentication required)
  // ===========================================

  // GET /organizations/by-subdomain/:subdomain - Get organization by subdomain (public)
  // Used by the login page to discover organization and fetch branding
  app.withTypeProvider<ZodTypeProvider>().get(
    '/by-subdomain/:subdomain',
    {
      schema: {
        params: z.object({
          subdomain: z.string().min(1).max(63),
        }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            name: z.string(),
            subdomain: z.string(),
            logoUrl: z.string().nullable(),
            logoDarkUrl: z.string().nullable(),
            faviconUrl: z.string().nullable(),
            primaryColor: z.string().nullable(),
            accentColor: z.string().nullable(),
            loginBackgroundType: z.enum(['default', 'image', 'particles', 'solid']).nullable(),
            loginBackgroundUrl: z.string().nullable(),
            loginBackgroundColor: z.string().nullable(),
            loginWelcomeText: z.string().nullable(),
            loginSubtitle: z.string().nullable(),
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
      const { subdomain } = request.params;

      // Find organization by subdomain
      const org = await orgRepo.findBySubdomain(subdomain);

      if (!org || !org.isActive) {
        throw Errors.notFound('Organization not found');
      }

      // Get branding for login page customization
      const branding = await brandingRepo.findByOrganizationId(createOrganizationId(org.id));

      return {
        id: org.id,
        name: org.name,
        subdomain: org.subdomain!,
        logoUrl: branding?.logoUrl ?? null,
        logoDarkUrl: branding?.logoDarkUrl ?? null,
        faviconUrl: branding?.faviconUrl ?? null,
        primaryColor: branding?.primaryColor ?? null,
        accentColor: branding?.accentColor ?? null,
        loginBackgroundType: branding?.loginBackgroundType ?? null,
        loginBackgroundUrl: branding?.loginBackgroundUrl ?? null,
        loginBackgroundColor: branding?.loginBackgroundColor ?? null,
        loginWelcomeText: branding?.loginWelcomeText ?? null,
        loginSubtitle: branding?.loginSubtitle ?? null,
      };
    }
  );

  // ===========================================
  // Authenticated Routes (all routes below require authentication)
  // ===========================================

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

      // Check if user is a super admin (platform-wide access)
      const isSuperAdmin = await systemAdminRepo.isSuperAdmin(request.user!.id);

      // Get all organizations
      const result = await orgRepo.findAll({ page, pageSize, activeOnly });

      // Filter organizations based on user permissions
      let filteredData = result.data;
      if (!isSuperAdmin) {
        // Non-super admins can only see organizations they have access to
        const accessibleOrgIds = request.user!.organizationContext?.accessibleOrganizationIds || [];
        filteredData = result.data.filter((org) =>
          accessibleOrgIds.includes(createOrganizationId(org.id))
        );
      }

      return {
        data: filteredData.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          orgCode: org.orgCode,
          description: org.description,
          isActive: org.isActive,
          isRoot: org.isRoot,
          canHaveChildren: org.canHaveChildren,
          depth: org.depth,
          path: org.path,
          subdomain: org.subdomain,
          plan: org.plan,
          profileId: org.profileId,
          parentOrganizationId: org.parentOrganizationId,
          rootOrganizationId: org.rootOrganizationId,
          settings: org.settings,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        })),
        pagination: {
          ...result.pagination,
          total: filteredData.length,
          totalPages: Math.ceil(filteredData.length / pageSize),
        },
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
        orgCode: org.orgCode,
        description: org.description,
        isActive: org.isActive,
        isRoot: org.isRoot,
        canHaveChildren: org.canHaveChildren,
        depth: org.depth,
        path: org.path,
        subdomain: org.subdomain,
        plan: org.plan,
        profileId: org.profileId,
        parentOrganizationId: org.parentOrganizationId,
        rootOrganizationId: org.rootOrganizationId,
        settings: org.settings,
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

      // ADR-001: Create as root organization with org_code derived from slug
      const normalizedSlug = slug.toLowerCase();
      const orgCode = normalizedSlug.toUpperCase().replace(/-/g, '_');

      const org = await orgRepo.create({
        name,
        slug: normalizedSlug,
        orgCode,
        isRoot: true,
        canHaveChildren: true,
        subdomain: normalizedSlug,
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

  // POST /organizations/root - Create a new root organization (full form)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/root',
    {
      schema: {
        body: createRootOrganizationSchema,
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
      const {
        name,
        orgCode,
        domainType,
        customDomain,
        profileId,
        adminEmail,
        allowWhiteLabeling,
        allowImpersonation,
      } = request.body;

      // Generate slug from org code
      const slug = orgCode.toLowerCase().replace(/_/g, '-');

      // Check if slug is available
      const isAvailable = await orgRepo.isSlugAvailable(slug);
      if (!isAvailable) {
        throw Errors.conflict('Organization with this code already exists');
      }

      // Determine subdomain based on domain type
      const subdomain = domainType === 'platform' ? slug : customDomain || slug;

      // Create the root organization with settings
      const org = await orgRepo.create({
        name,
        slug,
        orgCode: orgCode.toUpperCase(),
        isRoot: true,
        canHaveChildren: true,
        subdomain,
        profileId: profileId || null,
        settings: {
          features: {
            allowWhiteLabeling,
            allowImpersonation,
          },
        },
      });

      // Update root_organization_id to point to itself (required for root orgs)
      await orgRepo.update(createOrganizationId(org.id), {
        rootOrganizationId: org.id,
      });

      // Create admin user if email is provided
      let adminUser = null;
      if (adminEmail) {
        // Check if user already exists
        const existingUser = await userRepo.findByEmail(adminEmail);

        if (existingUser) {
          // Use existing user as admin
          adminUser = existingUser;
        } else {
          // Create new user with a random password
          const temporaryPassword = generateRandomPassword();
          const passwordHash = await hashPassword(temporaryPassword);

          adminUser = await userRepo.create({
            email: adminEmail.toLowerCase(),
            passwordHash,
            firstName: 'Admin',
            lastName: name, // Use org name as last name initially
            rootOrganizationId: org.id,
            primaryOrganizationId: org.id,
            status: 'active',
          });

          // TODO: Send welcome email with password reset link
          app.log.info(
            { userId: adminUser.id, email: adminEmail },
            'Created admin user for new organization'
          );
        }

        // Add user as owner of the organization
        await memberRepo.addMember({
          userId: createUserId(adminUser.id),
          organizationId: createOrganizationId(org.id),
          role: 'owner',
          isPrimary: true,
        });
      }

      // Audit log the organization creation
      await auditService.logOrgManagement('create_root_organization', createOrganizationId(org.id), {
        name: org.name,
        orgCode: org.orgCode,
        subdomain,
        domainType,
        adminEmail,
        allowWhiteLabeling,
        allowImpersonation,
        profileId: profileId || null,
      });

      return reply.status(201).send({
        id: org.id,
        name: org.name,
        slug: org.slug,
        orgCode: org.orgCode,
        isActive: org.isActive,
        isRoot: org.isRoot,
        canHaveChildren: org.canHaveChildren,
        depth: org.depth,
        subdomain: org.subdomain,
        profileId: profileId || null,
        settings: org.settings,
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

      // Get org details for audit log before deletion
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      const deleted = await orgRepo.delete(orgId);
      if (!deleted) {
        throw Errors.notFound('Organization', request.params.id);
      }

      // Audit log the deletion
      await auditService.logOrgManagement('delete_organization', orgId, {
        name: org.name,
        orgCode: org.orgCode,
        slug: org.slug,
        isRoot: org.isRoot,
      });

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

  // ===========================================
  // Hierarchy Routes
  // ===========================================

  // GET /organizations/:id/children - Get direct children
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
          200: organizationListResponseSchema,
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

      const result = await orgRepo.getChildren(orgId, { page, pageSize });

      return {
        data: result.data.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          orgCode: child.orgCode,
          isActive: child.isActive,
          isRoot: child.isRoot,
          createdAt: child.createdAt.toISOString(),
          updatedAt: child.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /organizations/:id/hierarchy - Get full hierarchy tree
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id/hierarchy',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: organizationHierarchyResponseSchema,
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

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      // Get root organization ID
      const rootId = org.rootOrganizationId ?? org.id;

      // Get all organizations in the hierarchy
      const hierarchy = await orgRepo.getHierarchyTree(createOrganizationId(rootId));

      return {
        data: hierarchy.map((node) => ({
          id: node.id,
          name: node.name,
          slug: node.slug,
          orgCode: node.orgCode,
          depth: node.depth,
          path: node.path,
          isRoot: node.isRoot,
          canHaveChildren: node.canHaveChildren,
          isActive: node.isActive,
          parentOrganizationId: node.parentOrganizationId,
        })),
      };
    }
  );

  // POST /organizations/:id/children - Create child organization
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:id/children',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: createChildOrganizationSchema,
        response: {
          201: organizationResponseSchema,
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
      const parentId = createOrganizationId(request.params.id);
      const { name, orgCode, description, canHaveChildren, profileId } = request.body;

      // Verify parent organization exists
      const parent = await orgRepo.findById(parentId);
      if (!parent) {
        throw Errors.notFound('Organization', request.params.id);
      }

      // Check if parent can have children
      if (!parent.canHaveChildren) {
        throw Errors.forbidden('This organization cannot have child organizations');
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        parentId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can create child organizations');
      }

      // Generate slug from org code
      const slug = orgCode.toLowerCase().replace(/_/g, '-');

      // Check if slug is available
      const isAvailable = await orgRepo.isSlugAvailable(slug);
      if (!isAvailable) {
        throw Errors.conflict('Organization with this code already exists');
      }

      try {
        const child = await orgRepo.createChild(parentId, {
          name,
          orgCode: orgCode.toUpperCase(),
          slug,
          description,
          canHaveChildren: canHaveChildren ?? false,
          profileId,
        });

        // Audit log the child creation
        await auditService.logOrgManagement('create_child_organization', createOrganizationId(child.id), {
          name: child.name,
          orgCode: child.orgCode,
          parentId: parentId,
          parentName: parent.name,
        });

        return reply.status(201).send({
          id: child.id,
          name: child.name,
          slug: child.slug,
          orgCode: child.orgCode,
          isActive: child.isActive,
          isRoot: child.isRoot,
          createdAt: child.createdAt.toISOString(),
          updatedAt: child.updatedAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('cannot have children')) {
          throw Errors.forbidden(error.message);
        }
        throw error;
      }
    }
  );

  // ===========================================
  // Branding Routes
  // ===========================================

  // GET /organizations/:id/branding - Get organization branding
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id/branding',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: organizationBrandingResponseSchema,
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

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      // Get branding (or return empty defaults)
      const branding = await brandingRepo.findByOrganizationId(orgId);

      if (!branding) {
        // Return default branding if none exists
        return {
          id: null,
          organizationId: orgId,
          logoUrl: null,
          logoDarkUrl: null,
          faviconUrl: null,
          primaryColor: null,
          accentColor: null,
          loginBackgroundType: 'default' as const,
          loginBackgroundUrl: null,
          loginBackgroundColor: null,
          loginWelcomeText: null,
          loginSubtitle: null,
          customCss: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        id: branding.id,
        organizationId: branding.organizationId,
        logoUrl: branding.logoUrl,
        logoDarkUrl: branding.logoDarkUrl,
        faviconUrl: branding.faviconUrl,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        loginBackgroundType: branding.loginBackgroundType,
        loginBackgroundUrl: branding.loginBackgroundUrl,
        loginBackgroundColor: branding.loginBackgroundColor,
        loginWelcomeText: branding.loginWelcomeText,
        loginSubtitle: branding.loginSubtitle,
        customCss: branding.customCss,
        createdAt: branding.createdAt.toISOString(),
        updatedAt: branding.updatedAt.toISOString(),
      };
    }
  );

  // PATCH /organizations/:id/branding - Update organization branding
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id/branding',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateOrganizationBrandingSchema,
        response: {
          200: organizationBrandingResponseSchema,
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

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.id);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can update branding');
      }

      // Check if white-labeling is allowed
      if (org.settings?.features?.allowWhiteLabeling === false) {
        throw Errors.forbidden('White-labeling is not enabled for this organization');
      }

      // Upsert branding
      const branding = await brandingRepo.upsert(orgId, request.body);

      return {
        id: branding.id,
        organizationId: branding.organizationId,
        logoUrl: branding.logoUrl,
        logoDarkUrl: branding.logoDarkUrl,
        faviconUrl: branding.faviconUrl,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        loginBackgroundType: branding.loginBackgroundType,
        loginBackgroundUrl: branding.loginBackgroundUrl,
        loginBackgroundColor: branding.loginBackgroundColor,
        loginWelcomeText: branding.loginWelcomeText,
        loginSubtitle: branding.loginSubtitle,
        customCss: branding.customCss,
        createdAt: branding.createdAt.toISOString(),
        updatedAt: branding.updatedAt.toISOString(),
      };
    }
  );
}
