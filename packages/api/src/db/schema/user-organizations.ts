/**
 * User-Organization junction table
 * Implements many-to-many relationship with roles
 */

import {
  pgTable,
  uuid,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';
import { organizationRoleEnum } from './enums.js';

/**
 * User-Organization membership
 * - Users can belong to multiple organizations
 * - Each membership has a role
 * - Composite primary key on (userId, organizationId)
 */
export const userOrganizations = pgTable(
  'user_organizations',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: organizationRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    invitedBy: uuid('invited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.organizationId] }),
    index('idx_user_organizations_user_id').on(table.userId),
    index('idx_user_organizations_org_id').on(table.organizationId),
    index('idx_user_organizations_role').on(table.role),
  ]
);

// Infer types from schema
export type UserOrganization = typeof userOrganizations.$inferSelect;
export type NewUserOrganization = typeof userOrganizations.$inferInsert;
