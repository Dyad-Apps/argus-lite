/**
 * Password reset tokens table
 * Stores short-lived tokens for password reset flow
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Password reset tokens table
 * - Tokens expire after 1 hour
 * - Only one active token per user
 * - Token is marked used after successful reset
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_password_reset_tokens_user_id').on(table.userId),
    index('idx_password_reset_tokens_token_hash').on(table.tokenHash),
    index('idx_password_reset_tokens_expires_at').on(table.expiresAt),
  ]
);

// Infer types from schema
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
