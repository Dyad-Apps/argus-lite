/**
 * Tenant Switching Routes
 *
 * Allows users to switch between organizations they have access to.
 * Implements ADR-002: Subdomain-Based Root Tenant Identification
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors, createUserId, createOrganizationId } from '@argus/shared';
import {
  getUserRepository,
  getUserOrganizationRepository,
  getOrganizationRepository,
} from '../../repositories/index.js';
import { signAccessToken } from '../../utils/index.js';

export async function tenantSwitchRoutes(app: FastifyInstance): Promise<void> {
  const userRepo = getUserRepository();
  const userOrgRepo = getUserOrganizationRepository();
  const orgRepo = getOrganizationRepository();

  /**
   * POST /auth/switch-organization
   *
   * Switches the user's current organization context by issuing a new JWT
   * with updated currentOrganizationId.
   *
   * Users can switch to any organization they have access to within their root organization.
   */
  app.withTypeProvider<ZodTypeProvider>().post(
    '/switch-organization',
    {
      preHandler: app.authenticate,
      schema: {
        body: z.object({
          // Can switch by organization ID or org code
          organizationId: z.string().uuid().optional(),
          orgCode: z.string().optional(),
        }).refine(
          (data) => data.organizationId || data.orgCode,
          {
            message: 'Either organizationId or orgCode must be provided',
          }
        ),
        response: {
          200: z.object({
            accessToken: z.string(),
            expiresIn: z.number(),
            organization: z.object({
              id: z.string().uuid(),
              name: z.string(),
              slug: z.string(),
              orgCode: z.string(),
              role: z.enum(['owner', 'admin', 'member', 'viewer']),
            }),
          }),
          400: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
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
      const { organizationId, orgCode } = request.body;
      const userId = createUserId(request.user!.id);

      // Get user to access root organization
      const user = await userRepo.findById(userId);
      if (!user) {
        throw Errors.unauthorized('User not found');
      }

      // Find target organization
      let targetOrg;

      if (organizationId) {
        // Switch by organization ID
        targetOrg = await orgRepo.findById(createOrganizationId(organizationId));
      } else if (orgCode) {
        // Switch by org code - need to find within user's root organization
        // For now, we'll do a simple query. In production, this should be optimized
        const allOrgs = await userOrgRepo.getUserOrganizations(userId);
        const targetMembership = allOrgs.find((m) => {
          // We need to get the org details to check orgCode
          // This is not ideal - we should add a query to find by orgCode + rootOrgId
          return false; // Placeholder - needs proper implementation
        });

        if (!targetMembership) {
          throw Errors.notFound(`Organization with code '${orgCode}' not found`);
        }

        targetOrg = await orgRepo.findById(createOrganizationId(targetMembership.organizationId));
      }

      if (!targetOrg) {
        throw Errors.notFound('Organization not found');
      }

      // Verify organization is within user's root organization
      if (targetOrg.rootOrganizationId !== user.rootOrganizationId &&
          targetOrg.id !== user.rootOrganizationId) {
        throw Errors.forbidden('Cannot switch to organization outside your root organization');
      }

      // Verify organization is active
      if (!targetOrg.isActive) {
        throw Errors.forbidden('Organization is not active');
      }

      // Verify user has access to target organization
      const membership = await userOrgRepo.findMembership(
        userId,
        createOrganizationId(targetOrg.id)
      );

      if (!membership) {
        throw Errors.forbidden('You do not have access to this organization');
      }

      // Check if membership has expired
      if (membership.expiresAt && new Date() > membership.expiresAt) {
        throw Errors.forbidden('Your access to this organization has expired');
      }

      // Get all accessible organizations (for the JWT)
      const userOrgs = await userOrgRepo.getUserOrganizations(userId);
      const accessibleOrganizationIds = userOrgs.map((m) =>
        createOrganizationId(m.organizationId)
      );

      // Build new organization context with updated current organization
      const organizationContext = {
        rootOrganizationId: createOrganizationId(user.rootOrganizationId),
        currentOrganizationId: createOrganizationId(targetOrg.id),
        accessibleOrganizationIds,
      };

      // Issue new access token with updated context
      const accessToken = signAccessToken(userId, user.email, organizationContext);

      return {
        accessToken,
        expiresIn: 900, // 15 minutes in seconds
        organization: {
          id: targetOrg.id,
          name: targetOrg.name,
          slug: targetOrg.slug,
          orgCode: targetOrg.orgCode,
          role: membership.role,
        },
      };
    }
  );

  /**
   * GET /auth/current-organization
   *
   * Returns the current organization context from the JWT token.
   */
  app.withTypeProvider<ZodTypeProvider>().get(
    '/current-organization',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: z.object({
            rootOrganizationId: z.string().uuid(),
            currentOrganizationId: z.string().uuid(),
            accessibleOrganizationIds: z.array(z.string().uuid()),
            organization: z.object({
              id: z.string().uuid(),
              name: z.string(),
              slug: z.string(),
              orgCode: z.string(),
              isActive: z.boolean(),
            }).nullable(),
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
      const userId = createUserId(request.user!.id);
      const orgContext = request.user!.organizationContext;

      if (!orgContext) {
        throw Errors.badRequest('No organization context in token');
      }

      // Get current organization details
      const currentOrg = await orgRepo.findById(orgContext.currentOrganizationId);

      return {
        rootOrganizationId: orgContext.rootOrganizationId,
        currentOrganizationId: orgContext.currentOrganizationId,
        accessibleOrganizationIds: orgContext.accessibleOrganizationIds,
        organization: currentOrg ? {
          id: currentOrg.id,
          name: currentOrg.name,
          slug: currentOrg.slug,
          orgCode: currentOrg.orgCode,
          isActive: currentOrg.isActive,
        } : null,
      };
    }
  );
}
