/**
 * Role schemas for validation
 */

import { z } from 'zod';

/** Role scope */
export const roleScopeSchema = z.enum(['organization', 'children', 'tree']);
export type RoleScope = z.infer<typeof roleScopeSchema>;

/** Role source - how a role was assigned */
export const roleSourceSchema = z.enum(['direct', 'group', 'sso', 'inherited']);
export type RoleSource = z.infer<typeof roleSourceSchema>;

/** Permission action */
export const permissionActionSchema = z.enum(['create', 'read', 'update', 'delete']);
export type PermissionAction = z.infer<typeof permissionActionSchema>;

/** Resource permission */
export const resourcePermissionSchema = z.object({
  resource: z.string(),
  actions: z.array(permissionActionSchema),
});
export type ResourcePermission = z.infer<typeof resourcePermissionSchema>;

/** Role permissions structure */
export const rolePermissionsSchema = z.object({
  resources: z.array(resourcePermissionSchema),
  menuAccess: z.array(z.string()).optional(),
  custom: z.record(z.string(), z.boolean()).optional(),
});
export type RolePermissions = z.infer<typeof rolePermissionsSchema>;

/** Create role request */
export const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  defaultScope: roleScopeSchema.default('organization'),
  permissions: rolePermissionsSchema.optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

/** Update role request */
export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  defaultScope: roleScopeSchema.optional(),
  permissions: rolePermissionsSchema.optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/** Assign role to user request */
export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid(),
  scope: roleScopeSchema.optional(),
  expiresAt: z.string().datetime().optional(),
});
export type AssignUserRoleInput = z.infer<typeof assignUserRoleSchema>;

/** Assign role to group request */
export const assignGroupRoleSchema = z.object({
  roleId: z.string().uuid(),
  scope: roleScopeSchema.optional(),
});
export type AssignGroupRoleInput = z.infer<typeof assignGroupRoleSchema>;

/** Role response */
export const roleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string().uuid().nullable(),
  isSystem: z.boolean(),
  defaultScope: roleScopeSchema,
  permissions: rolePermissionsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RoleResponse = z.infer<typeof roleResponseSchema>;

/** Role list response */
export const roleListResponseSchema = z.object({
  data: z.array(roleResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type RoleListResponse = z.infer<typeof roleListResponseSchema>;

/** User role assignment response */
export const userRoleAssignmentResponseSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  roleName: z.string(),
  organizationId: z.string().uuid(),
  scope: roleScopeSchema.nullable(),
  source: roleSourceSchema,
  assignedAt: z.string().datetime(),
  assignedBy: z.string().uuid().nullable(),
  expiresAt: z.string().datetime().nullable(),
});
export type UserRoleAssignmentResponse = z.infer<typeof userRoleAssignmentResponseSchema>;

/** User role assignments list response */
export const userRoleAssignmentsResponseSchema = z.object({
  data: z.array(userRoleAssignmentResponseSchema),
});
export type UserRoleAssignmentsResponse = z.infer<typeof userRoleAssignmentsResponseSchema>;
