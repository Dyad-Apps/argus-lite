/**
 * Tenant Profile schemas for validation
 */

import { z } from 'zod';

/** Profile type */
export const profileTypeSchema = z.enum(['root', 'child', 'universal']);
export type ProfileType = z.infer<typeof profileTypeSchema>;

/** Profile capabilities */
export const profileCapabilitiesSchema = z.object({
  whiteLabeling: z.boolean().optional(),
  ssoEnabled: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
  apiAccess: z.boolean().optional(),
  aiFeatures: z.boolean().optional(),
  advancedAnalytics: z.boolean().optional(),
  customIntegrations: z.boolean().optional(),
  canHaveChildren: z.boolean().optional(),
  maxChildDepth: z.number().int().min(0).optional(),
});
export type ProfileCapabilities = z.infer<typeof profileCapabilitiesSchema>;

/** Profile limits */
export const profileLimitsSchema = z.object({
  maxUsers: z.number().int().min(0).optional(),
  maxDevices: z.number().int().min(0).optional(),
  maxAssets: z.number().int().min(0).optional(),
  maxDashboards: z.number().int().min(0).optional(),
  maxApiKeys: z.number().int().min(0).optional(),
  maxChildOrganizations: z.number().int().min(0).optional(),
  dataRetentionDays: z.number().int().min(1).optional(),
  storageGb: z.number().min(0).optional(),
});
export type ProfileLimits = z.infer<typeof profileLimitsSchema>;

/** Create tenant profile request */
export const createTenantProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  type: profileTypeSchema.default('universal'),
  capabilities: profileCapabilitiesSchema.optional(),
  limits: profileLimitsSchema.optional(),
});
export type CreateTenantProfileInput = z.infer<typeof createTenantProfileSchema>;

/** Update tenant profile request */
export const updateTenantProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  type: profileTypeSchema.optional(),
  capabilities: profileCapabilitiesSchema.optional(),
  limits: profileLimitsSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTenantProfileInput = z.infer<typeof updateTenantProfileSchema>;

/** Tenant profile response */
export const tenantProfileResponseSchema = z.object({
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
export type TenantProfileResponse = z.infer<typeof tenantProfileResponseSchema>;

/** Tenant profile list response */
export const tenantProfileListResponseSchema = z.object({
  data: z.array(tenantProfileResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type TenantProfileListResponse = z.infer<typeof tenantProfileListResponseSchema>;
