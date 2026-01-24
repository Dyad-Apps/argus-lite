/**
 * Unit tests for user-organizations junction table
 * Tests ADR-001: Multi-Tenant Model - User access to multiple organizations
 * Tests ADR-002: Subdomain-Based Routing - Tenant context switching
 */

import { describe, it, expect } from 'vitest';
import { userOrganizations, type UserOrganization, type NewUserOrganization } from './user-organizations.js';

describe('User Organizations Schema', () => {
  describe('Schema Definition', () => {
    it('should have all required fields per ADR-001/ADR-002', () => {
      const columns = Object.keys(userOrganizations);

      // Core junction fields
      expect(columns).toContain('userId');
      expect(columns).toContain('organizationId');

      // Role
      expect(columns).toContain('role');

      // Primary organization flag (ADR-002)
      expect(columns).toContain('isPrimary');

      // Time-limited access
      expect(columns).toContain('expiresAt');

      // Audit fields
      expect(columns).toContain('joinedAt');
      expect(columns).toContain('invitedBy');
    });
  });

  describe('User-Organization Relationship', () => {
    it('should allow user to have multiple organization memberships', () => {
      // ADR-001: Users can have access to multiple child tenants under the same root
      const userId = '00000000-0000-0000-0000-000000000001';

      const membership1: NewUserOrganization = {
        userId,
        organizationId: '00000000-0000-0000-0000-000000000010', // Org 1
        role: 'admin',
        isPrimary: true,
      };

      const membership2: NewUserOrganization = {
        userId,
        organizationId: '00000000-0000-0000-0000-000000000011', // Org 2
        role: 'member',
        isPrimary: false,
      };

      expect(membership1.userId).toBe(membership2.userId);
      expect(membership1.organizationId).not.toBe(membership2.organizationId);
    });

    it('should support different roles per organization', () => {
      // ADR-001: Users can have different roles in different tenants
      const userId = '00000000-0000-0000-0000-000000000001';

      const adminMembership: NewUserOrganization = {
        userId,
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'admin', // Admin in this org
        isPrimary: false,
      };

      const memberMembership: NewUserOrganization = {
        userId,
        organizationId: '00000000-0000-0000-0000-000000000011',
        role: 'member', // Just member in this org
        isPrimary: false,
      };

      expect(adminMembership.role).toBe('admin');
      expect(memberMembership.role).toBe('member');
    });
  });

  describe('Primary Organization Flag', () => {
    it('should mark one organization as primary', () => {
      // ADR-002: User has primary organization (default after login)
      const membership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'admin',
        isPrimary: true, // This is the default org
      };

      expect(membership.isPrimary).toBe(true);
    });

    it('should allow only one primary per user (enforced by trigger)', () => {
      // The database trigger ensures only one isPrimary = true per user
      // Here we just verify the type supports the flag
      const membership1: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'admin',
        isPrimary: true,
      };

      const membership2: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000011',
        role: 'member',
        isPrimary: false, // Not primary
      };

      expect(membership1.isPrimary).toBe(true);
      expect(membership2.isPrimary).toBe(false);
    });
  });

  describe('Role Types', () => {
    it('should support owner role', () => {
      const membership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'owner',
        isPrimary: false,
      };

      expect(membership.role).toBe('owner');
    });

    it('should support admin role', () => {
      const membership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'admin',
        isPrimary: false,
      };

      expect(membership.role).toBe('admin');
    });

    it('should support member role', () => {
      const membership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'member',
        isPrimary: false,
      };

      expect(membership.role).toBe('member');
    });

    it('should support viewer role', () => {
      const membership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'viewer',
        isPrimary: false,
      };

      expect(membership.role).toBe('viewer');
    });
  });

  describe('Time-Limited Access', () => {
    it('should support expiration for contractor access', () => {
      // ADR-001: Access can be time-limited (guest access)
      const expirationDate = new Date('2026-12-31T23:59:59Z');

      const contractorMembership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'member',
        isPrimary: false,
        expiresAt: expirationDate, // Time-limited
      };

      expect(contractorMembership.expiresAt).toBeDefined();
      expect(contractorMembership.expiresAt).toEqual(expirationDate);
    });

    it('should allow permanent access without expiration', () => {
      const permanentMembership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'admin',
        isPrimary: false,
        expiresAt: undefined, // No expiration
      };

      expect(permanentMembership.expiresAt).toBeUndefined();
    });
  });

  describe('Audit Trail', () => {
    it('should track who invited the user', () => {
      const membership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000002', // Invited user
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'member',
        isPrimary: false,
        invitedBy: '00000000-0000-0000-0000-000000000001', // Admin who invited
      };

      expect(membership.invitedBy).toBeDefined();
    });

    it('should track join date', () => {
      // joinedAt defaults to now, but can be set
      const membership: NewUserOrganization = {
        userId: '00000000-0000-0000-0000-000000000001',
        organizationId: '00000000-0000-0000-0000-000000000010',
        role: 'member',
        isPrimary: false,
        joinedAt: new Date('2026-01-01'),
      };

      expect(membership.joinedAt).toBeDefined();
    });
  });
});

