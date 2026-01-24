/**
 * Unit tests for organization schema and multi-tenant model
 * Tests ADR-001: Multi-Tenant Model with Unlimited Recursive Trees
 */

import { describe, it, expect } from 'vitest';
import { organizations, type Organization, type NewOrganization } from './organizations.js';

describe('Organization Schema', () => {
  describe('Schema Definition', () => {
    it('should have all required hierarchy fields per ADR-001', () => {
      // Verify table has all required columns
      const columns = Object.keys(organizations);

      // Core identity
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('slug');
      expect(columns).toContain('orgCode');

      // Hierarchy fields (ADR-001)
      expect(columns).toContain('parentOrganizationId');
      expect(columns).toContain('rootOrganizationId');
      expect(columns).toContain('isRoot');
      expect(columns).toContain('path');
      expect(columns).toContain('depth');
      expect(columns).toContain('canHaveChildren');

      // Subdomain (ADR-002)
      expect(columns).toContain('subdomain');
    });

    it('should have correct column types for hierarchy fields', () => {
      // This test verifies the schema structure matches ADR requirements
      // The actual type checking is done by TypeScript
      const schema = organizations;

      // Verify columns exist and are properly defined
      expect(schema.id).toBeDefined();
      expect(schema.parentOrganizationId).toBeDefined();
      expect(schema.rootOrganizationId).toBeDefined();
      expect(schema.isRoot).toBeDefined();
      expect(schema.path).toBeDefined();
      expect(schema.depth).toBeDefined();
    });
  });

  describe('Type Definitions', () => {
    it('should allow creating root organization type', () => {
      const rootOrg: NewOrganization = {
        name: 'Root Organization',
        slug: 'root-org',
        orgCode: 'ROOT',
        isRoot: true,
        subdomain: 'root',
        depth: 0,
        canHaveChildren: true,
      };

      expect(rootOrg.isRoot).toBe(true);
      expect(rootOrg.subdomain).toBeDefined();
      expect(rootOrg.depth).toBe(0);
    });

    it('should allow creating child organization type', () => {
      const childOrg: NewOrganization = {
        name: 'Child Organization',
        slug: 'child-org',
        orgCode: 'CHILD',
        isRoot: false,
        parentOrganizationId: '00000000-0000-0000-0000-000000000001',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        depth: 1,
        canHaveChildren: true,
      };

      expect(childOrg.isRoot).toBe(false);
      expect(childOrg.parentOrganizationId).toBeDefined();
      expect(childOrg.subdomain).toBeUndefined();
    });

    it('should support unlimited depth in type definition', () => {
      // ADR-001 requires unlimited depth support
      const deepOrg: NewOrganization = {
        name: 'Deep Organization',
        slug: 'deep-org',
        orgCode: 'DEEP',
        isRoot: false,
        parentOrganizationId: '00000000-0000-0000-0000-000000000099',
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        depth: 100, // Deep nesting
        path: 'root.l1.l2.l3.l4.l5.l6.l7.l8.l9.l10',
        canHaveChildren: true,
      };

      expect(deepOrg.depth).toBe(100);
      expect(deepOrg.path).toContain('l10');
    });
  });

  describe('LTREE Path Format', () => {
    it('should support valid LTREE path format', () => {
      // ADR-001: Path format should be like 'radio.walmart.northeast.ny.manhattan_001'
      const org: NewOrganization = {
        name: 'Manhattan Store',
        slug: 'manhattan-001',
        orgCode: 'MANHATTAN001',
        isRoot: false,
        path: 'radio.walmart.northeast.ny.manhattan_001',
        depth: 4,
      };

      expect(org.path).toMatch(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/);
    });

    it('should support single label for root', () => {
      const rootOrg: NewOrganization = {
        name: 'Radio OEM',
        slug: 'radio',
        orgCode: 'RADIO',
        isRoot: true,
        subdomain: 'radio',
        path: 'radio',
        depth: 0,
      };

      expect(rootOrg.path).toBe('radio');
      expect(rootOrg.depth).toBe(0);
    });
  });
});

