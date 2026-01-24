/**
 * Google OAuth2 Strategy
 *
 * Handles Google authentication via passport-google-oauth20.
 */

import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import type { SsoProfile } from '../sso-types.js';
import type { SocialConfig } from '../../db/schema/identity-providers.js';

/**
 * Creates a Google OAuth2 strategy for a provider
 */
export function createGoogleStrategy(
  providerId: string,
  config: SocialConfig,
  callbackUrl: string
): GoogleStrategy {
  return new GoogleStrategy(
    {
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: callbackUrl,
      scope: config.scopes ?? ['openid', 'email', 'profile'],
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const ssoProfile = normalizeGoogleProfile(providerId, profile);
        done(null, { profile: ssoProfile, accessToken, refreshToken });
      } catch (error) {
        done(error as Error);
      }
    }
  );
}

/**
 * Normalizes Google profile to common SsoProfile format
 */
export function normalizeGoogleProfile(
  providerId: string,
  profile: Profile
): SsoProfile {
  const email = profile.emails?.[0]?.value;

  if (!email) {
    throw new Error('Google profile missing email');
  }

  // verified can be boolean or string depending on version
  const verified = profile.emails?.[0]?.verified as boolean | string | undefined;
  const emailVerified = verified === true || String(verified) === 'true';

  return {
    providerId,
    externalId: profile.id,
    email,
    emailVerified,
    firstName: profile.name?.givenName,
    lastName: profile.name?.familyName,
    displayName: profile.displayName,
    avatarUrl: profile.photos?.[0]?.value,
    rawProfile: profile._json as Record<string, unknown>,
  };
}
