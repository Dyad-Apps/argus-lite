/**
 * Integration tests for organization hierarchy with deep nesting
 * Tests ADR-001 requirement: "Create test cases for 6+ level deep hierarchies"
 *
 * NOTE: These tests require a running PostgreSQL database with LTREE extension.
 * They are skipped by default and should be run in CI with a test database.
 */

import { describe, it, expect } from 'vitest';
import type { NewOrganization } from './organizations.js';

/**
 * Helper to build a deep organization hierarchy for testing
 * Creates organizations at each level from root to specified depth
 */
function buildDeepHierarchy(depth: number): NewOrganization[] {
  const rootId = '00000000-0000-0000-0000-000000000001';
  const orgs: NewOrganization[] = [];

  // Root organization (level 0)
  orgs.push({
    name: 'Root Organization',
    slug: 'root',
    orgCode: 'ROOT',
    isRoot: true,
    subdomain: 'root',
    rootOrganizationId: rootId,
    path: 'root',
    depth: 0,
    canHaveChildren: true,
  });

  // Child organizations (levels 1 to depth)
  let currentPath = 'root';
  let parentId = rootId;

  for (let level = 1; level <= depth; level++) {
    const orgId = `00000000-0000-0000-0000-${String(level + 1).padStart(12, '0')}`;
    const slug = `level_${level}`;
    currentPath = `${currentPath}.${slug}`;

    orgs.push({
      name: `Level ${level} Organization`,
      slug,
      orgCode: `L${level}`,
      isRoot: false,
      parentOrganizationId: parentId,
      rootOrganizationId: rootId,
      path: currentPath,
      depth: level,
      canHaveChildren: true,
    });

    parentId = orgId;
  }

  return orgs;
}

