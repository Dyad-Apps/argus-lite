/**
 * JWT utility functions for access tokens
 * Access tokens expire in 15 minutes
 */

import jwt from 'jsonwebtoken';
import { type UserId, type OrganizationId } from '@argus/shared';

/** Impersonation claims for access tokens */
export interface ImpersonationClaims {
  isImpersonation: true;
  impersonatorId: string;
  sessionId: string;
}

/**
 * Organization context for JWT tokens (ADR-002)
 * Provides multi-tenant context for all authenticated requests
 */
export interface OrganizationContext {
  /**
   * The root organization ID that the user belongs to (data isolation boundary)
   */
  rootOrganizationId: OrganizationId;

  /**
   * The current organization ID that the user is working within
   * This is the active context for the session and can be switched via tenant switching API
   */
  currentOrganizationId: OrganizationId;

  /**
   * All organization IDs that the user has access to within the root organization
   * Used for tenant switching and access validation
   */
  accessibleOrganizationIds: OrganizationId[];
}

/** Access token payload */
export interface AccessTokenPayload {
  sub: UserId;
  email: string;
  type: 'access';

  /**
   * Organization context (ADR-002: Subdomain-Based Root Tenant Identification)
   * Present for all authenticated users
   */
  org?: OrganizationContext;

  impersonation?: ImpersonationClaims;
}

/** Decoded access token with standard JWT claims */
export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

const ACCESS_TOKEN_EXPIRY = '15m';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Signs an access token for a user
 * @param userId - The user ID to include in the token
 * @param email - The user's email
 * @param organizationContext - Organization context (root, current, accessible IDs) per ADR-002
 * @param impersonation - Optional impersonation claims for admin impersonation sessions
 */
export function signAccessToken(
  userId: UserId,
  email: string,
  organizationContext?: OrganizationContext,
  impersonation?: ImpersonationClaims
): string {
  const payload: AccessTokenPayload = {
    sub: userId,
    email,
    type: 'access',
    ...(organizationContext && { org: organizationContext }),
    ...(impersonation && { impersonation }),
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes an access token
 * Returns null if token is invalid or expired
 */
export function verifyAccessToken(token: string): DecodedAccessToken | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as DecodedAccessToken;

    // Ensure it's an access token
    if (decoded.type !== 'access') {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decodes a token without verification (for debugging)
 */
export function decodeToken(token: string): DecodedAccessToken | null {
  try {
    return jwt.decode(token) as DecodedAccessToken | null;
  } catch {
    return null;
  }
}
