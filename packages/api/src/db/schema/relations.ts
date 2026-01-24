/**
 * Drizzle ORM Relations
 *
 * Defines relationships between tables for relational queries (with clause).
 */

import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { userIdentities } from './user-identities.js';
import { identityProviders } from './identity-providers.js';
import { organizations } from './organizations.js';
import { userOrganizations } from './user-organizations.js';
import { organizationInvitations } from './organization-invitations.js';
import { refreshTokens } from './refresh-tokens.js';
import { passwordResetTokens } from './password-reset-tokens.js';
import { auditLogs } from './audit-logs.js';

/**
 * User relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  identities: many(userIdentities),
  organizations: many(userOrganizations),
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
  auditLogs: many(auditLogs),
}));

/**
 * User identity relations
 */
export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userIdentities.userId],
    references: [users.id],
  }),
  provider: one(identityProviders, {
    fields: [userIdentities.providerId],
    references: [identityProviders.id],
  }),
}));

/**
 * Identity provider relations
 */
export const identityProvidersRelations = relations(
  identityProviders,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [identityProviders.organizationId],
      references: [organizations.id],
    }),
    identities: many(userIdentities),
  })
);

/**
 * Organization relations
 */
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(userOrganizations),
  invitations: many(organizationInvitations),
  identityProviders: many(identityProviders),
  auditLogs: many(auditLogs),
}));

/**
 * User-Organization junction relations
 */
export const userOrganizationsRelations = relations(
  userOrganizations,
  ({ one }) => ({
    user: one(users, {
      fields: [userOrganizations.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [userOrganizations.organizationId],
      references: [organizations.id],
    }),
    inviter: one(users, {
      fields: [userOrganizations.invitedBy],
      references: [users.id],
    }),
  })
);

/**
 * Organization invitation relations
 */
export const organizationInvitationsRelations = relations(
  organizationInvitations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvitations.organizationId],
      references: [organizations.id],
    }),
    inviter: one(users, {
      fields: [organizationInvitations.invitedBy],
      references: [users.id],
    }),
  })
);

/**
 * Refresh token relations
 */
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

/**
 * Password reset token relations
 */
export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  })
);

/**
 * Audit log relations
 */
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
}));
