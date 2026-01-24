/**
 * User-Organization junction table
 * Implements many-to-many relationship with roles
 *
 * Per ADR-001 and ADR-002:
 * - Users can have access to multiple organizations under their root
 * - Each access entry has a specific role
 * - Enables organization context switching after login
 * - Access can be time-limited (guest access)
 *
 * @see ADR-001: Multi-Tenant Model
 * @see ADR-002: Subdomain-Based Root Organization Identification
 */

import {
  pgTable,
  uuid,
  timestamp,
  index,
  primaryKey,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';
import { organizationRoleEnum } from './enums.js';

/**
 * User-Organization membership
 * - Users can belong to multiple organizations under their root
 * - Each membership has a role
 * - Composite primary key on (userId, organizationId)
 * - isPrimary flag for default organization after login
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

    // Whether this is the user's primary organization (default after login)
    isPrimary: boolean('is_primary').notNull().default(false),

    // Access can be time-limited (e.g., contractor access)
    expiresAt: timestamp('expires_at', { withTimezone: true }),

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
