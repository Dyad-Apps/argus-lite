/**
 * SAML 2.0 Strategy
 *
 * Handles SAML authentication for enterprise SSO providers.
 * Uses passport-saml for SAML protocol handling.
 */

import type { SsoProfile } from '../sso-types.js';
import type { SamlConfig } from '../../db/schema/identity-providers.js';

/**
 * SAML profile from IdP assertion
 */
export interface SamlProfile {
  nameID?: string;
  nameIDFormat?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  [key: string]: unknown;
}

/**
 * SAML strategy options for passport-saml
 */
export interface SamlStrategyOptions {
  entryPoint: string;
  issuer: string;
  cert: string;
  privateKey?: string;
  callbackUrl: string;
  signatureAlgorithm: 'sha1' | 'sha256' | 'sha512';
  digestAlgorithm: 'sha1' | 'sha256' | 'sha512';
  wantAssertionsSigned: boolean;
  wantAuthnResponseSigned: boolean;
  identifierFormat: string;
  acceptedClockSkewMs: number;
}

/**
 * Creates SAML strategy options from config
 */
export function createSamlStrategy(
  _providerId: string,
  config: SamlConfig,
  callbackUrl: string,
  issuer: string
): SamlStrategyOptions {
  return {
    entryPoint: config.entryPoint,
    issuer: issuer,
    cert: config.cert,
    privateKey: config.privateKey,
    callbackUrl: callbackUrl,
    signatureAlgorithm: config.signatureAlgorithm ?? 'sha256',
    digestAlgorithm: config.digestAlgorithm ?? 'sha256',
    wantAssertionsSigned: config.wantAssertionsSigned ?? true,
    wantAuthnResponseSigned: config.wantAuthnResponseSigned ?? false,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    acceptedClockSkewMs: 5000,
  };
}

/**
 * Normalizes SAML profile to common SsoProfile format
 */
export function normalizeSamlProfile(
  providerId: string,
  profile: SamlProfile
): SsoProfile {
  // SAML attributes can be in various locations depending on IdP
  const email =
    profile.email ??
    profile.nameID ??
    (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as string | undefined);

  if (!email) {
    throw new Error('SAML profile missing email');
  }

  const firstName =
    profile.firstName ??
    (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] as string | undefined);

  const lastName =
    profile.lastName ??
    (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] as string | undefined);

  const displayName =
    profile.displayName ??
    (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string | undefined);

  return {
    providerId,
    externalId: profile.nameID ?? email,
    email,
    emailVerified: true, // SAML implies verified
    firstName,
    lastName,
    displayName,
    avatarUrl: undefined, // SAML doesn't typically include avatar
    rawProfile: profile as Record<string, unknown>,
  };
}

/**
 * Generates SAML metadata XML for Service Provider
 * This can be provided to IdPs for configuration
 */
export function generateSpMetadata(
  options: SamlStrategyOptions,
  _signingCert?: string
): string {
  const entityId = options.issuer;
  const acsUrl = options.callbackUrl;

  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="${options.wantAssertionsSigned}" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>${options.identifierFormat}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}
