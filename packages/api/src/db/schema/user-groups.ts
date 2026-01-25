/**
 * User Groups - Group-based user organization
 *
 * Groups allow organizing users and assigning roles at the group level.
 * When a user joins a group, they inherit all roles assigned to that group.
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * User groups table
 *
 * Groups belong to an organization and contain users.
 * Roles can be assigned to groups, and users inherit those roles.
 */
export const userGroups = pgTable(
  'user_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The organization this group belongs to
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Who created this group
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('idx_user_groups_org').on(table.organizationId),
    index('idx_user_groups_name').on(table.name),
  ]
);

/**
 * Group membership junction table
 *
 * Tracks which users belong to which groups.
 */
export const userGroupMemberships = pgTable(
  'user_group_memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => userGroups.id, { onDelete: 'cascade' }),

    // When the user was added to the group
    addedAt: timestamp('added_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Who added this user to the group
    addedBy: uuid('added_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.groupId] }),
    index('idx_user_group_memberships_user').on(table.userId),
    index('idx_user_group_memberships_group').on(table.groupId),
  ]
);

// Infer types from schema
export type UserGroup = typeof userGroups.$inferSelect;
export type NewUserGroup = typeof userGroups.$inferInsert;
export type UserGroupMembership = typeof userGroupMemberships.$inferSelect;
export type NewUserGroupMembership = typeof userGroupMemberships.$inferInsert;
