/**
 * Space schemas for validation
 */

import { z } from 'zod';
import { geolocationSchema } from './asset.schema.js';

/** Space name validation */
export const spaceNameSchema = z
  .string()
  .min(1, 'Space name is required')
  .max(255, 'Space name must be at most 255 characters')
  .trim();

/** Geofence polygon coordinates schema */
export const geofenceSchema = z.array(
  z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ])
).min(3, 'Geofence must have at least 3 coordinate pairs');

/** Create space request */
export const createSpaceSchema = z.object({
  spaceTypeId: z.string().uuid('Invalid space type ID'),
  parentSpaceId: z.string().uuid('Invalid parent space ID').optional(),
  name: spaceNameSchema,
  description: z.string().max(1000).optional(),
  spaceCode: z.string().max(50).optional(),
  floorLevel: z.number().int().optional(),
  areaSqm: z.number().min(0).optional(),
  capacity: z.number().int().min(0).optional(),
  geolocation: geolocationSchema.optional(),
  geofence: geofenceSchema.optional(),
  isActive: z.boolean().default(true),
  customAttributes: z.record(z.string(), z.unknown()).default({}),
});
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;

/** Update space request */
export const updateSpaceSchema = z.object({
  spaceTypeId: z.string().uuid().optional(),
  parentSpaceId: z.string().uuid().nullable().optional(),
  name: spaceNameSchema.optional(),
  description: z.string().max(1000).optional(),
  spaceCode: z.string().max(50).optional(),
  floorLevel: z.number().int().optional(),
  areaSqm: z.number().min(0).optional(),
  capacity: z.number().int().min(0).optional(),
  geolocation: geolocationSchema.nullable().optional(),
  geofence: geofenceSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  customAttributes: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;

/** Space response */
export const spaceResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  spaceTypeId: z.string().uuid(),
  parentSpaceId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  spaceCode: z.string().nullable(),
  floorLevel: z.number().int().nullable(),
  areaSqm: z.string().nullable(), // Numeric stored as string
  capacity: z.number().int().nullable(),
  geolocation: geolocationSchema.nullable(),
  geofence: z.array(z.tuple([z.number(), z.number()])).nullable(),
  isActive: z.boolean(),
  customAttributes: z.record(z.string(), z.unknown()),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SpaceResponse = z.infer<typeof spaceResponseSchema>;

/** Space list response */
export const spaceListResponseSchema = z.object({
  data: z.array(spaceResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type SpaceListResponse = z.infer<typeof spaceListResponseSchema>;

/** Space query parameters */
export const spaceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  spaceTypeId: z.string().uuid().optional(),
  parentSpaceId: z.string().uuid().optional(),
  floorLevel: z.coerce.number().int().optional(),
  rootOnly: z.coerce.boolean().default(false),
  search: z.string().max(255).optional(),
});
export type SpaceQuery = z.infer<typeof spaceQuerySchema>;

/** Nearby spaces query parameters */
export const nearbySpacesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().min(1).max(50000).default(1000), // Max 50km
});
export type NearbySpacesQuery = z.infer<typeof nearbySpacesQuerySchema>;

/** Point-in-space query parameters */
export const pointInSpaceQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type PointInSpaceQuery = z.infer<typeof pointInSpaceQuerySchema>;
