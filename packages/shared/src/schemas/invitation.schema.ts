/**
 * Organization invitation schemas for validation
 */

import { z } from 'zod';
import { organizationRoleSchema } from './membership.schema.js';

/** Invitation status enum */
export const invitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired',
  'cancelled',
]);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

/** Create invitation request */
export const createInvitationSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  role: organizationRoleSchema.default('member'),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Invitation response */
export const invitationResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationName: z.string().optional(),
  email: z.string().email(),
  role: organizationRoleSchema,
  status: invitationStatusSchema,
  invitedBy: z.string().uuid(),
  inviterName: z.string().optional(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;

/** Invitation list response */
export const invitationListResponseSchema = z.object({
  data: z.array(invitationResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type InvitationListResponse = z.infer<typeof invitationListResponseSchema>;

/** Accept invitation request */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
