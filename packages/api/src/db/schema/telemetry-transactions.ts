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
 * Telemetry Transactions - Tracks atomic processing of complex gateway messages
 *
 * Ensures all logical devices in a single gateway message are processed together
 * before making data visible in the UI. Prevents partial updates (e.g., only 30
 * of 50 location beacons updated). Used by Transaction Coordinator.
 *
 * @see Gateway_Complex_Telemetry_Architecture.md Section 3.4 (Transaction Coordinator)
 */
export const telemetryTransactions = pgTable(
  'telemetry_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Transaction tracking
    correlationId: text('correlation_id').notNull(),
    gatewayDeviceId: uuid('gateway_device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),

    // Progress tracking
    totalLogicalDevices: integer('total_logical_devices').notNull(),
    processedDevices: integer('processed_devices').notNull().default(0),

    // Status
    status: text('status').notNull().default('pending'),

    // Timestamps
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Error handling
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => [
    // Unique constraint for correlation_id
    unique('telemetry_transactions_correlation_unique').on(
      table.correlationId
    ),
    // Primary query: find transaction by correlation_id
    index('idx_telemetry_transactions_correlation').on(table.correlationId),
    // Status filtering (find pending transactions)
    index('idx_telemetry_transactions_status').on(table.status),
    // Tenant isolation
    index('idx_telemetry_transactions_tenant').on(table.tenantId),
    // Gateway device filtering
    index('idx_telemetry_transactions_gateway').on(table.gatewayDeviceId),
    // Cleanup stale transactions
    index('idx_telemetry_transactions_started').on(table.startedAt),
  ]
);

export type TelemetryTransaction = typeof telemetryTransactions.$inferSelect;
export type NewTelemetryTransaction = typeof telemetryTransactions.$inferInsert;
