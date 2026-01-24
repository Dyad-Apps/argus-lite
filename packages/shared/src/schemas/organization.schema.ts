/**
 * Organization schemas for validation
 */

import { z } from 'zod';

/** Slug validation - lowercase alphanumeric with hyphens */
export const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug must be at most 100 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric with hyphens'
  );

/** Organization name validation */
export const organizationNameSchema = z
  .string()
  .min(1, 'Organization name is required')
  .max(255, 'Organization name must be at most 255 characters')
  .trim();

/** Create organization request */
export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: slugSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/** Update organization request */
export const updateOrganizationSchema = z.object({
  name: organizationNameSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

/** Organization response */
export const organizationResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;

/** Organization list response */
export const organizationListResponseSchema = z.object({
  data: z.array(organizationResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type OrganizationListResponse = z.infer<typeof organizationListResponseSchema>;
