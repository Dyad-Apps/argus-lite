import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  pgEnum,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

/**
 * User account status
 */
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'inactive',
  'suspended',
  'deleted',
]);

/**
 * Users table - authentication and identity
 *
 * Per ADR-002: Subdomain-Based Root Organization Identification
 * - Users belong to a root organization (root_organization_id)
 * - Email is unique per root organization, not globally
 * - Users have a primary organization (default after login)
 * - Users can access multiple child organizations under the same root
 *
 * @see ADR-002: Subdomain-Based Root Organization Identification
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),

    // Password hash (null for SSO-only users)
    passwordHash: varchar('password_hash', { length: 255 }),

    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),

    // === Organization Context (ADR-002) ===

    // Root organization this user belongs to (required for data isolation)
    // Same email can exist in different root organizations
    rootOrganizationId: uuid('root_organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // User's primary/default organization (where they land after login)
    // Must be within their root organization's hierarchy
    primaryOrganizationId: uuid('primary_organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    // === Account Status ===
    status: userStatusEnum('status').notNull().default('active'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // MFA settings
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecret: varchar('mfa_secret', { length: 255 }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Email unique per root organization (ADR-002)
    uniqueIndex('idx_users_email_root').on(table.email, table.rootOrganizationId),
    index('idx_users_status').on(table.status),
    index('idx_users_root_org').on(table.rootOrganizationId),
    index('idx_users_primary_org').on(table.primaryOrganizationId),
  ]
);

// Infer types from schema
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
