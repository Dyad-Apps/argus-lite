/**
 * SSO Connection Management Routes
 * CRUD operations for identity provider configurations within organizations
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  Errors,
  createOrganizationId,
} from '@argus/shared';
import {
  getIdentityProviderRepository,
  getOrganizationRepository,
  getUserOrganizationRepository,
} from '../../repositories/index.js';

// Identity provider type enum for validation
const identityProviderTypeSchema = z.enum([
  'oidc',
  'saml',
  'google',
  'microsoft',
  'github',
  'okta',
]);

// Config schemas for different provider types
const oidcConfigSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  authorizationUrl: z.string().url().optional(),
  tokenUrl: z.string().url().optional(),
  userInfoUrl: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
});

const samlConfigSchema = z.object({
  entryPoint: z.string().url(),
  issuer: z.string().min(1),
  cert: z.string().min(1),
  privateKey: z.string().optional(),
  signatureAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
  digestAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
  wantAssertionsSigned: z.boolean().optional(),
  wantAuthnResponseSigned: z.boolean().optional(),
});

const socialConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
});

// Create schema
const createSsoConnectionSchema = z.object({
  type: identityProviderTypeSchema,
  name: z.string().min(1).max(100),
  displayName: z.string().max(255).optional(),
  config: z.union([oidcConfigSchema, samlConfigSchema, socialConfigSchema]),
  allowedDomains: z.array(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
  autoCreateUsers: z.boolean().optional().default(false),
  autoLinkUsers: z.boolean().optional().default(true),
});

// Update schema (all fields optional)
const updateSsoConnectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().max(255).optional().nullable(),
  config: z.union([oidcConfigSchema, samlConfigSchema, socialConfigSchema]).optional(),
  allowedDomains: z.array(z.string()).optional().nullable(),
  enabled: z.boolean().optional(),
  autoCreateUsers: z.boolean().optional(),
  autoLinkUsers: z.boolean().optional(),
});

// Response schemas
const ssoConnectionResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  type: identityProviderTypeSchema,
  name: z.string(),
  displayName: z.string().nullable(),
  allowedDomains: z.array(z.string()).nullable(),
  enabled: z.boolean(),
  autoCreateUsers: z.boolean(),
  autoLinkUsers: z.boolean(),
  linkedUsersCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ssoConnectionListResponseSchema = z.object({
  data: z.array(ssoConnectionResponseSchema),
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

export async function ssoConnectionRoutes(app: FastifyInstance): Promise<void> {
  const providerRepo = getIdentityProviderRepository();
  const orgRepo = getOrganizationRepository();
  const memberRepo = getUserOrganizationRepository();

  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /organizations/:orgId/sso-connections - List SSO connections
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/sso-connections',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          includeGlobal: z.coerce.boolean().default(true),
          enabledOnly: z.coerce.boolean().default(false),
        }),
        response: {
          200: ssoConnectionListResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { page, pageSize, includeGlobal, enabledOnly } = request.query;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check membership (or super admin)
      const isMember = await memberRepo.findMembershipOrSuperAdmin(request.user!.id, orgId);
      if (!isMember) {
        throw Errors.forbidden('You are not a member of this organization');
      }

      const result = await providerRepo.findByOrganization(orgId, {
        page,
        pageSize,
        includeGlobal,
        enabledOnly,
      });

      return {
        data: result.data.map((provider) => ({
          id: provider.id,
          organizationId: provider.organizationId,
          type: provider.type as z.infer<typeof identityProviderTypeSchema>,
          name: provider.name,
          displayName: provider.displayName,
          allowedDomains: provider.allowedDomains,
          enabled: provider.enabled,
          autoCreateUsers: provider.autoCreateUsers,
          autoLinkUsers: provider.autoLinkUsers,
          linkedUsersCount: provider.linkedUsersCount,
          createdAt: provider.createdAt.toISOString(),
          updatedAt: provider.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /organizations/:orgId/sso-connections/:id - Get SSO connection by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/sso-connections/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        response: {
          200: ssoConnectionResponseSchema,
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

      // Check membership (or super admin)
      const isMember = await memberRepo.findMembershipOrSuperAdmin(request.user!.id, orgId);
      if (!isMember) {
        throw Errors.forbidden('You are not a member of this organization');
      }

      const provider = await providerRepo.findByIdWithStats(id);
      if (!provider) {
        throw Errors.notFound('SSO Connection', id);
      }

      // Verify provider belongs to this org or is global
      if (provider.organizationId && provider.organizationId !== orgId) {
        throw Errors.notFound('SSO Connection', id);
      }

      return {
        id: provider.id,
        organizationId: provider.organizationId,
        type: provider.type as z.infer<typeof identityProviderTypeSchema>,
        name: provider.name,
        displayName: provider.displayName,
        allowedDomains: provider.allowedDomains,
        enabled: provider.enabled,
        autoCreateUsers: provider.autoCreateUsers,
        autoLinkUsers: provider.autoLinkUsers,
        linkedUsersCount: provider.linkedUsersCount,
        createdAt: provider.createdAt.toISOString(),
        updatedAt: provider.updatedAt.toISOString(),
      };
    }
  );

  // POST /organizations/:orgId/sso-connections - Create SSO connection
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/sso-connections',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        body: createSsoConnectionSchema,
        response: {
          201: ssoConnectionResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { type, name, displayName, config, allowedDomains, enabled, autoCreateUsers, autoLinkUsers } = request.body;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(request.user!.id, orgId, 'admin');
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can create SSO connections');
      }

      // Check if name is available
      const isAvailable = await providerRepo.isNameAvailable(orgId, name);
      if (!isAvailable) {
        throw Errors.conflict('SSO connection with this name already exists');
      }

      const provider = await providerRepo.create({
        organizationId: orgId,
        type,
        name,
        displayName,
        config,
        allowedDomains: allowedDomains ?? null,
        enabled: enabled ?? true,
        autoCreateUsers: autoCreateUsers ?? false,
        autoLinkUsers: autoLinkUsers ?? true,
      });

      return reply.status(201).send({
        id: provider.id,
        organizationId: provider.organizationId,
        type: provider.type as z.infer<typeof identityProviderTypeSchema>,
        name: provider.name,
        displayName: provider.displayName,
        allowedDomains: provider.allowedDomains,
        enabled: provider.enabled,
        autoCreateUsers: provider.autoCreateUsers,
        autoLinkUsers: provider.autoLinkUsers,
        linkedUsersCount: 0,
        createdAt: provider.createdAt.toISOString(),
        updatedAt: provider.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /organizations/:orgId/sso-connections/:id - Update SSO connection
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/organizations/:orgId/sso-connections/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        body: updateSsoConnectionSchema,
        response: {
          200: ssoConnectionResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id } = request.params;
      const updates = request.body;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(request.user!.id, orgId, 'admin');
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can update SSO connections');
      }

      // Check if provider exists and belongs to this org
      const existing = await providerRepo.findById(id);
      if (!existing || existing.organizationId !== orgId) {
        throw Errors.notFound('SSO Connection', id);
      }

      // If name is being changed, check availability
      if (updates.name && updates.name !== existing.name) {
        const isAvailable = await providerRepo.isNameAvailable(orgId, updates.name, id);
        if (!isAvailable) {
          throw Errors.conflict('SSO connection with this name already exists');
        }
      }

      const provider = await providerRepo.update(id, updates);
      if (!provider) {
        throw Errors.notFound('SSO Connection', id);
      }

      const linkedUsersCount = await providerRepo.getLinkedUsersCount(id);

      return {
        id: provider.id,
        organizationId: provider.organizationId,
        type: provider.type as z.infer<typeof identityProviderTypeSchema>,
        name: provider.name,
        displayName: provider.displayName,
        allowedDomains: provider.allowedDomains,
        enabled: provider.enabled,
        autoCreateUsers: provider.autoCreateUsers,
        autoLinkUsers: provider.autoLinkUsers,
        linkedUsersCount,
        createdAt: provider.createdAt.toISOString(),
        updatedAt: provider.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /organizations/:orgId/sso-connections/:id - Delete SSO connection
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/organizations/:orgId/sso-connections/:id',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        querystring: z.object({
          force: z.coerce.boolean().default(false),
        }),
        response: {
          204: z.null(),
          400: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const orgId = createOrganizationId(request.params.orgId);
      const { id } = request.params;
      const { force } = request.query;

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization', request.params.orgId);
      }

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(request.user!.id, orgId, 'admin');
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can delete SSO connections');
      }

      // Check if provider exists and belongs to this org
      const existing = await providerRepo.findById(id);
      if (!existing || existing.organizationId !== orgId) {
        throw Errors.notFound('SSO Connection', id);
      }

      let deleted: boolean;
      if (force) {
        deleted = await providerRepo.forceDelete(id);
      } else {
        deleted = await providerRepo.delete(id);
        if (!deleted) {
          throw Errors.badRequest('Cannot delete SSO connection with linked users. Use force=true to unlink all users.');
        }
      }

      if (!deleted) {
        throw Errors.notFound('SSO Connection', id);
      }

      return reply.status(204).send(null);
    }
  );

  // POST /organizations/:orgId/sso-connections/:id/test - Test SSO connection
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/sso-connections/:id/test',
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
            details: z.record(z.string(), z.unknown()).optional(),
          }),
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

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(request.user!.id, orgId, 'admin');
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can test SSO connections');
      }

      // Check if provider exists and belongs to this org
      const provider = await providerRepo.findById(id);
      if (!provider || (provider.organizationId && provider.organizationId !== orgId)) {
        throw Errors.notFound('SSO Connection', id);
      }

      // Test connection based on provider type
      try {
        switch (provider.type) {
          case 'oidc':
          case 'okta':
          case 'microsoft': {
            const config = provider.config as { issuer: string };
            // Test by fetching OIDC discovery document
            const discoveryUrl = `${config.issuer}/.well-known/openid-configuration`;
            const response = await fetch(discoveryUrl, { method: 'GET' });
            if (!response.ok) {
              return {
                success: false,
                message: `Failed to reach OIDC discovery endpoint: ${response.status}`,
              };
            }
            const discoveryDoc = await response.json();
            return {
              success: true,
              message: 'Successfully connected to OIDC provider',
              details: {
                issuer: discoveryDoc.issuer,
                authorizationEndpoint: discoveryDoc.authorization_endpoint,
                tokenEndpoint: discoveryDoc.token_endpoint,
              },
            };
          }

          case 'saml': {
            const config = provider.config as { entryPoint: string };
            // Test by checking if entry point URL is reachable
            const response = await fetch(config.entryPoint, { method: 'HEAD' });
            return {
              success: response.ok || response.status === 405, // 405 Method Not Allowed is acceptable
              message: response.ok || response.status === 405
                ? 'SAML entry point is reachable'
                : `SAML entry point returned status ${response.status}`,
            };
          }

          case 'google':
            // Google OAuth is always available
            return {
              success: true,
              message: 'Google OAuth is available',
            };

          case 'github':
            // GitHub OAuth is always available
            return {
              success: true,
              message: 'GitHub OAuth is available',
            };

          default:
            return {
              success: false,
              message: `Unknown provider type: ${provider.type}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
        };
      }
    }
  );
}
