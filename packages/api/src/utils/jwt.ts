/**
 * JWT utility functions for access tokens
 * Access tokens expire in 15 minutes
 */

import jwt from 'jsonwebtoken';
import { type UserId } from '@argus/shared';

/** Impersonation claims for access tokens */
export interface ImpersonationClaims {
  isImpersonation: true;
  impersonatorId: string;
  sessionId: string;
}

/** Access token payload */
export interface AccessTokenPayload {
  sub: UserId;
  email: string;
  type: 'access';
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
 * @param impersonation - Optional impersonation claims for admin impersonation sessions
 */
export function signAccessToken(
  userId: UserId,
  email: string,
  impersonation?: ImpersonationClaims
): string {
  const payload: AccessTokenPayload = {
    sub: userId,
    email,
    type: 'access',
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
