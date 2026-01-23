import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  bigserial,
  index,
} from 'drizzle-orm/pg-core';
import { baseTypeEnum } from './enums.js';
import { organizations } from './organizations.js';

/**
 * System Events - Event-driven logic layer
 *
 * Captures all system events for processing by subscribers.
 * Events include entity changes, telemetry, thresholds, and activities.
 *
 * @see META_MODEL_SPECIFICATION.md Section 7
 */
export const systemEvents = pgTable(
  'system_events',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Event type (e.g., 'ENTITY_CREATED', 'THRESHOLD_BREACHED')
    eventType: varchar('event_type', { length: 100 }).notNull(),

    // Source entity (optional, some events are system-wide)
    entityId: uuid('entity_id'),
    entityType: baseTypeEnum('entity_type'),

    // Event payload - varies by event type
    // For THRESHOLD_BREACHED: { metricKey, triggeredValue, threshold, severity }
    // For ENTITY_CREATED: { entityId, entityType, initialState }
    payload: jsonb('payload').notNull(),

    // Processing state
    processed: boolean('processed').notNull().default(false),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingResult: jsonb('processing_result'),

    // Correlation for tracing related events
    correlationId: uuid('correlation_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Primary query: unprocessed events
    index('idx_events_unprocessed').on(table.processed, table.createdAt),
    // Entity-specific events
    index('idx_events_entity').on(table.entityId, table.createdAt),
    // Event type filtering
    index('idx_events_type').on(table.eventType, table.createdAt),
    // Tenant isolation
    index('idx_events_tenant').on(table.tenantId),
    // Correlation tracing
    index('idx_events_correlation').on(table.correlationId),
  ]
);

/**
 * Permission Audit Log - Tracks permission checks for security auditing
 *
 * @see META_MODEL_SPECIFICATION.md Section 5.5
 */
export const permissionAuditLog = pgTable(
  'permission_audit_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    personId: uuid('person_id').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    permissionLevel: varchar('permission_level', { length: 50 }).notNull(),

    granted: boolean('granted').notNull(),
    denialReason: varchar('denial_reason', { length: 500 }),

    checkedAt: timestamp('checked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_permission_audit_person').on(table.personId, table.checkedAt),
    index('idx_permission_audit_entity').on(table.entityId, table.checkedAt),
    index('idx_permission_audit_tenant').on(table.tenantId),
  ]
);

// Infer types from schema
export type SystemEvent = typeof systemEvents.$inferSelect;
export type NewSystemEvent = typeof systemEvents.$inferInsert;
export type PermissionAuditRecord = typeof permissionAuditLog.$inferSelect;
export type NewPermissionAuditRecord = typeof permissionAuditLog.$inferInsert;
