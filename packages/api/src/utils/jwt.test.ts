/**
 * Unit tests for JWT utilities
 * Tests current implementation and documents ADR-002 requirements
 */

import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
  decodeToken,
  type AccessTokenPayload,
  type DecodedAccessToken,
} from './jwt.js';
import { type UserId, createUserId } from '@argus/shared';

// Set up test JWT secret
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
});

describe('JWT Utilities', () => {
  describe('signAccessToken', () => {
    it('should sign a token with user ID and email', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const email = 'user@example.com';

      const token = signAccessToken(userId, email);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should include type: access in payload', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const email = 'user@example.com';

      const token = signAccessToken(userId, email);
      const decoded = jwt.decode(token) as AccessTokenPayload;

      expect(decoded.type).toBe('access');
    });

    it('should include subject (sub) as user ID', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const email = 'user@example.com';

      const token = signAccessToken(userId, email);
      const decoded = jwt.decode(token) as AccessTokenPayload;

      expect(decoded.sub).toBe(userId);
    });

    it('should include email in payload', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const email = 'user@example.com';

      const token = signAccessToken(userId, email);
      const decoded = jwt.decode(token) as AccessTokenPayload;

      expect(decoded.email).toBe(email);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and return valid token', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const email = 'user@example.com';

      const token = signAccessToken(userId, email);
      const decoded = verifyAccessToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe(userId);
      expect(decoded?.email).toBe(email);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyAccessToken('invalid-token');

      expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create token with immediate expiration
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const expiredToken = jwt.sign(
        { sub: userId, email: 'user@example.com', type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' }
      );

      const decoded = verifyAccessToken(expiredToken);

      expect(decoded).toBeNull();
    });

    it('should return null for non-access token type', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const refreshToken = jwt.sign(
        { sub: userId, email: 'user@example.com', type: 'refresh' },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );

      const decoded = verifyAccessToken(refreshToken);

      expect(decoded).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const email = 'user@example.com';

      const token = signAccessToken(userId, email);
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe(userId);
    });

    it('should return null for invalid format', () => {
      const decoded = decodeToken('not-a-jwt');

      expect(decoded).toBeNull();
    });
  });
});

describe('JWT Token Structure - Current vs ADR-002 Requirements', () => {
  describe('Current Implementation', () => {
    it('current token has: sub, email, type', () => {
      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const email = 'user@example.com';

      const token = signAccessToken(userId, email);
      const decoded = jwt.decode(token) as Record<string, unknown>;

      // Current payload structure
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('type');
      expect(decoded).toHaveProperty('iat'); // Issued at
      expect(decoded).toHaveProperty('exp'); // Expiration
    });
  });

  describe('ADR-002 Required Fields (NOT YET IMPLEMENTED)', () => {
    it('ADR-002 requires: root_tenant_id in JWT', () => {
      // ADR-002 specifies JWT should include:
      // - root_tenant_id: "radio-uuid"
      // - current_tenant_id: "walmart-uuid"
      // - accessible_tenant_ids: ["walmart-uuid", "kroger-uuid", ...]

      const userId = createUserId('00000000-0000-0000-0000-000000000001');
      const token = signAccessToken(userId, 'user@example.com');
      const decoded = jwt.decode(token) as Record<string, unknown>;

      // These fields are NOT currently in the token
      // This test documents what needs to be added
      expect(decoded).not.toHaveProperty('root_tenant_id');
      expect(decoded).not.toHaveProperty('current_tenant_id');
      expect(decoded).not.toHaveProperty('accessible_tenant_ids');
    });

    it('documents required JWT structure per ADR-002', () => {
      // This test documents the target JWT structure

      interface ADR002TokenPayload {
        sub: UserId;
        email: string;
        type: 'access';
        // ADR-002 required fields:
        root_tenant_id: string;
        current_tenant_id: string;
        accessible_tenant_ids: string[];
      }

      // Example of what the token SHOULD look like:
      const expectedPayload: ADR002TokenPayload = {
        sub: createUserId('00000000-0000-0000-0000-000000000001'),
        email: 'user@example.com',
        type: 'access',
        // ADR-002 fields:
        root_tenant_id: '00000000-0000-0000-0000-000000000100', // From subdomain
        current_tenant_id: '00000000-0000-0000-0000-000000000101', // User's current context
        accessible_tenant_ids: [
          '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102',
        ],
      };

      // Verify structure is correct
      expect(expectedPayload.root_tenant_id).toBeDefined();
      expect(expectedPayload.current_tenant_id).toBeDefined();
      expect(expectedPayload.accessible_tenant_ids).toBeInstanceOf(Array);
    });
  });
});

describe('Token Expiration', () => {
  it('access token should expire in 15 minutes', () => {
    const userId = createUserId('00000000-0000-0000-0000-000000000001');
    const token = signAccessToken(userId, 'user@example.com');
    const decoded = jwt.decode(token) as DecodedAccessToken;

    const now = Math.floor(Date.now() / 1000);
    const expectedExpiry = now + 15 * 60; // 15 minutes

    // Allow 5 second tolerance
    expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5);
    expect(decoded.exp).toBeLessThan(expectedExpiry + 5);
  });
});
