/**
 * SSO Service
 *
 * Handles user authentication and identity management for SSO providers.
 * Supports account linking, auto-creation, and profile synchronization.
 */

import { db } from '../db/index.js';
import {
  users,
  userIdentities,
  identityProviders,
  type NewUserIdentity,
  type IdentityProfile,
} from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import type { SsoProfile, SsoAuthResult } from './sso-types.js';
import type { UserId } from '@argus/shared';
import { auditService } from '../services/audit.service.js';

/**
 * SSO Service class
 */
class SsoService {
  /**
   * Authenticates a user via SSO profile
   * Handles account linking, creation, and profile updates
   */
  async authenticateWithProfile(profile: SsoProfile): Promise<SsoAuthResult> {
    // Get the identity provider
    const provider = await db.query.identityProviders.findFirst({
      where: eq(identityProviders.id, profile.providerId),
    });

    if (!provider || !provider.enabled) {
      throw new Error('Identity provider not found or disabled');
    }

    // Check domain restrictions
    if (provider.allowedDomains && provider.allowedDomains.length > 0) {
      const emailDomain = profile.email.split('@')[1]?.toLowerCase();
      const allowed = provider.allowedDomains.some(
        (d) => d.toLowerCase() === emailDomain
      );
      if (!allowed) {
        throw new Error('Email domain not allowed for this provider');
      }
    }

    // Try to find existing identity
    const existingIdentity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.providerId, profile.providerId),
        eq(userIdentities.externalId, profile.externalId)
      ),
      with: {
        user: true,
      },
    });

    if (existingIdentity) {
      // Update existing identity with latest profile
      await this.updateIdentityProfile(existingIdentity.id, profile);

      // Update user's last login
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, existingIdentity.userId));

      await auditService.logAuth('sso_login', {
        userId: existingIdentity.userId as UserId,
        userEmail: profile.email,
        outcome: 'success',
        details: {
          providerId: profile.providerId,
          providerType: provider.type,
        },
      });

      return {
        user: {
          id: existingIdentity.userId as UserId,
          email: existingIdentity.user.email,
          firstName: existingIdentity.user.firstName,
          lastName: existingIdentity.user.lastName,
        },
        isNewUser: false,
        linkedIdentity: false,
      };
    }

    // Try to link to existing user by email
    if (provider.autoLinkUsers && profile.email) {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, profile.email.toLowerCase()),
      });

      if (existingUser) {
        // Link identity to existing user
        await this.createIdentity(existingUser.id, profile);

        // Update user's last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, existingUser.id));

        await auditService.logAuth('sso_login_linked', {
          userId: existingUser.id as UserId,
          userEmail: profile.email,
          outcome: 'success',
          details: {
            providerId: profile.providerId,
            providerType: provider.type,
          },
        });

        return {
          user: {
            id: existingUser.id as UserId,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
          },
          isNewUser: false,
          linkedIdentity: true,
        };
      }
    }

    // Create new user if allowed
    if (!provider.autoCreateUsers) {
      throw new Error('User not found and auto-creation is disabled');
    }

    // ADR-002: SSO users need organization context from the provider
    if (!provider.organizationId) {
      throw new Error('Organization context required for user creation');
    }

    const newUser = await this.createUserFromProfile(profile, provider.organizationId);

    await auditService.logAuth('sso_register', {
      userId: newUser.id as UserId,
      userEmail: profile.email,
      outcome: 'success',
      details: {
        providerId: profile.providerId,
        providerType: provider.type,
      },
    });

    return {
      user: newUser,
      isNewUser: true,
      linkedIdentity: false,
    };
  }

  /**
   * Creates a new user from SSO profile
   * ADR-002: Users must have organization context
   */
  private async createUserFromProfile(
    profile: SsoProfile,
    organizationId: string
  ): Promise<SsoAuthResult['user']> {
    const [user] = await db
      .insert(users)
      .values({
        email: profile.email.toLowerCase(),
        // SSO users don't have passwords (null instead of empty string)
        passwordHash: null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
        lastLoginAt: new Date(),
        // ADR-002: Organization context required
        rootOrganizationId: organizationId,
        primaryOrganizationId: organizationId,
      })
      .returning();

    // Create the identity link
    await this.createIdentity(user.id, profile);

    return {
      id: user.id as UserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  /**
   * Creates an identity link for a user
   */
  private async createIdentity(
    userId: string,
    profile: SsoProfile
  ): Promise<void> {
    const identityProfile: IdentityProfile = {
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.displayName,
      givenName: profile.firstName,
      familyName: profile.lastName,
      picture: profile.avatarUrl,
      ...profile.rawProfile,
    };

    const values: NewUserIdentity = {
      userId,
      providerId: profile.providerId,
      externalId: profile.externalId,
      email: profile.email,
      profile: identityProfile,
      lastUsedAt: new Date(),
    };

    await db.insert(userIdentities).values(values);
  }

  /**
   * Updates identity profile data
   */
  private async updateIdentityProfile(
    identityId: string,
    profile: SsoProfile
  ): Promise<void> {
    const identityProfile: IdentityProfile = {
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.displayName,
      givenName: profile.firstName,
      familyName: profile.lastName,
      picture: profile.avatarUrl,
      ...profile.rawProfile,
    };

    await db
      .update(userIdentities)
      .set({
        email: profile.email,
        profile: identityProfile,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userIdentities.id, identityId));
  }

  /**
   * Gets all identity providers for an organization
   */
  async getProvidersForOrganization(organizationId?: string) {
    // Get org-specific providers plus global providers (null org)
    const providers = await db.query.identityProviders.findMany({
      where: organizationId
        ? eq(identityProviders.organizationId, organizationId)
        : undefined,
    });

    // Return only public info (no secrets)
    return providers
      .filter((p) => p.enabled)
      .map((p) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        displayName: p.displayName,
      }));
  }

  /**
   * Gets a provider by ID with full config (internal use only)
   */
  async getProviderById(providerId: string) {
    return db.query.identityProviders.findFirst({
      where: eq(identityProviders.id, providerId),
    });
  }

  /**
   * Gets user identities for a user
   */
  async getUserIdentities(userId: string) {
    const identities = await db.query.userIdentities.findMany({
      where: eq(userIdentities.userId, userId),
      with: {
        provider: true,
      },
    });

    return identities.map((i) => ({
      id: i.id,
      providerType: i.provider.type,
      providerName: i.provider.name,
      email: i.email,
      lastUsedAt: i.lastUsedAt,
      createdAt: i.createdAt,
    }));
  }

  /**
   * Unlinks an identity from a user
   */
  async unlinkIdentity(userId: string, identityId: string): Promise<void> {
    // Ensure user has at least one other auth method
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const identities = await db.query.userIdentities.findMany({
      where: eq(userIdentities.userId, userId),
    });

    const hasPassword = user.passwordHash && user.passwordHash.length > 0;

    if (identities.length <= 1 && !hasPassword) {
      throw new Error(
        'Cannot unlink the only authentication method. Set a password first.'
      );
    }

    await db
      .delete(userIdentities)
      .where(
        and(
          eq(userIdentities.id, identityId),
          eq(userIdentities.userId, userId)
        )
      );

    await auditService.logUserManagement('identity_unlinked', userId, {
      identityId,
    });
  }
}

// Singleton instance
export const ssoService = new SsoService();