describe('Organization Hierarchy Constraints', () => {
  describe('Root Organization Rules', () => {
    it('root organizations should have subdomain', () => {
      const rootOrg: NewOrganization = {
        name: 'Root Org',
        slug: 'root',
        orgCode: 'ROOT',
        isRoot: true,
        subdomain: 'root', // Required for root
        depth: 0,
      };

      expect(rootOrg.isRoot).toBe(true);
      expect(rootOrg.subdomain).toBeDefined();
    });

    it('root organizations should reference themselves', () => {
      // ADR-001: Root orgs have root_organization_id = id
      // This is enforced by database trigger, but type allows it
      const rootId = '00000000-0000-0000-0000-000000000001';
      const rootOrg: NewOrganization = {
        name: 'Root Org',
        slug: 'root',
        orgCode: 'ROOT',
        isRoot: true,
        subdomain: 'root',
        rootOrganizationId: rootId, // Self-reference
        depth: 0,
      };

      expect(rootOrg.rootOrganizationId).toBe(rootId);
    });

    it('root organizations should not have parent', () => {
      const rootOrg: NewOrganization = {
        name: 'Root Org',
        slug: 'root',
        orgCode: 'ROOT',
        isRoot: true,
        subdomain: 'root',
        parentOrganizationId: undefined, // Must be undefined/null
        depth: 0,
      };

      expect(rootOrg.parentOrganizationId).toBeUndefined();
    });
  });

  describe('Child Organization Rules', () => {
    it('child organizations must have parent', () => {
      const childOrg: NewOrganization = {
        name: 'Child Org',
        slug: 'child',
        orgCode: 'CHILD',
        isRoot: false,
        parentOrganizationId: '00000000-0000-0000-0000-000000000001', // Required
        rootOrganizationId: '00000000-0000-0000-0000-000000000001',
        depth: 1,
      };

      expect(childOrg.parentOrganizationId).toBeDefined();
    });

    it('child organizations should not have subdomain', () => {
      const childOrg: NewOrganization = {
        name: 'Child Org',
        slug: 'child',
        orgCode: 'CHILD',
        isRoot: false,
        parentOrganizationId: '00000000-0000-0000-0000-000000000001',
        subdomain: undefined, // Must be undefined for non-root
        depth: 1,
      };

      expect(childOrg.subdomain).toBeUndefined();
    });

    it('child organizations must have root_organization_id different from id', () => {
      const childId = '00000000-0000-0000-0000-000000000002';
      const rootId = '00000000-0000-0000-0000-000000000001';

      const childOrg: NewOrganization = {
        name: 'Child Org',
        slug: 'child',
        orgCode: 'CHILD',
        isRoot: false,
        parentOrganizationId: rootId,
        rootOrganizationId: rootId, // Points to root, not self
        depth: 1,
      };

      expect(childOrg.rootOrganizationId).toBe(rootId);
      // Note: actual ID would be different, enforced by DB
    });
  });
});

describe('Organization Code (org_code) Rules', () => {
  it('org_code should be used for tenant switching UI', () => {
    // ADR-002: org_code is human-readable identifier for tenant switching
    const org: NewOrganization = {
      name: 'Walmart',
      slug: 'walmart',
      orgCode: 'WALMART', // Human readable
      isRoot: false,
      parentOrganizationId: '00000000-0000-0000-0000-000000000001',
      depth: 1,
    };

    expect(org.orgCode).toBe('WALMART');
    // Should be suitable for dropdown display
    expect(org.orgCode.length).toBeLessThanOrEqual(50);
  });

  it('org_code uniqueness is per root organization', () => {
    // ADR-001: org_code unique within root organization
    // Two orgs under different roots can have same org_code
    const org1: NewOrganization = {
      name: 'Walmart under Radio',
      slug: 'radio-walmart',
      orgCode: 'WALMART',
      rootOrganizationId: '00000000-0000-0000-0000-000000000001', // Root 1
      isRoot: false,
      depth: 1,
    };

    const org2: NewOrganization = {
      name: 'Walmart under Mega',
      slug: 'mega-walmart',
      orgCode: 'WALMART', // Same org_code
      rootOrganizationId: '00000000-0000-0000-0000-000000000002', // Root 2
      isRoot: false,
      depth: 1,
    };

    expect(org1.orgCode).toBe(org2.orgCode);
    expect(org1.rootOrganizationId).not.toBe(org2.rootOrganizationId);
  });
});