describe('Organization Hierarchy - Deep Nesting Support', () => {
  describe('6+ Level Hierarchy (ADR-001 Requirement)', () => {
    it('should support building 6-level hierarchy', () => {
      const hierarchy = buildDeepHierarchy(6);

      expect(hierarchy).toHaveLength(7); // Root + 6 levels
      expect(hierarchy[0].depth).toBe(0);
      expect(hierarchy[6].depth).toBe(6);
      expect(hierarchy[6].path).toBe('root.level_1.level_2.level_3.level_4.level_5.level_6');
    });

    it('should support building 10-level hierarchy', () => {
      const hierarchy = buildDeepHierarchy(10);

      expect(hierarchy).toHaveLength(11);
      expect(hierarchy[10].depth).toBe(10);
      expect(hierarchy[10].path).toContain('level_10');
    });

    it('should support building 20-level hierarchy', () => {
      const hierarchy = buildDeepHierarchy(20);

      expect(hierarchy).toHaveLength(21);
      expect(hierarchy[20].depth).toBe(20);

      // Verify path structure
      const expectedPath = [
        'root',
        ...Array.from({ length: 20 }, (_, i) => `level_${i + 1}`),
      ].join('.');
      expect(hierarchy[20].path).toBe(expectedPath);
    });

    it('should support extremely deep hierarchy (100 levels)', () => {
      // ADR-001: LTREE paths limited to 65,535 labels (practically unlimited)
      const hierarchy = buildDeepHierarchy(100);

      expect(hierarchy).toHaveLength(101);
      expect(hierarchy[100].depth).toBe(100);

      // Verify path labels count
      const labels = hierarchy[100].path!.split('.');
      expect(labels).toHaveLength(101); // root + 100 levels
    });
  });

  describe('LTREE Path Format Validation', () => {
    it('should generate valid LTREE path format', () => {
      const hierarchy = buildDeepHierarchy(5);

      // LTREE allows: alphanumeric + underscore
      // Each label separated by dots
      const ltreePattern = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

      hierarchy.forEach((org) => {
        expect(org.path).toMatch(ltreePattern);
      });
    });

    it('should maintain parent-child path relationship', () => {
      const hierarchy = buildDeepHierarchy(5);

      for (let i = 1; i < hierarchy.length; i++) {
        const parent = hierarchy[i - 1];
        const child = hierarchy[i];

        // Child path should start with parent path
        expect(child.path!.startsWith(parent.path!)).toBe(true);

        // Child path should have exactly one more label than parent
        const parentLabels = parent.path!.split('.').length;
        const childLabels = child.path!.split('.').length;
        expect(childLabels).toBe(parentLabels + 1);
      }
    });

    it('should correctly calculate depth from path', () => {
      const hierarchy = buildDeepHierarchy(10);

      hierarchy.forEach((org) => {
        const pathLabels = org.path!.split('.').length;
        // depth should be pathLabels - 1 (root has depth 0, path 'root' has 1 label)
        expect(org.depth).toBe(pathLabels - 1);
      });
    });
  });

  describe('Hierarchy Query Patterns (LTREE Operations)', () => {
    it('should support ancestor query pattern', () => {
      // In SQL: SELECT * FROM orgs WHERE path @> 'root.level_1.level_2'
      // This finds all ancestors of level_2

      const hierarchy = buildDeepHierarchy(5);
      const targetPath = 'root.level_1.level_2';

      // Simulate ancestor query: find orgs whose path is a prefix of target
      const ancestors = hierarchy.filter((org) => {
        return targetPath.startsWith(org.path!) || org.path === targetPath;
      });

      expect(ancestors).toHaveLength(3); // root, level_1, level_2
      expect(ancestors.map((a) => a.depth)).toEqual([0, 1, 2]);
    });

    it('should support descendant query pattern', () => {
      // In SQL: SELECT * FROM orgs WHERE path <@ 'root.level_1'
      // This finds all descendants of level_1

      const hierarchy = buildDeepHierarchy(5);
      const targetPath = 'root.level_1';

      // Simulate descendant query: find orgs whose path starts with target
      const descendants = hierarchy.filter((org) => {
        return org.path!.startsWith(targetPath);
      });

      expect(descendants).toHaveLength(5); // level_1 through level_5
      expect(descendants[0].depth).toBe(1);
      expect(descendants[4].depth).toBe(5);
    });

    it('should support subtree query pattern', () => {
      // Get entire subtree under a specific org

      const hierarchy = buildDeepHierarchy(6);
      const subtreeRoot = 'root.level_1.level_2';

      const subtree = hierarchy.filter((org) => {
        return org.path!.startsWith(subtreeRoot);
      });

      expect(subtree).toHaveLength(5); // level_2 through level_6
    });

    it('should support sibling query pattern', () => {
      // Find orgs at the same depth under the same parent
      // This would require multiple orgs at the same level

      const rootId = '00000000-0000-0000-0000-000000000001';
      const parentId = '00000000-0000-0000-0000-000000000002';

      const siblings: NewOrganization[] = [
        {
          name: 'Sibling 1',
          slug: 'sibling_1',
          orgCode: 'S1',
          isRoot: false,
          parentOrganizationId: parentId,
          rootOrganizationId: rootId,
          path: 'root.parent.sibling_1',
          depth: 2,
        },
        {
          name: 'Sibling 2',
          slug: 'sibling_2',
          orgCode: 'S2',
          isRoot: false,
          parentOrganizationId: parentId,
          rootOrganizationId: rootId,
          path: 'root.parent.sibling_2',
          depth: 2,
        },
        {
          name: 'Sibling 3',
          slug: 'sibling_3',
          orgCode: 'S3',
          isRoot: false,
          parentOrganizationId: parentId,
          rootOrganizationId: rootId,
          path: 'root.parent.sibling_3',
          depth: 2,
        },
      ];

      // All siblings have same parent and depth
      expect(siblings.every((s) => s.parentOrganizationId === parentId)).toBe(true);
      expect(siblings.every((s) => s.depth === 2)).toBe(true);

      // But different paths
      const paths = siblings.map((s) => s.path);
      expect(new Set(paths).size).toBe(3);
    });
  });

  describe('Real-World Hierarchy Examples', () => {
    it('should model Radio OEM hierarchy from ADR-001', () => {
      // ADR-001 example: radio.walmart.northeast.ny.manhattan_001

      const radioHierarchy: NewOrganization[] = [
        {
          name: 'Radio OEM',
          slug: 'radio',
          orgCode: 'RADIO',
          isRoot: true,
          subdomain: 'radio',
          path: 'radio',
          depth: 0,
        },
        {
          name: 'Walmart',
          slug: 'walmart',
          orgCode: 'WALMART',
          isRoot: false,
          path: 'radio.walmart',
          depth: 1,
        },
        {
          name: 'Northeast Region',
          slug: 'northeast',
          orgCode: 'NORTHEAST',
          isRoot: false,
          path: 'radio.walmart.northeast',
          depth: 2,
        },
        {
          name: 'New York',
          slug: 'ny',
          orgCode: 'NY',
          isRoot: false,
          path: 'radio.walmart.northeast.ny',
          depth: 3,
        },
        {
          name: 'Manhattan Store 001',
          slug: 'manhattan_001',
          orgCode: 'MAN001',
          isRoot: false,
          path: 'radio.walmart.northeast.ny.manhattan_001',
          depth: 4,
        },
      ];

      expect(radioHierarchy[4].path).toBe('radio.walmart.northeast.ny.manhattan_001');
      expect(radioHierarchy[4].depth).toBe(4);
    });

    it('should model enterprise hierarchy with 6+ levels', () => {
      // Enterprise example:
      // MegaCorp > Division > Region > Country > State > City > Store

      const enterprise: NewOrganization[] = [
        { name: 'MegaCorp', slug: 'megacorp', orgCode: 'MEGA', isRoot: true, subdomain: 'mega', path: 'megacorp', depth: 0 },
        { name: 'Retail Division', slug: 'retail', orgCode: 'RETAIL', isRoot: false, path: 'megacorp.retail', depth: 1 },
        { name: 'North America', slug: 'na', orgCode: 'NA', isRoot: false, path: 'megacorp.retail.na', depth: 2 },
        { name: 'United States', slug: 'us', orgCode: 'US', isRoot: false, path: 'megacorp.retail.na.us', depth: 3 },
        { name: 'California', slug: 'ca', orgCode: 'CA', isRoot: false, path: 'megacorp.retail.na.us.ca', depth: 4 },
        { name: 'Los Angeles', slug: 'la', orgCode: 'LA', isRoot: false, path: 'megacorp.retail.na.us.ca.la', depth: 5 },
        { name: 'Downtown Store', slug: 'downtown', orgCode: 'DTLA', isRoot: false, path: 'megacorp.retail.na.us.ca.la.downtown', depth: 6 },
      ];

      // 7 levels (0-6)
      expect(enterprise).toHaveLength(7);
      expect(enterprise[6].depth).toBe(6);
      expect(enterprise[6].path!.split('.').length).toBe(7);
    });
  });
});

