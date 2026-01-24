/**
 * Organization membership schemas for validation
 */

import { z } from 'zod';
import { userResponseSchema } from './user.schema.js';
import { organizationResponseSchema } from './organization.schema.js';

/** Organization role enum */
export const organizationRoleSchema = z.enum([
  'owner',
  'admin',
  'member',
  'viewer',
]);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

/** Add member to organization request */
export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: organizationRoleSchema.default('member'),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/** Update member role request */
export const updateMemberRoleSchema = z.object({
  role: organizationRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

/** Organization member response */
export const memberResponseSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: organizationRoleSchema,
  joinedAt: z.string().datetime(),
  invitedBy: z.string().uuid().nullable(),
  user: userResponseSchema.optional(),
});
export type MemberResponse = z.infer<typeof memberResponseSchema>;

/** Member list response */
export const memberListResponseSchema = z.object({
  data: z.array(memberResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;

/** User's organization membership */
export const userMembershipSchema = z.object({
  organization: organizationResponseSchema,
  role: organizationRoleSchema,
  joinedAt: z.string().datetime(),
});
export type UserMembership = z.infer<typeof userMembershipSchema>;

/** User's organizations list response */
export const userOrganizationsResponseSchema = z.object({
  data: z.array(userMembershipSchema),
});
export type UserOrganizationsResponse = z.infer<typeof userOrganizationsResponseSchema>;