describe('Tenant Context Switching Support', () => {
  describe('Building Accessible Tenant List', () => {
    it('should support querying user accessible organizations', () => {
      // ADR-002: JWT should contain accessible_tenant_ids
      // The user_organizations table is the source for this list

      // Example: user has access to 3 orgs
      const accessList: NewUserOrganization[] = [
        {
          userId: '00000000-0000-0000-0000-000000000001',
          organizationId: '00000000-0000-0000-0000-000000000010',
          role: 'admin',
          isPrimary: true,
        },
        {
          userId: '00000000-0000-0000-0000-000000000001',
          organizationId: '00000000-0000-0000-0000-000000000011',
          role: 'member',
          isPrimary: false,
        },
        {
          userId: '00000000-0000-0000-0000-000000000001',
          organizationId: '00000000-0000-0000-0000-000000000012',
          role: 'viewer',
          isPrimary: false,
        },
      ];

      const accessibleOrgIds = accessList.map((m) => m.organizationId);
      expect(accessibleOrgIds).toHaveLength(3);
      expect(accessibleOrgIds).toContain('00000000-0000-0000-0000-000000000010');
      expect(accessibleOrgIds).toContain('00000000-0000-0000-0000-000000000011');
      expect(accessibleOrgIds).toContain('00000000-0000-0000-0000-000000000012');
    });

    it('should filter out expired access', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000); // Yesterday
      const futureDate = new Date(now.getTime() + 86400000); // Tomorrow

      const accessList: NewUserOrganization[] = [
        {
          userId: '00000000-0000-0000-0000-000000000001',
          organizationId: '00000000-0000-0000-0000-000000000010',
          role: 'admin',
          isPrimary: true,
          expiresAt: undefined, // No expiration
        },
        {
          userId: '00000000-0000-0000-0000-000000000001',
          organizationId: '00000000-0000-0000-0000-000000000011',
          role: 'member',
          isPrimary: false,
          expiresAt: pastDate, // Expired
        },
        {
          userId: '00000000-0000-0000-0000-000000000001',
          organizationId: '00000000-0000-0000-0000-000000000012',
          role: 'viewer',
          isPrimary: false,
          expiresAt: futureDate, // Still valid
        },
      ];

      // Filter active memberships
      const activeMemberships = accessList.filter(
        (m) => m.expiresAt == null || m.expiresAt > now
      );

      expect(activeMemberships).toHaveLength(2);
      expect(activeMemberships.map((m) => m.organizationId)).toContain(
        '00000000-0000-0000-0000-000000000010'
      );
      expect(activeMemberships.map((m) => m.organizationId)).toContain(
        '00000000-0000-0000-0000-000000000012'
      );
    });
  });
});
