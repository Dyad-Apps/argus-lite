import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { devices } from './devices.js';

/**
 * Telemetry Chunks - Temporary storage for chunked message reassembly
 *
 * Stores individual chunks from multi-part messages (BLE gateways with 2000 beacons
 * split into 67 chunks). Once all chunks arrive, they're reassembled and deleted.
 * Auto-expires after 60 seconds to prevent memory leaks.
 *
 * @see Gateway_Complex_Telemetry_Architecture.md Section 3.2 (Chunk Reassembly)
 */
export const telemetryChunks = pgTable(
  'telemetry_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),

    // Chunk identification
    correlationId: text('correlation_id').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),
    totalChunks: integer('total_chunks').notNull(),
    chunkPayload: jsonb('chunk_payload').notNull(),

    // Timestamps & TTL
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    // Unique constraint for correlation + sequence
    unique('telemetry_chunks_unique_sequence').on(
      table.correlationId,
      table.sequenceNumber
    ),
    // Primary query: fetch all chunks for correlation_id
    index('idx_telemetry_chunks_correlation').on(table.correlationId),
    // Tenant isolation
    index('idx_telemetry_chunks_tenant').on(table.tenantId),
    // Device filtering
    index('idx_telemetry_chunks_device').on(table.deviceId),
    // TTL cleanup (background job)
    index('idx_telemetry_chunks_expires').on(table.expiresAt),
  ]
);

export type TelemetryChunk = typeof telemetryChunks.$inferSelect;
export type NewTelemetryChunk = typeof telemetryChunks.$inferInsert;
