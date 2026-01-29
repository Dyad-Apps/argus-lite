import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { devices } from './devices.js';

/**
 * Telemetry Raw - Immutable audit trail of ingested messages
 *
 * Append-only table storing every message received from devices via MQTT or HTTP.
 * Never updated or deleted (except by retention policy). Used for debugging,
 * compliance, and chunk reassembly.
 *
 * @see IoT_Platform_Architecture_Design.md Section 4.3.1 (Demultiplexer Worker)
 */
export const telemetryRaw = pgTable(
  'telemetry_raw',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),

    // Raw payload
    payload: jsonb('payload').notNull(),
    payloadSizeBytes: integer('payload_size_bytes'),

    // Chunking support (for BLE gateways, location hubs)
    correlationId: text('correlation_id'),
    sequenceNumber: integer('sequence_number'),
    totalChunks: integer('total_chunks'),

    // Timestamps
    deviceTimestamp: timestamp('device_timestamp', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Ingestion metadata
    ingestionSource: text('ingestion_source').notNull().default('mqtt'),
    mqttTopic: text('mqtt_topic'),
    clientId: text('client_id'),

    // Audit (immutable - no updatedAt)
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Primary query: device + time range
    index('idx_telemetry_raw_device_time').on(
      table.deviceId,
      table.receivedAt.desc()
    ),
    // Tenant isolation
    index('idx_telemetry_raw_tenant').on(table.tenantId),
    // Chunk reassembly queries
    index('idx_telemetry_raw_correlation').on(table.correlationId),
    // Ingestion source filtering
    index('idx_telemetry_raw_source').on(table.ingestionSource),
    // Time-series retention policy (TimescaleDB)
    index('idx_telemetry_raw_created').on(table.createdAt.desc()),
  ]
);

export type TelemetryRaw = typeof telemetryRaw.$inferSelect;
export type NewTelemetryRaw = typeof telemetryRaw.$inferInsert;
