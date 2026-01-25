/**
 * Organization Profiles - Configuration templates for organizations
 *
 * Profiles define capabilities and limits that can be assigned to organizations.
 * This enables consistent configuration across similar organization types.
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Profile type - determines which organizations can use this profile
 */
export const profileTypeEnum = pgEnum('profile_type', [
  'root', // Only for root organizations
  'child', // Only for child organizations
  'universal', // Can be used by any organization
]);

/**
 * Profile capabilities configuration
 */
export interface ProfileCapabilities {
  // Feature flags
  whiteLabeling?: boolean;
  ssoEnabled?: boolean;
  mfaEnabled?: boolean;
  apiAccess?: boolean;
  aiFeatures?: boolean;
  advancedAnalytics?: boolean;
  customIntegrations?: boolean;
  // Hierarchy
  canHaveChildren?: boolean;
  maxChildDepth?: number;
}

/**
 * Profile resource limits
 */
export interface ProfileLimits {
  maxUsers?: number;
  maxDevices?: number;
  maxAssets?: number;
  maxDashboards?: number;
  maxApiKeys?: number;
  maxChildOrganizations?: number;
  dataRetentionDays?: number;
  storageGb?: number;
}

/**
 * Organization profiles table
 */
export const organizationProfiles = pgTable(
  'organization_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),

    // Profile classification
    type: profileTypeEnum('type').notNull().default('universal'),

    // Whether this is a system-defined profile (cannot be deleted)
    isSystem: boolean('is_system').notNull().default(false),

    // Feature capabilities
    capabilities: jsonb('capabilities').$type<ProfileCapabilities>().default({}),

    // Resource limits
    limits: jsonb('limits').$type<ProfileLimits>().default({}),

    // Status
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_organization_profiles_name').on(table.name),
    index('idx_organization_profiles_type').on(table.type),
    index('idx_organization_profiles_active').on(table.isActive),
  ]
);

// Infer types from schema
export type OrganizationProfile = typeof organizationProfiles.$inferSelect;
export type NewOrganizationProfile = typeof organizationProfiles.$inferInsert;
