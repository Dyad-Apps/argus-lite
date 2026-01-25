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

/** Organization code validation - uppercase alphanumeric with underscores */
export const orgCodeSchema = z
  .string()
  .min(2, 'Organization code must be at least 2 characters')
  .max(50, 'Organization code must be at most 50 characters')
  .regex(
    /^[A-Z0-9_]+$/,
    'Organization code must be uppercase alphanumeric with underscores'
  );

/** Organization name validation */
export const organizationNameSchema = z
  .string()
  .min(1, 'Organization name is required')
  .max(255, 'Organization name must be at most 255 characters')
  .trim();

/** Domain type for organization */
export const domainTypeSchema = z.enum(['platform', 'custom']);
export type DomainType = z.infer<typeof domainTypeSchema>;

/** Create organization request (legacy - simple form) */
export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: slugSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/** Create root organization request (full form matching reference UI) */
export const createRootOrganizationSchema = z.object({
  name: organizationNameSchema,
  orgCode: orgCodeSchema,
  domainType: domainTypeSchema.default('platform'),
  customDomain: z.string().optional(),
  profileId: z.string().uuid().optional(),
  adminEmail: z.string().email('Invalid email address'),
  allowWhiteLabeling: z.boolean().default(false),
  allowImpersonation: z.boolean().default(false),
});
export type CreateRootOrganizationInput = z.infer<typeof createRootOrganizationSchema>;

/** Update organization request */
export const updateOrganizationSchema = z.object({
  name: organizationNameSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

/** Organization settings schema */
export const organizationSettingsSchema = z.object({
  timezone: z.string().optional(),
  locale: z.string().optional(),
  dateFormat: z.string().optional(),
  features: z.object({
    ssoRequired: z.boolean().optional(),
    mfaRequired: z.boolean().optional(),
    apiAccess: z.boolean().optional(),
    crossOrgSharing: z.boolean().optional(),
    allowWhiteLabeling: z.boolean().optional(),
    allowImpersonation: z.boolean().optional(),
  }).optional(),
}).nullable();
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

/** Organization response */
export const organizationResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  orgCode: z.string().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  isRoot: z.boolean().optional(),
  canHaveChildren: z.boolean().optional(),
  depth: z.number().optional(),
  path: z.string().nullable().optional(),
  subdomain: z.string().nullable().optional(),
  plan: z.string().optional(),
  profileId: z.string().uuid().nullable().optional(),
  parentOrganizationId: z.string().uuid().nullable().optional(),
  rootOrganizationId: z.string().uuid().nullable().optional(),
  settings: organizationSettingsSchema.optional(),
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

/** Organization hierarchy node */
export const organizationHierarchyNodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  orgCode: z.string(),
  depth: z.number(),
  path: z.string().nullable(),
  isRoot: z.boolean(),
  canHaveChildren: z.boolean(),
  isActive: z.boolean(),
  parentOrganizationId: z.string().uuid().nullable(),
  childCount: z.number().optional(),
});
export type OrganizationHierarchyNode = z.infer<typeof organizationHierarchyNodeSchema>;

/** Organization hierarchy response */
export const organizationHierarchyResponseSchema = z.object({
  data: z.array(organizationHierarchyNodeSchema),
});
export type OrganizationHierarchyResponse = z.infer<typeof organizationHierarchyResponseSchema>;

/** Create child organization request */
export const createChildOrganizationSchema = z.object({
  name: organizationNameSchema,
  orgCode: orgCodeSchema,
  description: z.string().max(1000).optional(),
  canHaveChildren: z.boolean().default(false),
  profileId: z.string().uuid().optional(),
});
export type CreateChildOrganizationInput = z.infer<typeof createChildOrganizationSchema>;

/** Login background type */
export const loginBackgroundTypeSchema = z.enum(['default', 'image', 'particles', 'solid']);
export type LoginBackgroundType = z.infer<typeof loginBackgroundTypeSchema>;

/** Organization branding response */
export const organizationBrandingResponseSchema = z.object({
  id: z.string().uuid().nullable(),
  organizationId: z.string().uuid(),
  logoUrl: z.string().nullable(),
  logoDarkUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  loginBackgroundType: loginBackgroundTypeSchema,
  loginBackgroundUrl: z.string().nullable(),
  loginBackgroundColor: z.string().nullable(),
  loginWelcomeText: z.string().nullable(),
  loginSubtitle: z.string().nullable(),
  customCss: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationBrandingResponse = z.infer<typeof organizationBrandingResponseSchema>;

/** Update organization branding request */
export const updateOrganizationBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  logoDarkUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').nullable().optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').nullable().optional(),
  loginBackgroundType: loginBackgroundTypeSchema.optional(),
  loginBackgroundUrl: z.string().url().nullable().optional(),
  loginBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').nullable().optional(),
  loginWelcomeText: z.string().max(100).nullable().optional(),
  loginSubtitle: z.string().max(200).nullable().optional(),
  customCss: z.string().max(10000).nullable().optional(),
});
export type UpdateOrganizationBrandingInput = z.infer<typeof updateOrganizationBrandingSchema>;
