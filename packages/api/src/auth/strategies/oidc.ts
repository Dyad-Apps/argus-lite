/**
 * Generic OIDC Strategy
 *
 * Handles OpenID Connect authentication for enterprise providers
 * like Okta, Auth0, Azure AD, etc.
 */

import * as client from 'openid-client';
import type { SsoProfile } from '../sso-types.js';
import type { OidcConfig } from '../../db/schema/identity-providers.js';

/**
 * OIDC client cache to avoid re-discovery on every request
 */
const clientCache = new Map<string, client.Configuration>();

/**
 * Gets or creates an OIDC client configuration
 */
export async function getOidcClient(
  providerId: string,
  config: OidcConfig
): Promise<client.Configuration> {
  const cached = clientCache.get(providerId);
  if (cached) {
    return cached;
  }

  const issuerUrl = new URL(config.issuer);

  // Discover OIDC configuration
  const oidcConfig = await client.discovery(issuerUrl, config.clientId, config.clientSecret);

  clientCache.set(providerId, oidcConfig);
  return oidcConfig;
}

/**
 * Generates authorization URL for OIDC provider
 */
export async function getOidcAuthUrl(
  providerId: string,
  config: OidcConfig,
  callbackUrl: string,
  state: string,
  nonce: string
): Promise<string> {
  const oidcConfig = await getOidcClient(providerId, config);
  const scopes = config.scopes ?? ['openid', 'email', 'profile'];

  const params = new URLSearchParams({
    redirect_uri: callbackUrl,
    scope: scopes.join(' '),
    state,
    nonce,
    response_type: 'code',
  });

  return client.buildAuthorizationUrl(oidcConfig, params).href;
}

/**
 * Exchanges authorization code for tokens and user info
 */
export async function handleOidcCallback(
  providerId: string,
  config: OidcConfig,
  callbackUrl: string,
  code: string,
  expectedState: string,
  expectedNonce: string
): Promise<SsoProfile> {
  const oidcConfig = await getOidcClient(providerId, config);

  // Exchange code for tokens
  const currentUrl = new URL(callbackUrl);
  currentUrl.searchParams.set('code', code);
  currentUrl.searchParams.set('state', expectedState);

  const tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
    expectedState,
    expectedNonce,
  });

  // Get user info
  const claims = tokens.claims();

  if (!claims) {
    throw new Error('Failed to get user claims from OIDC provider');
  }

  const email = claims.email as string | undefined;
  if (!email) {
    throw new Error('OIDC provider did not return email claim');
  }

  return {
    providerId,
    externalId: claims.sub,
    email,
    emailVerified: claims.email_verified as boolean | undefined,
    firstName: claims.given_name as string | undefined,
    lastName: claims.family_name as string | undefined,
    displayName: claims.name as string | undefined,
    avatarUrl: claims.picture as string | undefined,
    rawProfile: claims as Record<string, unknown>,
  };
}

/**
 * Clears cached OIDC client (call when provider config changes)
 */
export function clearOidcClientCache(providerId?: string): void {
  if (providerId) {
    clientCache.delete(providerId);
  } else {
    clientCache.clear();
  }
}
