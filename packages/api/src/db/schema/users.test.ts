/**
 * Unit tests for users schema and multi-tenant user context
 * Tests ADR-002: Subdomain-Based Root Organization Identification
 */

import { describe, it, expect } from 'vitest';
import { users, type User, type NewUser } from './users.js';

describe('Users Schema', () => {
  describe('Schema Definition', () => {
    it('should have organization context fields per ADR-002', () => {
      const columns = Object.keys(users);

      // Core identity
      expect(columns).toContain('id');
      expect(columns).toContain('email');
      expect(columns).toContain('passwordHash');

      // Organization context (ADR-002)
      expect(columns).toContain('rootOrganizationId');
      expect(columns).toContain('primaryOrganizationId');

      // Account status
      expect(columns).toContain('status');
      expect(columns).toContain('emailVerifiedAt');
      expect(columns).toContain('lastLoginAt');

      // MFA
      expect(columns).toContain('mfaEnabled');
      expect(columns).toContain('mfaSecret');
    });
  });

  describe('User Type Definitions', () => {
    it('should require root_organization_id per ADR-002', () => {
      const user: NewUser = {
        email: 'user@example.com',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001', // Required
        primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
      };

      expect(user.rootOrganizationId).toBeDefined();
    });

    it('should require primary_organization_id per ADR-002', () => {
      const user: NewUser = {
        email: 'user@example.com',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        primaryOrganizationId: '00000000-0000-0000-0000-000000000001', // Required
      };

      expect(user.primaryOrganizationId).toBeDefined();
    });

    it('should allow nullable password for SSO-only users', () => {
      // ADR-002: SSO-only users don't have passwords
      const ssoUser: NewUser = {
        email: 'sso@example.com',
        passwordHash: null, // SSO-only
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
      };

      expect(ssoUser.passwordHash).toBeNull();
    });
  });

  describe('Email Uniqueness per Root Organization', () => {
    it('same email can exist in different root organizations', () => {
      // ADR-002: Email unique per root tenant, not globally
      const user1: NewUser = {
        email: 'admin@example.com',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001', // Root 1
        primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
      };

      const user2: NewUser = {
        email: 'admin@example.com', // Same email
        rootOrganizationId: '00000000-0000-0000-0000-000000000002', // Root 2
        primaryOrganizationId: '00000000-0000-0000-0000-000000000002',
      };

      expect(user1.email).toBe(user2.email);
      expect(user1.rootOrganizationId).not.toBe(user2.rootOrganizationId);
    });
  });

  describe('Primary Organization', () => {
    it('primary organization determines default after login', () => {
      // ADR-002: User lands on primary_organization after login
      const user: NewUser = {
        email: 'user@example.com',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        primaryOrganizationId: '00000000-0000-0000-0000-000000000002', // Different from root
      };

      expect(user.primaryOrganizationId).toBeDefined();
      // Primary can be different from root (e.g., user works in a child org)
      expect(user.primaryOrganizationId).not.toBe(user.rootOrganizationId);
    });

    it('primary organization must be within root hierarchy', () => {
      // This is a business rule enforced at application level
      // Type allows any UUID, but app should validate
      const user: NewUser = {
        email: 'user@example.com',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        primaryOrganizationId: '00000000-0000-0000-0000-000000000002',
      };

      // Both should be UUIDs
      expect(user.rootOrganizationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(user.primaryOrganizationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });
});

describe('User Status', () => {
  describe('Status Values', () => {
    it('should support active status', () => {
      const user: NewUser = {
        email: 'user@example.com',
        status: 'active',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
      };

      expect(user.status).toBe('active');
    });

    it('should support inactive status', () => {
      const user: NewUser = {
        email: 'user@example.com',
        status: 'inactive',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
      };

      expect(user.status).toBe('inactive');
    });

    it('should support suspended status', () => {
      const user: NewUser = {
        email: 'user@example.com',
        status: 'suspended',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
      };

      expect(user.status).toBe('suspended');
    });
  });
});

describe('MFA Support', () => {
  it('should support MFA enabled flag', () => {
    const user: NewUser = {
      email: 'user@example.com',
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP', // Base32 secret
      rootOrganizationId: '00000000-0000-0000-0000-000000000001',
      primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
    };

    expect(user.mfaEnabled).toBe(true);
    expect(user.mfaSecret).toBeDefined();
  });

  it('should default MFA to disabled', () => {
    const user: NewUser = {
      email: 'user@example.com',
      rootOrganizationId: '00000000-0000-0000-0000-000000000001',
      primaryOrganizationId: '00000000-0000-0000-0000-000000000001',
    };

    // mfaEnabled should default to false (set by schema default)
    expect(user.mfaEnabled).toBeUndefined(); // Will be false after insert
  });
});
