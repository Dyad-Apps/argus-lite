import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  numeric,
} from 'drizzle-orm/pg-core';
import { entityTypeEnum, telemetryQualityEnum } from './enums.js';
import { organizations } from './organizations.js';
import { devices } from './devices.js';

/**
 * Telemetry History - Processed, queryable telemetry data
 *
 * Stores processed telemetry from both devices and assets after normalization
 * and transformation. Optimized for time-series queries with TimescaleDB.
 * Used by Asset Telemetry Worker for health score computation.
 *
 * @see IoT_Platform_Architecture_Design.md Section 4.3.3 (TSDB Writer)
 */
export const telemetryHistory = pgTable(
  'telemetry_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Entity reference (polymorphic: device or asset)
    entityId: uuid('entity_id').notNull(),
    entityType: entityTypeEnum('entity_type').notNull(),

    // Metric data
    metricKey: text('metric_key').notNull(),
    value: numeric('value'),
    valueText: text('value_text'),
    valueJson: jsonb('value_json'),
    unit: text('unit'),
    quality: telemetryQualityEnum('quality').default('good'),

    // Timestamps
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Traceability
    sourceDeviceId: uuid('source_device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    sourceMessageId: text('source_message_id'),
    metadata: jsonb('metadata').notNull().default({}),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Primary query patterns: entity + time range
    index('idx_telemetry_history_entity_time').on(
      table.entityId,
      table.entityType,
      table.timestamp
    ),
    // Time-series queries (most recent first)
    index('idx_telemetry_history_timestamp_desc').on(table.timestamp.desc()),
    // Tenant isolation
    index('idx_telemetry_history_tenant').on(table.tenantId),
    // Metric filtering
    index('idx_telemetry_history_metric').on(table.metricKey),
    // Quality filtering
    index('idx_telemetry_history_quality').on(table.quality),
    // Traceability
    index('idx_telemetry_history_source_device').on(table.sourceDeviceId),
  ]
);

export type TelemetryHistory = typeof telemetryHistory.$inferSelect;
export type NewTelemetryHistory = typeof telemetryHistory.$inferInsert;
