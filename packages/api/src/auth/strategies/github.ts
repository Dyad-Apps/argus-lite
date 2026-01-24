/**
 * GitHub OAuth2 Strategy
 *
 * Handles GitHub authentication via passport-github2.
 */

import { Strategy as GitHubStrategy, Profile } from 'passport-github2';
import type { SsoProfile } from '../sso-types.js';
import type { SocialConfig } from '../../db/schema/identity-providers.js';

/**
 * Creates a GitHub OAuth2 strategy for a provider
 */
export function createGitHubStrategy(
  providerId: string,
  config: SocialConfig,
  callbackUrl: string
): GitHubStrategy {
  return new GitHubStrategy(
    {
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: callbackUrl,
      scope: config.scopes ?? ['user:email', 'read:user'],
    },
    (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (error: Error | null, user?: unknown) => void
    ) => {
      try {
        const ssoProfile = normalizeGitHubProfile(providerId, profile);
        done(null, { profile: ssoProfile, accessToken, refreshToken });
      } catch (error) {
        done(error as Error);
      }
    }
  );
}

/**
 * Normalizes GitHub profile to common SsoProfile format
 */
export function normalizeGitHubProfile(
  providerId: string,
  profile: Profile
): SsoProfile {
  const email = profile.emails?.[0]?.value;

  if (!email) {
    throw new Error(
      'GitHub profile missing email. Ensure user:email scope is granted.'
    );
  }

  // Parse display name into first/last
  const nameParts = profile.displayName?.split(' ') ?? [];
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || undefined;

  return {
    providerId,
    externalId: profile.id,
    email,
    emailVerified: true, // GitHub verifies emails
    firstName,
    lastName,
    displayName: profile.displayName ?? profile.username,
    avatarUrl: profile.photos?.[0]?.value,
    rawProfile: (profile as unknown as { _json: Record<string, unknown> })._json ?? {},
  };
}
