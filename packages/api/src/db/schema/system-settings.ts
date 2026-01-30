/**
 * System Settings Schema
 *
 * Centralized system-level configuration managed by SysAdmins.
 * Settings are stored as JSONB for flexibility.
 */

import { pgTable, uuid, text, jsonb, boolean, timestamp, check } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const systemSettings = pgTable(
  'system_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: text('category').notNull(),
    key: text('key').notNull(),
    value: jsonb('value').notNull().$type<Record<string, unknown>>(),
    description: text('description'),
    isPublic: boolean('is_public').default(false),
    isEncrypted: boolean('is_encrypted').default(false),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    categoryKeyUnique: {
      name: 'system_settings_category_key_unique',
      columns: [table.category, table.key],
    },
    categoryCheck: check(
      'system_settings_category_check',
      `category IN ('iot', 'mqtt', 'integrations', 'security', 'email', 'storage', 'general')`
    ),
  })
);

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

/**
 * System Setting Categories
 */
export const SYSTEM_SETTING_CATEGORIES = [
  'iot',
  'mqtt',
  'integrations',
  'security',
  'email',
  'storage',
  'general',
] as const;

export type SystemSettingCategory = (typeof SYSTEM_SETTING_CATEGORIES)[number];

/**
 * Type-safe system setting values
 */
export interface ChirpStackIntegrationSetting {
  enabled: boolean;
  topicPattern: string;
  description?: string;
}

export interface MqttBrokerConfigSetting {
  brokerUrl: string;
  qos: 0 | 1 | 2;
  keepalive: number;
  reconnectPeriod: number;
}

export interface ProcessingConfigSetting {
  maxMessageSize: number;
  batchSize: number;
  batchTimeout: number;
  validateMessages: boolean;
}
