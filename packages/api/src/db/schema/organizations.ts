import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
  jsonb,
  text,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizationPlanEnum, loginBackgroundTypeEnum } from './enums.js';
import { tenantProfiles } from './tenant-profiles.js';

/**
 * Organizations in the multi-organization system.
 * Supports unlimited recursive organization hierarchies per ADR-001.
 *
 * Key concepts:
 * - Root organizations: Top-level orgs identified by subdomain (is_root = true)
 * - Child organizations: Can be nested to unlimited depth under root
 * - LTREE path: Enables efficient ancestor/descendant queries
 * - org_code: Human-readable identifier for tenant switching (NOT for login)
 *
 * @see ADR-001: Multi-Tenant Model with Unlimited Recursive Trees
 * @see ADR-002: Subdomain-Based Root Organization Identification
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),

    // Human-readable code for tenant switching (e.g., "WALMART", "REGION-NE")
    // Used in UI dropdowns and tenant switching API, NOT for login
    orgCode: varchar('org_code', { length: 50 }).notNull(),

    // === Hierarchy Fields (ADR-001) ===

    // Self-referential parent for tree structure
    parentOrganizationId: uuid('parent_organization_id').references(
      (): any => organizations.id,
      { onDelete: 'restrict' }
    ),

    // Root organization reference (for data isolation)
    // All data queries must filter by root_organization_id
    rootOrganizationId: uuid('root_organization_id').references(
      (): any => organizations.id,
      { onDelete: 'restrict' }
    ),

    // Whether this is a root organization (top of hierarchy)
    isRoot: boolean('is_root').notNull().default(false),

    // LTREE path for efficient tree queries (e.g., 'radio.walmart.northeast')
    // Requires PostgreSQL LTREE extension
    path: text('path'),

    // Depth in hierarchy (0 for root, 1 for first-level children, etc.)
    depth: integer('depth').notNull().default(0),

    // Whether this org can create child organizations
    canHaveChildren: boolean('can_have_children').notNull().default(false),

    // === White-Label Fields (ADR-002) ===

    // Subdomain for root organizations only (e.g., 'acme' for acme.argusiq.com)
    // Must be NULL for non-root organizations
    subdomain: varchar('subdomain', { length: 63 }).unique(),

    // === Common Fields ===

    // Optional description for the organization
    description: varchar('description', { length: 1000 }),

    // Tenant profile assignment (defines capabilities and limits)
    profileId: uuid('profile_id').references(() => tenantProfiles.id, {
      onDelete: 'set null',
    }),

    // Plan/tier determines feature availability
    plan: organizationPlanEnum('plan').notNull().default('free'),

    // Organization status
    isActive: boolean('is_active').notNull().default(true),

    // Settings stored as JSON
    settings: jsonb('settings').$type<OrganizationSettings>(),

    // Override limits from the profile for this specific organization
    quotaOverrides: jsonb('quota_overrides').$type<QuotaOverrides>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_organizations_slug').on(table.slug),
    index('idx_organizations_subdomain').on(table.subdomain),
    index('idx_organizations_parent').on(table.parentOrganizationId),
    index('idx_organizations_root').on(table.rootOrganizationId),
    index('idx_organizations_org_code').on(table.orgCode),
    index('idx_organizations_profile').on(table.profileId),
    // org_code unique within root organization
    uniqueIndex('idx_organizations_org_code_root').on(
      table.orgCode,
      table.rootOrganizationId
    ),
    // LTREE path index (requires ltree extension)
    // Note: GiST index for LTREE created via raw migration
  ]
);

/**
 * Quota overrides - override limits from the tenant profile
 */
export interface QuotaOverrides {
  maxUsers?: number;
  maxDevices?: number;
  maxAssets?: number;
  maxChildOrganizations?: number;
  dataRetentionDays?: number;
  storageGb?: number;
}

/**
 * Organization settings JSON structure
 */
export interface OrganizationSettings {
  timezone?: string;
  locale?: string;
  dateFormat?: string;
  features?: {
    ssoRequired?: boolean;
    mfaRequired?: boolean;
    apiAccess?: boolean;
    crossOrgSharing?: boolean; // Allow sharing assets with other orgs
    allowWhiteLabeling?: boolean; // Allow org to customize branding
    allowImpersonation?: boolean; // Allow platform admins to impersonate users
  };
  capabilities?: {
    maxUsers?: number;
    maxChildOrganizations?: number;
    maxStorageGb?: number;
  };
}

/**
 * Organization branding configuration for white-labeling.
 */
export const organizationBranding = pgTable('organization_branding', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Logo and favicon
  logoUrl: text('logo_url'),
  logoDarkUrl: text('logo_dark_url'),  // For dark mode
  faviconUrl: text('favicon_url'),

  // Colors
  primaryColor: varchar('primary_color', { length: 7 }),  // Hex: #1890FF
  accentColor: varchar('accent_color', { length: 7 }),

  // Login page customization
  loginBackgroundType: loginBackgroundTypeEnum('login_background_type')
    .notNull()
    .default('default'),
  loginBackgroundUrl: text('login_background_url'),
  loginBackgroundColor: varchar('login_background_color', { length: 7 }),
  loginWelcomeText: varchar('login_welcome_text', { length: 100 }),
  loginSubtitle: varchar('login_subtitle', { length: 200 }),

  // Advanced customization (enterprise only)
  customCss: text('custom_css'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OrganizationBranding = typeof organizationBranding.$inferSelect;
export type NewOrganizationBranding = typeof organizationBranding.$inferInsert;

/**
 * Projects within an organization.
 * Optional subdivision for larger organizations.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_projects_org').on(table.organizationId),
  ]
);

// Infer types from schema
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
