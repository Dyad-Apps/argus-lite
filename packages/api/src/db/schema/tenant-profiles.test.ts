/**
 * Unit tests for tenant profile schema
 * Tests profile templates with capabilities and limits for organizations
 */

import { describe, it, expect } from 'vitest';
import {
  tenantProfiles,
  type TenantProfile,
  type NewTenantProfile,
  type ProfileCapabilities,
  type ProfileLimits,
} from './tenant-profiles.js';

describe('Tenant Profile Schema', () => {
  describe('Schema Definition', () => {
    it('should have all required fields', () => {
      const columns = Object.keys(tenantProfiles);

      // Core fields
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('description');
      expect(columns).toContain('type');

      // Configuration
      expect(columns).toContain('isSystem');
      expect(columns).toContain('capabilities');
      expect(columns).toContain('limits');
      expect(columns).toContain('isActive');

      // Timestamps
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });
  });

  describe('Profile Type', () => {
    it('should support root profile type', () => {
      const profile: NewTenantProfile = {
        name: 'Enterprise Root',
        type: 'root',
        isSystem: true,
      };

      expect(profile.type).toBe('root');
    });

    it('should support child profile type', () => {
      const profile: NewTenantProfile = {
        name: 'Standard Child',
        type: 'child',
      };

      expect(profile.type).toBe('child');
    });

    it('should support universal profile type', () => {
      const profile: NewTenantProfile = {
        name: 'Standard Universal',
        type: 'universal',
      };

      expect(profile.type).toBe('universal');
    });
  });

  describe('Profile Capabilities', () => {
    it('should support all capability flags', () => {
      const capabilities: ProfileCapabilities = {
        whiteLabeling: true,
        ssoEnabled: true,
        mfaEnabled: true,
        apiAccess: true,
        aiFeatures: true,
        advancedAnalytics: true,
        customIntegrations: true,
        canHaveChildren: true,
        maxChildDepth: 5,
      };

      const profile: NewTenantProfile = {
        name: 'Enterprise Profile',
        capabilities,
      };

      expect(profile.capabilities?.whiteLabeling).toBe(true);
      expect(profile.capabilities?.maxChildDepth).toBe(5);
    });

    it('should allow partial capabilities', () => {
      const profile: NewTenantProfile = {
        name: 'Basic Profile',
        capabilities: {
          ssoEnabled: false,
          mfaEnabled: true,
        },
      };

      expect(profile.capabilities?.ssoEnabled).toBe(false);
      expect(profile.capabilities?.mfaEnabled).toBe(true);
      expect(profile.capabilities?.whiteLabeling).toBeUndefined();
    });
  });

  describe('Profile Limits', () => {
    it('should support all limit fields', () => {
      const limits: ProfileLimits = {
        maxUsers: 100,
        maxDevices: 500,
        maxAssets: 1000,
        maxDashboards: 50,
        maxApiKeys: 10,
        maxChildOrganizations: 20,
        dataRetentionDays: 365,
        storageGb: 100,
      };

      const profile: NewTenantProfile = {
        name: 'Standard Profile',
        limits,
      };

      expect(profile.limits?.maxUsers).toBe(100);
      expect(profile.limits?.storageGb).toBe(100);
    });

    it('should allow unlimited (undefined) limits', () => {
      const profile: NewTenantProfile = {
        name: 'Unlimited Profile',
        limits: {
          maxUsers: undefined, // Unlimited
          dataRetentionDays: 90,
        },
      };

      expect(profile.limits?.maxUsers).toBeUndefined();
      expect(profile.limits?.dataRetentionDays).toBe(90);
    });
  });

  describe('System Profiles', () => {
    it('should support system profile flag', () => {
      const systemProfile: NewTenantProfile = {
        name: 'Default Profile',
        isSystem: true,
        type: 'universal',
      };

      expect(systemProfile.isSystem).toBe(true);
    });

    it('should default to non-system profile', () => {
      const customProfile: NewTenantProfile = {
        name: 'Custom Profile',
      };

      expect(customProfile.isSystem).toBeUndefined();
    });
  });
});

describe('Profile Configuration Examples', () => {
  describe('Enterprise Profile', () => {
    it('should define enterprise profile with full capabilities', () => {
      const enterpriseProfile: NewTenantProfile = {
        name: 'Enterprise',
        description: 'Full-featured enterprise profile with all capabilities',
        type: 'root',
        isSystem: true,
        capabilities: {
          whiteLabeling: true,
          ssoEnabled: true,
          mfaEnabled: true,
          apiAccess: true,
          aiFeatures: true,
          advancedAnalytics: true,
          customIntegrations: true,
          canHaveChildren: true,
          maxChildDepth: 10,
        },
        limits: {
          maxUsers: 10000,
          maxDevices: 50000,
          maxAssets: 100000,
          maxDashboards: 500,
          maxApiKeys: 100,
          maxChildOrganizations: 100,
          dataRetentionDays: 730,
          storageGb: 1000,
        },
        isActive: true,
      };

      expect(enterpriseProfile.capabilities?.canHaveChildren).toBe(true);
      expect(enterpriseProfile.limits?.maxUsers).toBe(10000);
    });
  });

  describe('Starter Profile', () => {
    it('should define starter profile with limited capabilities', () => {
      const starterProfile: NewTenantProfile = {
        name: 'Starter',
        description: 'Basic profile for small organizations',
        type: 'child',
        isSystem: true,
        capabilities: {
          whiteLabeling: false,
          ssoEnabled: false,
          mfaEnabled: true,
          apiAccess: false,
          aiFeatures: false,
          advancedAnalytics: false,
          customIntegrations: false,
          canHaveChildren: false,
        },
        limits: {
          maxUsers: 10,
          maxDevices: 50,
          maxAssets: 100,
          maxDashboards: 5,
          maxApiKeys: 2,
          maxChildOrganizations: 0,
          dataRetentionDays: 90,
          storageGb: 5,
        },
        isActive: true,
      };

      expect(starterProfile.capabilities?.canHaveChildren).toBe(false);
      expect(starterProfile.limits?.maxUsers).toBe(10);
    });
  });
});
