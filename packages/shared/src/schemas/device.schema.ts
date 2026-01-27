/**
 * Device schemas for validation
 */

import { z } from 'zod';

/** Device status enum */
export const deviceStatusSchema = z.enum([
  'active',
  'inactive',
  'maintenance',
  'offline',
  'error',
]);
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

/** Device name validation */
export const deviceNameSchema = z
  .string()
  .min(1, 'Device name is required')
  .max(255, 'Device name must be at most 255 characters')
  .trim();

/** Create device request */
export const createDeviceSchema = z.object({
  deviceTypeId: z.string().uuid('Invalid device type ID'),
  name: deviceNameSchema,
  description: z.string().max(1000).optional(),
  serialNumber: z.string().max(100).optional(),
  model: z.string().max(255).optional(),
  manufacturer: z.string().max(255).optional(),
  firmwareVersion: z.string().max(50).optional(),
  status: deviceStatusSchema.default('inactive'),
  ipAddress: z.string().ip().optional(),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address').optional(),
  geolocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  customAttributes: z.record(z.unknown()).default({}),
});
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

/** Update device request */
export const updateDeviceSchema = z.object({
  deviceTypeId: z.string().uuid().optional(),
  name: deviceNameSchema.optional(),
  description: z.string().max(1000).optional(),
  serialNumber: z.string().max(100).optional(),
  model: z.string().max(255).optional(),
  manufacturer: z.string().max(255).optional(),
  firmwareVersion: z.string().max(50).optional(),
  status: deviceStatusSchema.optional(),
  ipAddress: z.string().ip().optional(),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional(),
  geolocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  customAttributes: z.record(z.unknown()).optional(),
});
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

/** Device response */
export const deviceResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  deviceTypeId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  serialNumber: z.string().nullable(),
  model: z.string().nullable(),
  manufacturer: z.string().nullable(),
  firmwareVersion: z.string().nullable(),
  status: deviceStatusSchema,
  lastSeenAt: z.string().datetime().nullable(),
  ipAddress: z.string().nullable(),
  macAddress: z.string().nullable(),
  geolocation: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .nullable(),
  customAttributes: z.record(z.unknown()),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DeviceResponse = z.infer<typeof deviceResponseSchema>;

/** Device list response */
export const deviceListResponseSchema = z.object({
  data: z.array(deviceResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type DeviceListResponse = z.infer<typeof deviceListResponseSchema>;

/** Device query parameters */
export const deviceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: deviceStatusSchema.optional(),
  deviceTypeId: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
});
export type DeviceQuery = z.infer<typeof deviceQuerySchema>;
