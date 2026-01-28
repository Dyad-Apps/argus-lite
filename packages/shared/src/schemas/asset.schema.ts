/**
 * Asset schemas for validation
 */

import { z } from 'zod';

/** Asset status enum */
export const assetStatusSchema = z.enum([
  'active',
  'inactive',
  'maintenance',
  'retired',
  'pending',
]);
export type AssetStatus = z.infer<typeof assetStatusSchema>;

/** Asset name validation */
export const assetNameSchema = z
  .string()
  .min(1, 'Asset name is required')
  .max(255, 'Asset name must be at most 255 characters')
  .trim();

/** Geolocation schema */
export const geolocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Geolocation = z.infer<typeof geolocationSchema>;

/** Create asset request */
export const createAssetSchema = z.object({
  assetTypeId: z.string().uuid('Invalid asset type ID'),
  parentAssetId: z.string().uuid('Invalid parent asset ID').optional(),
  name: assetNameSchema,
  description: z.string().max(1000).optional(),
  serialNumber: z.string().max(100).optional(),
  model: z.string().max(255).optional(),
  manufacturer: z.string().max(255).optional(),
  status: assetStatusSchema.default('active'),
  healthScore: z.number().min(0).max(100).optional(),
  geolocation: geolocationSchema.optional(),
  customAttributes: z.record(z.string(), z.unknown()).default({}),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

/** Update asset request */
export const updateAssetSchema = z.object({
  assetTypeId: z.string().uuid().optional(),
  parentAssetId: z.string().uuid().nullable().optional(),
  name: assetNameSchema.optional(),
  description: z.string().max(1000).optional(),
  serialNumber: z.string().max(100).optional(),
  model: z.string().max(255).optional(),
  manufacturer: z.string().max(255).optional(),
  status: assetStatusSchema.optional(),
  healthScore: z.number().min(0).max(100).optional(),
  geolocation: geolocationSchema.nullable().optional(),
  customAttributes: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

/** Asset response */
export const assetResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  assetTypeId: z.string().uuid(),
  parentAssetId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  serialNumber: z.string().nullable(),
  model: z.string().nullable(),
  manufacturer: z.string().nullable(),
  status: assetStatusSchema,
  healthScore: z.string().nullable(), // Numeric stored as string
  geolocation: geolocationSchema.nullable(),
  lastLocationUpdate: z.string().datetime().nullable(),
  customAttributes: z.record(z.string(), z.unknown()),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AssetResponse = z.infer<typeof assetResponseSchema>;

/** Asset list response */
export const assetListResponseSchema = z.object({
  data: z.array(assetResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type AssetListResponse = z.infer<typeof assetListResponseSchema>;

/** Asset query parameters */
export const assetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: assetStatusSchema.optional(),
  assetTypeId: z.string().uuid().optional(),
  parentAssetId: z.string().uuid().optional(),
  rootOnly: z.coerce.boolean().default(false),
  search: z.string().max(255).optional(),
});
export type AssetQuery = z.infer<typeof assetQuerySchema>;

/** Nearby assets query parameters */
export const nearbyAssetsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().min(1).max(50000).default(1000), // Max 50km
});
export type NearbyAssetsQuery = z.infer<typeof nearbyAssetsQuerySchema>;
