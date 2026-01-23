import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  doublePrecision,
  bigserial,
  index,
} from 'drizzle-orm/pg-core';
import { baseTypeEnum, telemetryQualityEnum } from './enums.js';
import { organizations } from './organizations.js';

/**
 * Telemetry History - Time-series data from entities
 *
 * Stores historical telemetry readings from devices and assets.
 * Consider using TimescaleDB hypertable for production scale.
 *
 * Namespaced binding convention: {BaseType}.{EntityId}.{PropertyName}
 *
 * @see META_MODEL_SPECIFICATION.md Section 6
 */
export const telemetryHistory = pgTable(
  'telemetry_history',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id').notNull(),
    entityType: baseTypeEnum('entity_type').notNull(),

    // Metric identification
    metricKey: varchar('metric_key', { length: 100 }).notNull(),
    value: doublePrecision('value').notNull(),

    // Data quality indicator
    quality: telemetryQualityEnum('quality').default('good'),

    // Timestamps
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Primary query patterns
    index('idx_telemetry_entity_time').on(table.entityId, table.timestamp),
    index('idx_telemetry_metric_time').on(table.metricKey, table.timestamp),
    // Composite index for specific entity + metric queries
    index('idx_telemetry_composite').on(
      table.entityId,
      table.metricKey,
      table.timestamp
    ),
    // Tenant isolation
    index('idx_telemetry_tenant').on(table.tenantId),
  ]
);

// Note: For production, consider converting to TimescaleDB hypertable:
// SELECT create_hypertable('telemetry_history', 'timestamp');

// Infer types from schema
export type TelemetryRecord = typeof telemetryHistory.$inferSelect;
export type NewTelemetryRecord = typeof telemetryHistory.$inferInsert;
