/**
 * Roles & Permissions - RBAC system
 *
 * Supports:
 * - System roles (predefined, cannot be modified)
 * - Custom organization roles
 * - Resource-based permissions (CRUD per resource type)
 * - Scope-based access (organization, child orgs, etc.)
 * - Role assignments to users and groups
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  index,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';
import { userGroups } from './user-groups.js';

/**
 * Role scope - determines where the role applies
 */
export const roleScopeEnum = pgEnum('role_scope', [
  'organization', // Only within the specific organization
  'children', // Organization and all children
  'tree', // Entire organization tree (root and all descendants)
]);

/**
 * Role source - how the role was assigned
 */
export const roleSourceEnum = pgEnum('role_source', [
  'direct', // Assigned directly to user
  'group', // Inherited from group membership
  'sso', // Provisioned via SSO
  'inherited', // Inherited from parent organization
]);

/**
 * Permission action types
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

/**
 * Resource permission configuration
 */
export interface ResourcePermission {
  resource: string;
  actions: PermissionAction[];
}

/**
 * Role permissions structure
 */
export interface RolePermissions {
  resources: ResourcePermission[];
  // Menu items this role can access
  menuAccess?: string[];
  // Additional custom permissions
  custom?: Record<string, boolean>;
}

/**
 * Roles table
 *
 * Defines roles that can be assigned to users or groups.
 * System roles are predefined and cannot be modified.
 * Organization roles are custom and scoped to an organization.
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Name must be unique within the organization (or globally for system roles)
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),

    // NULL organizationId means this is a system role (global)
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    // System roles cannot be modified or deleted
    isSystem: boolean('is_system').notNull().default(false),

    // Default scope for this role
    defaultScope: roleScopeEnum('default_scope').notNull().default('organization'),

    // Permissions configuration
    permissions: jsonb('permissions').$type<RolePermissions>().default({
      resources: [],
      menuAccess: [],
    }),

    // Role priority for conflict resolution (higher = more important)
    priority: varchar('priority', { length: 10 }).notNull().default('0'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_roles_org').on(table.organizationId),
    index('idx_roles_name').on(table.name),
    index('idx_roles_system').on(table.isSystem),
  ]
);

/**
 * User role assignments
 *
 * Assigns roles directly to users within an organization context.
 */
export const userRoleAssignments = pgTable(
  'user_role_assignments',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Override the role's default scope for this assignment
    scope: roleScopeEnum('scope'),

    // How this role was assigned
    source: roleSourceEnum('source').notNull().default('direct'),

    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Who assigned this role
    assignedBy: uuid('assigned_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Optional expiration for temporary role grants
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId, table.organizationId] }),
    index('idx_user_role_assignments_user').on(table.userId),
    index('idx_user_role_assignments_role').on(table.roleId),
    index('idx_user_role_assignments_org').on(table.organizationId),
  ]
);

/**
 * Group role assignments
 *
 * Assigns roles to groups. All members of the group inherit these roles.
 */
export const groupRoleAssignments = pgTable(
  'group_role_assignments',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => userGroups.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    // Override the role's default scope for this assignment
    scope: roleScopeEnum('scope'),

    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Who assigned this role to the group
    assignedBy: uuid('assigned_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.roleId] }),
    index('idx_group_role_assignments_group').on(table.groupId),
    index('idx_group_role_assignments_role').on(table.roleId),
  ]
);

// Infer types from schema
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type NewUserRoleAssignment = typeof userRoleAssignments.$inferInsert;
export type GroupRoleAssignment = typeof groupRoleAssignments.$inferSelect;
export type NewGroupRoleAssignment = typeof groupRoleAssignments.$inferInsert;
