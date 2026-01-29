import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  numeric,
  integer,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { assetTypes } from './asset-types.js';
import { users } from './users.js';

/**
 * Threshold Rules - Alerting rules for metric thresholds
 *
 * Defines warning and critical thresholds for metrics. When Asset Telemetry Worker
 * computes health scores and detects threshold violations, Event Engine Worker
 * creates events. Supports debouncing, hysteresis, and cooldown to prevent alert spam.
 *
 * @see Asset_Type_Profile_Architecture.md Section 4.4 (Threshold Rules)
 * @see IoT_Platform_Architecture_Design.md Section 4.3.5 (Event Engine Worker)
 */
export const thresholdRules = pgTable(
  'threshold_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Rule identity
    name: text('name').notNull(),
    description: text('description'),

    // Scope: applies to asset type OR specific assets
    assetTypeId: uuid('asset_type_id').references(() => assetTypes.id, {
      onDelete: 'cascade',
    }),
    specificAssetIds: uuid('specific_asset_ids').array(),

    // Metric configuration
    metricKey: text('metric_key').notNull(),
    condition: jsonb('condition').notNull(),
    warningThreshold: numeric('warning_threshold'),
    criticalThreshold: numeric('critical_threshold'),

    // Alert control
    hysteresis: numeric('hysteresis').default('0'),
    debounceSeconds: integer('debounce_seconds').default(60),
    cooldownSeconds: integer('cooldown_seconds').default(300),

    // Event creation
    eventType: text('event_type').notNull(),
    eventSeverity: text('event_severity').notNull(),
    eventPriority: integer('event_priority').default(3),
    messageTemplate: text('message_template'),

    // Status
    isActive: boolean('is_active').default(true),

    // Metadata
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Unique constraint: tenant + name
    uniqueIndex('threshold_rules_org_name_unique').on(
      table.tenantId,
      table.name
    ),
    // Primary query: find rules for asset type
    index('idx_threshold_rules_asset_type').on(table.assetTypeId),
    // Tenant isolation
    index('idx_threshold_rules_tenant').on(table.tenantId),
    // Active rules filtering
    index('idx_threshold_rules_active').on(table.isActive),
    // Metric filtering
    index('idx_threshold_rules_metric').on(table.metricKey),
  ]
);

export type ThresholdRule = typeof thresholdRules.$inferSelect;
export type NewThresholdRule = typeof thresholdRules.$inferInsert;