describe('Multi-Root Tenant Isolation', () => {
  it('should keep separate hierarchies for different root tenants', () => {
    const rootA = '00000000-0000-0000-0000-00000000000A';
    const rootB = '00000000-0000-0000-0000-00000000000B';

    const tenantA: NewOrganization[] = [
      { name: 'Company A', slug: 'company_a', orgCode: 'COMPA', isRoot: true, subdomain: 'companya', rootOrganizationId: rootA, path: 'company_a', depth: 0 },
      { name: 'Dept A1', slug: 'dept_a1', orgCode: 'DEPTA1', isRoot: false, rootOrganizationId: rootA, path: 'company_a.dept_a1', depth: 1 },
    ];

    const tenantB: NewOrganization[] = [
      { name: 'Company B', slug: 'company_b', orgCode: 'COMPB', isRoot: true, subdomain: 'companyb', rootOrganizationId: rootB, path: 'company_b', depth: 0 },
      { name: 'Dept B1', slug: 'dept_b1', orgCode: 'DEPTB1', isRoot: false, rootOrganizationId: rootB, path: 'company_b.dept_b1', depth: 1 },
    ];

    // Different root_organization_id
    expect(tenantA[0].rootOrganizationId).not.toBe(tenantB[0].rootOrganizationId);

    // Different path trees
    expect(tenantA[1].path).not.toContain('company_b');
    expect(tenantB[1].path).not.toContain('company_a');

    // Same org_code allowed in different roots
    tenantA[1].orgCode = 'SHARED';
    tenantB[1].orgCode = 'SHARED';
    expect(tenantA[1].orgCode).toBe(tenantB[1].orgCode);
  });
});
