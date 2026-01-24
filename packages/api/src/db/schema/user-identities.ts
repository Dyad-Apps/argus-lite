/**
 * User Identities table for SSO account linking
 *
 * Links users to their external identity provider accounts.
 * A user can have multiple identities (e.g., Google + GitHub).
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { identityProviders } from './identity-providers.js';

/**
 * Profile data from identity provider
 */
export interface IdentityProfile {
  email?: string;
  emailVerified?: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  locale?: string;
  [key: string]: unknown;
}

/**
 * User identities table
 */
export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // User this identity belongs to
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Identity provider
    providerId: uuid('provider_id')
      .notNull()
      .references(() => identityProviders.id, { onDelete: 'cascade' }),

    // External identity
    externalId: varchar('external_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),

    // Profile data from provider (refreshed on each login)
    profile: jsonb('profile').$type<IdentityProfile>(),

    // Tokens (encrypted at rest in production)
    accessToken: varchar('access_token', { length: 2000 }),
    refreshToken: varchar('refresh_token', { length: 2000 }),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),

    // Timestamps
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_user_identities_user').on(table.userId),
    index('idx_user_identities_provider').on(table.providerId),
    unique('uq_user_identities_provider_external').on(
      table.providerId,
      table.externalId
    ),
  ]
);

// Infer types from schema
export type UserIdentity = typeof userIdentities.$inferSelect;
export type NewUserIdentity = typeof userIdentities.$inferInsert;
