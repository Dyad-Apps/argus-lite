/**
 * Organization invitation routes
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createInvitationSchema,
  invitationResponseSchema,
  invitationListResponseSchema,
  acceptInvitationSchema,
  Errors,
  createOrganizationId,
  createInvitationId,
} from '@argus/shared';
import {
  getInvitationRepository,
  hashInvitationToken,
  getOrganizationRepository,
  getUserOrganizationRepository,
  getUserRepository,
} from '../../repositories/index.js';

export async function invitationRoutes(app: FastifyInstance): Promise<void> {
  const invitationRepo = getInvitationRepository();
  const orgRepo = getOrganizationRepository();
  const memberRepo = getUserOrganizationRepository();
  const userRepo = getUserRepository();

  // GET /organizations/:orgId/invitations - List invitations for an organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:orgId/invitations',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          status: z.enum(['pending', 'accepted', 'declined', 'expired', 'cancelled']).optional(),
        }),
        response: {
          200: invitationListResponseSchema,
          403: z.object({
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
      const orgId = createOrganizationId(request.params.orgId);
      const { page, pageSize, status } = request.query;

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can view invitations');
      }

      const result = await invitationRepo.listByOrganization(orgId, {
        page,
        pageSize,
        status,
      });

      return {
        data: result.data.map((inv) => ({
          id: inv.id,
          organizationId: inv.organizationId,
          organizationName: inv.organization.name,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          invitedBy: inv.invitedBy,
          inviterName: [inv.inviter.firstName, inv.inviter.lastName]
            .filter(Boolean)
            .join(' ') || inv.inviter.email,
          expiresAt: inv.expiresAt.toISOString(),
          createdAt: inv.createdAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // POST /organizations/:orgId/invitations - Create invitation
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations/:orgId/invitations',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
        }),
        body: createInvitationSchema,
        response: {
          201: z.object({
            invitation: invitationResponseSchema,
            // In development, return the token for testing
            token: z.string().optional(),
          }),
          403: z.object({
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
      const orgId = createOrganizationId(request.params.orgId);
      const { email, role } = request.body;

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can invite members');
      }

      // Verify organization exists
      const org = await orgRepo.findById(orgId);
      if (!org) {
        throw Errors.notFound('Organization');
      }

      // Check if user is already a member
      const existingUser = await userRepo.findByEmail(email);
      if (existingUser) {
        const existingMembership = await memberRepo.findMembership(
          existingUser.id as any,
          orgId
        );
        if (existingMembership) {
          throw Errors.conflict('User is already a member of this organization');
        }
      }

      // Create invitation
      const { token, invitation } = await invitationRepo.create({
        organizationId: orgId,
        email,
        role,
        invitedBy: request.user!.id,
      });

      const isDev = process.env.NODE_ENV !== 'production';

      return reply.status(201).send({
        invitation: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          organizationName: org.name,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          invitedBy: invitation.invitedBy,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        },
        // In production, this would be sent via email
        ...(isDev && { token }),
      });
    }
  );

  // DELETE /organizations/:orgId/invitations/:id - Cancel invitation
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/organizations/:orgId/invitations/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
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
      const orgId = createOrganizationId(request.params.orgId);
      const invitationId = createInvitationId(request.params.id);

      // Check if user is admin or owner
      const hasPermission = await memberRepo.hasRoleOrHigher(
        request.user!.id,
        orgId,
        'admin'
      );
      if (!hasPermission) {
        throw Errors.forbidden('Only admins and owners can cancel invitations');
      }

      const cancelled = await invitationRepo.cancel(invitationId);
      if (!cancelled) {
        throw Errors.notFound('Invitation');
      }

      return reply.status(204).send(null);
    }
  );

  // GET /invitations/verify - Verify invitation token (public)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/invitations/verify',
    {
      schema: {
        querystring: z.object({
          token: z.string().min(1),
        }),
        response: {
          200: z.object({
            valid: z.literal(true),
            invitation: invitationResponseSchema,
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
      const { token } = request.query;
      const tokenHash = hashInvitationToken(token);

      const invitation = await invitationRepo.findPendingByTokenHash(tokenHash);
      if (!invitation) {
        throw Errors.notFound('Invitation');
      }

      return {
        valid: true as const,
        invitation: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          organizationName: invitation.organization.name,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          invitedBy: invitation.invitedBy,
          inviterName: [invitation.inviter.firstName, invitation.inviter.lastName]
            .filter(Boolean)
            .join(' ') || invitation.inviter.email,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        },
      };
    }
  );

  // POST /invitations/accept - Accept invitation (requires auth)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/invitations/accept',
    {
      preHandler: app.authenticate,
      schema: {
        body: acceptInvitationSchema,
        response: {
          200: z.object({
            message: z.string(),
            organizationId: z.string().uuid(),
          }),
          400: z.object({
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
      const { token } = request.body;
      const tokenHash = hashInvitationToken(token);
      const userId = request.user!.id;

      const invitation = await invitationRepo.findPendingByTokenHash(tokenHash);
      if (!invitation) {
        throw Errors.notFound('Invalid or expired invitation');
      }

      // Verify email matches
      const user = await userRepo.findById(userId);
      if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw Errors.badRequest(
          'This invitation was sent to a different email address'
        );
      }

      // Check if already a member
      const existingMembership = await memberRepo.findMembership(
        userId,
        invitation.organizationId as any
      );
      if (existingMembership) {
        throw Errors.conflict('You are already a member of this organization');
      }

      // Accept invitation and add as member in a transaction
      await invitationRepo.withTransaction(async (trx) => {
        await invitationRepo.accept(invitation.id as any, userId, trx);
        await memberRepo.addMember(
          {
            userId,
            organizationId: invitation.organizationId,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
          },
          trx
        );
      });

      return {
        message: 'Successfully joined the organization',
        organizationId: invitation.organizationId,
      };
    }
  );

  // POST /invitations/decline - Decline invitation (public with token)
  app.withTypeProvider<ZodTypeProvider>().post(
    '/invitations/decline',
    {
      schema: {
        body: z.object({
          token: z.string().min(1),
        }),
        response: {
          200: z.object({
            message: z.string(),
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
      const { token } = request.body;
      const tokenHash = hashInvitationToken(token);

      const invitation = await invitationRepo.findPendingByTokenHash(tokenHash);
      if (!invitation) {
        throw Errors.notFound('Invalid or expired invitation');
      }

      await invitationRepo.decline(invitation.id as any);

      return {
        message: 'Invitation declined',
      };
    }
  );
}
