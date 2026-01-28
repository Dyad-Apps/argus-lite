/**
 * Person schemas for validation
 */

import { z } from 'zod';

/** Person name validation */
export const personNameSchema = z
  .string()
  .min(1, 'Person name is required')
  .max(255, 'Person name must be at most 255 characters')
  .trim();

/** Create person request */
export const createPersonSchema = z.object({
  personTypeId: z.string().uuid('Invalid person type ID'),
  userId: z.string().uuid('Invalid user ID'),
  name: personNameSchema,
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  customAttributes: z.record(z.unknown()).default({}),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

/** Update person request */
export const updatePersonSchema = z.object({
  personTypeId: z.string().uuid().optional(),
  name: personNameSchema.optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  customAttributes: z.record(z.unknown()).optional(),
});
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

/** Person response */
export const personResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  personTypeId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  title: z.string().nullable(),
  department: z.string().nullable(),
  geolocation: z.string().nullable(),
  customAttributes: z.record(z.unknown()),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PersonResponse = z.infer<typeof personResponseSchema>;

/** Person list response */
export const personListResponseSchema = z.object({
  data: z.array(personResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type PersonListResponse = z.infer<typeof personListResponseSchema>;

/** Person query parameters */
export const personQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  personTypeId: z.string().uuid().optional(),
  department: z.string().optional(),
  search: z.string().max(255).optional(),
});
export type PersonQuery = z.infer<typeof personQuerySchema>;
