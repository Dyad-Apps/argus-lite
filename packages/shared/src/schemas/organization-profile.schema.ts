/**
 * Organization Profile schemas for validation
 */

import { z } from 'zod';

/** Profile type */
export const profileTypeSchema = z.enum(['root', 'child', 'universal']);
export type ProfileType = z.infer<typeof profileTypeSchema>;

/** Profile capabilities */
export const profileCapabilitiesSchema = z.object({
  whiteLabeling: z.boolean().optional(),
  sso: z.boolean().optional(),
  ssoEnabled: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
  apiAccess: z.boolean().optional(),
  aiFeatures: z.boolean().optional(),
  advancedAnalytics: z.boolean().optional(),
  advancedAuditLogs: z.boolean().optional(),
  customIntegrations: z.boolean().optional(),
  customDomain: z.boolean().optional(),
  canHaveChildren: z.boolean().optional(),
  childOrganizations: z.boolean().optional(),
  impersonation: z.boolean().optional(),
  maxChildDepth: z.number().int().min(0).optional(),
});
export type ProfileCapabilities = z.infer<typeof profileCapabilitiesSchema>;

/** Profile limits (-1 means unlimited) */
export const profileLimitsSchema = z.object({
  maxUsers: z.number().int().min(-1).optional(),
  maxDevices: z.number().int().min(-1).optional(),
  maxAssets: z.number().int().min(-1).optional(),
  maxDashboards: z.number().int().min(-1).optional(),
  maxApiKeys: z.number().int().min(-1).optional(),
  maxChildOrganizations: z.number().int().min(-1).optional(),
  maxOrganizations: z.number().int().min(-1).optional(),
  maxRoles: z.number().int().min(-1).optional(),
  maxGroups: z.number().int().min(-1).optional(),
  apiRequestsPerDay: z.number().int().min(-1).optional(),
  dataRetentionDays: z.number().int().min(1).optional(),
  storageGb: z.number().min(-1).optional(),
});
export type ProfileLimits = z.infer<typeof profileLimitsSchema>;

/** Create organization profile request */
export const createOrganizationProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  type: profileTypeSchema.default('universal'),
  capabilities: profileCapabilitiesSchema.optional(),
  limits: profileLimitsSchema.optional(),
});
export type CreateOrganizationProfileInput = z.infer<typeof createOrganizationProfileSchema>;

/** Update organization profile request */
export const updateOrganizationProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  type: profileTypeSchema.optional(),
  capabilities: profileCapabilitiesSchema.optional(),
  limits: profileLimitsSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;

/** Organization profile response */
export const organizationProfileResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  type: profileTypeSchema,
  isSystem: z.boolean(),
  capabilities: profileCapabilitiesSchema,
  limits: profileLimitsSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationProfileResponse = z.infer<typeof organizationProfileResponseSchema>;

/** Organization profile list response */
export const organizationProfileListResponseSchema = z.object({
  data: z.array(organizationProfileResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type OrganizationProfileListResponse = z.infer<typeof organizationProfileListResponseSchema>;
