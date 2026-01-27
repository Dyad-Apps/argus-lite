/**
 * Type management schemas for validation
 * Unified schemas for managing all 5 base type definitions
 */

import { z } from 'zod';

/** Type name validation */
export const typeNameSchema = z
  .string()
  .min(1, 'Type name is required')
  .max(255, 'Type name must be at most 255 characters')
  .trim();

/** Base type definition create schema */
export const createTypeSchema = z.object({
  name: typeNameSchema,
  description: z.string().max(1000).optional(),
  icon: z.string().max(255).optional(),
  category: z.string().max(255).optional(),
  attributeSchema: z.record(z.unknown()).optional(),
  telemetrySchema: z.record(z.unknown()).optional(),
  presentationConfig: z.record(z.unknown()).optional(),
  parentTypeId: z.string().uuid('Invalid parent type ID').optional(),
});
export type CreateTypeInput = z.infer<typeof createTypeSchema>;

/** Base type definition update schema */
export const updateTypeSchema = z.object({
  name: typeNameSchema.optional(),
  description: z.string().max(1000).optional(),
  icon: z.string().max(255).optional(),
  category: z.string().max(255).optional(),
  attributeSchema: z.record(z.unknown()).optional(),
  telemetrySchema: z.record(z.unknown()).optional(),
  presentationConfig: z.record(z.unknown()).optional(),
  parentTypeId: z.string().uuid().nullable().optional(),
});
export type UpdateTypeInput = z.infer<typeof updateTypeSchema>;

/** Base type definition response schema */
export const typeResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  category: z.string().nullable(),
  attributeSchema: z.record(z.unknown()).nullable(),
  telemetrySchema: z.record(z.unknown()).nullable(),
  presentationConfig: z.record(z.unknown()).nullable(),
  parentTypeId: z.string().uuid().nullable(),
  isSystem: z.boolean(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TypeResponse = z.infer<typeof typeResponseSchema>;

/** Type list response */
export const typeListResponseSchema = z.object({
  data: z.array(typeResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type TypeListResponse = z.infer<typeof typeListResponseSchema>;

/** Type query parameters */
export const typeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  parentTypeId: z.string().uuid().optional(),
  includeSystem: z.coerce.boolean().default(true),
  search: z.string().max(255).optional(),
});
export type TypeQuery = z.infer<typeof typeQuerySchema>;
