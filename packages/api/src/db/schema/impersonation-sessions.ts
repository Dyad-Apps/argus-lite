/**
 * Impersonation sessions table for tracking admin impersonation of users
 * Allows support/admin staff to temporarily access user accounts
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * Impersonation session status enum
 */
export const impersonationStatusEnum = pgEnum('impersonation_status', [
  'active',
  'ended',
  'expired',
  'revoked',
]);

/**
 * Impersonation sessions table
 * Tracks when admin users impersonate other users
 */
export const impersonationSessions = pgTable(
  'impersonation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The admin/support user who initiated the impersonation
    impersonatorId: uuid('impersonator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // The user being impersonated
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Organization context (optional - for org-scoped impersonation)
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'set null' }),
    // Reason for impersonation (required for audit trail)
    reason: text('reason').notNull(),
    // Session status
    status: impersonationStatusEnum('status').notNull().default('active'),
    // Session timestamps
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Client information
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    // Audit timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_impersonation_sessions_impersonator').on(table.impersonatorId),
    index('idx_impersonation_sessions_target').on(table.targetUserId),
    index('idx_impersonation_sessions_status').on(table.status),
    index('idx_impersonation_sessions_org').on(table.organizationId),
    index('idx_impersonation_sessions_expires').on(table.expiresAt),
  ]
);

// Infer types from schema
export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type NewImpersonationSession = typeof impersonationSessions.$inferInsert;
