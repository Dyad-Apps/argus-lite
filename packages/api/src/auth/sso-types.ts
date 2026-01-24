/**
 * SSO Type Definitions
 *
 * Shared types for SSO authentication across all providers.
 */

import type { UserId } from '@argus/shared';

/**
 * Normalized user profile from any identity provider
 */
export interface SsoProfile {
  providerId: string;
  externalId: string;
  email: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  rawProfile: Record<string, unknown>;
}

/**
 * SSO authentication result
 */
export interface SsoAuthResult {
  user: {
    id: UserId;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  isNewUser: boolean;
  linkedIdentity: boolean;
}

/**
 * Provider callback parameters
 */
export interface OAuthCallbackParams {
  code: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export interface SamlCallbackParams {
  SAMLResponse: string;
  RelayState?: string;
}

/**
 * SSO session state (stored in secure session)
 */
export interface SsoSessionState {
  providerId: string;
  returnUrl?: string;
  organizationId?: string;
  nonce?: string;
}
