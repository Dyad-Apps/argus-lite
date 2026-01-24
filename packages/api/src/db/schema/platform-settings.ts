import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { systemRoleEnum } from './enums.js';

/**
 * Platform-level settings managed by System Admins.
 * Key-value store for global configuration.
 */
export const platformSettings = pgTable('platform_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  isSecret: boolean('is_secret').notNull().default(false), // Mask in UI
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * System administrators with platform-wide access.
 * Separate from organization-level admins.
 */
export const systemAdmins = pgTable('system_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: systemRoleEnum('role').notNull().default('support'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

/**
 * Platform default branding (fallback when org has no custom branding).
 */
export const platformBranding = pgTable('platform_branding', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Default logo and favicon
  logoUrl: text('logo_url'),
  logoDarkUrl: text('logo_dark_url'),
  faviconUrl: text('favicon_url'),

  // Default colors
  primaryColor: varchar('primary_color', { length: 7 }).default('#1890FF'),
  accentColor: varchar('accent_color', { length: 7 }),

  // Default login page
  loginBackgroundType: varchar('login_background_type', { length: 20 })
    .notNull()
    .default('particles'),
  loginBackgroundUrl: text('login_background_url'),
  loginWelcomeText: varchar('login_welcome_text', { length: 100 })
    .default('Welcome'),
  loginSubtitle: varchar('login_subtitle', { length: 200 })
    .default('Sign in to your account'),

  // Legal links
  termsOfServiceUrl: text('terms_of_service_url'),
  privacyPolicyUrl: text('privacy_policy_url'),
  supportUrl: text('support_url'),

  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

/**
 * Common platform setting keys
 */
export const PLATFORM_SETTING_KEYS = {
  // Security
  PASSWORD_MIN_LENGTH: 'security.password_min_length',
  PASSWORD_REQUIRE_UPPERCASE: 'security.password_require_uppercase',
  PASSWORD_REQUIRE_NUMBER: 'security.password_require_number',
  PASSWORD_REQUIRE_SPECIAL: 'security.password_require_special',
  SESSION_TIMEOUT_MINUTES: 'security.session_timeout_minutes',
  MFA_ENABLED: 'security.mfa_enabled',

  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: 'rate_limit.requests_per_minute',
  RATE_LIMIT_LOGIN_ATTEMPTS: 'rate_limit.login_attempts',

  // Features
  SELF_REGISTRATION_ENABLED: 'features.self_registration_enabled',
  SOCIAL_LOGIN_ENABLED: 'features.social_login_enabled',

  // Email
  EMAIL_FROM_ADDRESS: 'email.from_address',
  EMAIL_FROM_NAME: 'email.from_name',
} as const;

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type NewPlatformSetting = typeof platformSettings.$inferInsert;
export type SystemAdmin = typeof systemAdmins.$inferSelect;
export type NewSystemAdmin = typeof systemAdmins.$inferInsert;
export type PlatformBrandingType = typeof platformBranding.$inferSelect;
