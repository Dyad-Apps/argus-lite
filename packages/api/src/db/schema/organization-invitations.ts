/**
 * Organization invitations table
 * Allows inviting users to join an organization via email
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { organizationRoleEnum } from './enums.js';

/**
 * Invitation status enum
 */
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
  'cancelled',
]);

/**
 * Organization invitations table
 * - Invitations are sent to an email address
 * - Can be accepted by matching email user
 * - Expire after 7 days
 */
export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: organizationRoleEnum('role').notNull().default('member'),
    status: invitationStatusEnum('status').notNull().default('pending'),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedBy: uuid('accepted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_org_invitations_org_id').on(table.organizationId),
    index('idx_org_invitations_email').on(table.email),
    index('idx_org_invitations_token').on(table.tokenHash),
    index('idx_org_invitations_status').on(table.status),
  ]
);

// Infer types from schema
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
export type NewOrganizationInvitation = typeof organizationInvitations.$inferInsert;
