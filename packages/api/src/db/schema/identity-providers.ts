/**
 * Identity Providers table for SSO configuration
 *
 * Stores SSO provider configurations at the organization level.
 * Supports OIDC, SAML 2.0, and social login providers.
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { identityProviderTypeEnum } from './enums.js';

/**
 * OIDC provider configuration
 */
export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: string[];
}

/**
 * SAML provider configuration
 */
export interface SamlConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  privateKey?: string;
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  digestAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  wantAssertionsSigned?: boolean;
  wantAuthnResponseSigned?: boolean;
}

/**
 * Social provider configuration (Google, GitHub, Microsoft)
 */
export interface SocialConfig {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

export type ProviderConfig = OidcConfig | SamlConfig | SocialConfig;

/**
 * Identity providers table
 */
export const identityProviders = pgTable(
  'identity_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Organization this provider belongs to (null = global/social)
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    // Provider identification
    type: identityProviderTypeEnum('type').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),

    // Provider configuration (encrypted at rest in production)
    config: jsonb('config').$type<ProviderConfig>().notNull(),

    // Domain restrictions (e.g., ["company.com"] for email domain matching)
    allowedDomains: jsonb('allowed_domains').$type<string[]>(),

    // Feature flags
    enabled: boolean('enabled').notNull().default(true),
    autoCreateUsers: boolean('auto_create_users').notNull().default(false),
    autoLinkUsers: boolean('auto_link_users').notNull().default(true),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_identity_providers_org').on(table.organizationId),
    index('idx_identity_providers_type').on(table.type),
    unique('uq_identity_providers_org_name').on(table.organizationId, table.name),
  ]
);

// Infer types from schema
export type IdentityProvider = typeof identityProviders.$inferSelect;
export type NewIdentityProvider = typeof identityProviders.$inferInsert;
