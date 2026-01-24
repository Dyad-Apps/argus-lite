/**
 * User schemas for validation
 */

import { z } from 'zod';

/** User status enum */
export const userStatusSchema = z.enum([
  'active',
  'inactive',
  'suspended',
  'deleted',
]);
export type UserStatus = z.infer<typeof userStatusSchema>;

/** Email validation with lowercase normalization */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255)
  .transform((email) => email.toLowerCase().trim());

/** Password requirements: min 8 chars, 1 upper, 1 lower, 1 number */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/** Name field validation */
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100)
  .trim();

/** Optional name field */
export const optionalNameSchema = z
  .string()
  .max(100)
  .trim()
  .optional()
  .nullable();

/** Create user request */
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Update user request */
export const updateUserSchema = z.object({
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  status: userStatusSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** User response (excludes password) */
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  status: userStatusSchema,
  emailVerifiedAt: z.string().datetime().nullable(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;

/** User list response */
export const userListResponseSchema = z.object({
  data: z.array(userResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type UserListResponse = z.infer<typeof userListResponseSchema>;

/** Change password request */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
