/**
 * Audit logs table for security and compliance tracking
 *
 * Records security-relevant events like authentication, authorization,
 * and data modifications for compliance and forensics.
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  bigserial,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * Audit event category
 */
export const auditCategoryEnum = pgEnum('audit_category', [
  'authentication',
  'authorization',
  'user_management',
  'organization_management',
  'data_access',
  'data_modification',
  'system',
]);

/**
 * Audit logs table
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),

    // Event categorization
    category: auditCategoryEnum('category').notNull(),
    action: varchar('action', { length: 100 }).notNull(),

    // Actor information
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    userEmail: varchar('user_email', { length: 255 }),

    // Organization context (if applicable)
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),

    // Target resource
    resourceType: varchar('resource_type', { length: 100 }),
    resourceId: varchar('resource_id', { length: 255 }),

    // Event details
    details: jsonb('details'),
    outcome: varchar('outcome', { length: 20 }).notNull().default('success'),

    // Request context
    requestId: varchar('request_id', { length: 36 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_user').on(table.userId, table.createdAt),
    index('idx_audit_logs_org').on(table.organizationId, table.createdAt),
    index('idx_audit_logs_category').on(table.category, table.createdAt),
    index('idx_audit_logs_action').on(table.action, table.createdAt),
    index('idx_audit_logs_resource').on(table.resourceType, table.resourceId),
    index('idx_audit_logs_created').on(table.createdAt),
  ]
);

// Infer types from schema
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
