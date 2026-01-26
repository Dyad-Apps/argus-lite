/**
 * Unit tests for platform settings schema
 * Tests platform-wide configuration, system admins, and branding
 */

import { describe, it, expect } from 'vitest';
import {
  platformSettings,
  systemAdmins,
  platformBranding,
  PLATFORM_SETTING_KEYS,
  type PlatformSetting,
  type NewPlatformSetting,
  type SystemAdmin,
  type NewSystemAdmin,
  type PlatformBrandingType,
} from './platform-settings.js';
import { systemRoleEnum } from './enums.js';

describe('Platform Settings Schema', () => {
  describe('Schema Definition', () => {
    it('should have all required fields for platform_settings', () => {
      const columns = Object.keys(platformSettings);

      expect(columns).toContain('id');
      expect(columns).toContain('key');
      expect(columns).toContain('value');
      expect(columns).toContain('description');
      expect(columns).toContain('isSecret');
      expect(columns).toContain('updatedBy');
      expect(columns).toContain('updatedAt');
    });

    it('should have all required fields for system_admins', () => {
      const columns = Object.keys(systemAdmins);

      expect(columns).toContain('id');
      expect(columns).toContain('userId');
      expect(columns).toContain('role');
      expect(columns).toContain('isActive');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('createdBy');
    });

    it('should have all required fields for platform_branding', () => {
      const columns = Object.keys(platformBranding);

      // Logo fields
      expect(columns).toContain('logoUrl');
      expect(columns).toContain('logoDarkUrl');
      expect(columns).toContain('faviconUrl');

      // Color fields
      expect(columns).toContain('primaryColor');
      expect(columns).toContain('accentColor');

      // Login page fields
      expect(columns).toContain('loginBackgroundType');
      expect(columns).toContain('loginBackgroundUrl');
      expect(columns).toContain('loginWelcomeText');
      expect(columns).toContain('loginSubtitle');

      // Legal links
      expect(columns).toContain('termsOfServiceUrl');
      expect(columns).toContain('privacyPolicyUrl');
      expect(columns).toContain('supportUrl');

      // Audit
      expect(columns).toContain('updatedAt');
      expect(columns).toContain('updatedBy');
    });
  });

  describe('System Role Enum', () => {
    it('should have all required system role values', () => {
      const roleValues = systemRoleEnum.enumValues;

      expect(roleValues).toContain('super_admin');
      expect(roleValues).toContain('support');
      expect(roleValues).toContain('billing');
    });
  });
});

describe('Platform Setting Keys', () => {
  describe('Security Settings', () => {
    it('should define password policy keys', () => {
      expect(PLATFORM_SETTING_KEYS.PASSWORD_MIN_LENGTH).toBe('security.password_min_length');
      expect(PLATFORM_SETTING_KEYS.PASSWORD_REQUIRE_UPPERCASE).toBe('security.password_require_uppercase');
      expect(PLATFORM_SETTING_KEYS.PASSWORD_REQUIRE_NUMBER).toBe('security.password_require_number');
      expect(PLATFORM_SETTING_KEYS.PASSWORD_REQUIRE_SPECIAL).toBe('security.password_require_special');
    });

    it('should define session settings keys', () => {
      expect(PLATFORM_SETTING_KEYS.SESSION_TIMEOUT_MINUTES).toBe('security.session_timeout_minutes');
      expect(PLATFORM_SETTING_KEYS.MFA_ENABLED).toBe('security.mfa_enabled');
    });
  });

  describe('Rate Limiting Settings', () => {
    it('should define rate limit keys', () => {
      expect(PLATFORM_SETTING_KEYS.RATE_LIMIT_REQUESTS_PER_MINUTE).toBe('rate_limit.requests_per_minute');
      expect(PLATFORM_SETTING_KEYS.RATE_LIMIT_LOGIN_ATTEMPTS).toBe('rate_limit.login_attempts');
    });
  });

  describe('Feature Settings', () => {
    it('should define feature toggle keys', () => {
      expect(PLATFORM_SETTING_KEYS.SELF_REGISTRATION_ENABLED).toBe('features.self_registration_enabled');
      expect(PLATFORM_SETTING_KEYS.SOCIAL_LOGIN_ENABLED).toBe('features.social_login_enabled');
    });
  });

  describe('Email Settings', () => {
    it('should define email configuration keys', () => {
      expect(PLATFORM_SETTING_KEYS.EMAIL_FROM_ADDRESS).toBe('email.from_address');
      expect(PLATFORM_SETTING_KEYS.EMAIL_FROM_NAME).toBe('email.from_name');
    });
  });
});

describe('Platform Settings Types', () => {
  describe('Creating Settings', () => {
    it('should support creating a string setting', () => {
      const setting: NewPlatformSetting = {
        key: 'email.from_address',
        value: 'noreply@argusiq.com',
        description: 'Default sender email address',
      };

      expect(setting.key).toBeDefined();
      expect(setting.value).toBe('noreply@argusiq.com');
    });

    it('should support creating a numeric setting', () => {
      const setting: NewPlatformSetting = {
        key: 'security.password_min_length',
        value: 12,
        description: 'Minimum password length',
      };

      expect(setting.value).toBe(12);
    });

    it('should support creating a boolean setting', () => {
      const setting: NewPlatformSetting = {
        key: 'security.mfa_enabled',
        value: true,
        description: 'Require MFA for all users',
      };

      expect(setting.value).toBe(true);
    });

    it('should support creating a secret setting', () => {
      const setting: NewPlatformSetting = {
        key: 'email.smtp_password',
        value: 'super_secret_password',
        description: 'SMTP server password',
        isSecret: true,
      };

      expect(setting.isSecret).toBe(true);
    });

    it('should support creating a complex object setting', () => {
      const setting: NewPlatformSetting = {
        key: 'features.advanced_config',
        value: {
          enableBetaFeatures: true,
          maxUploadSize: 10485760,
          allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
        },
        description: 'Advanced feature configuration',
      };

      expect(typeof setting.value).toBe('object');
    });
  });
});

describe('System Admin Types', () => {
  describe('Creating System Admins', () => {
    it('should support creating a super admin', () => {
      const admin: NewSystemAdmin = {
        userId: '00000000-0000-0000-0000-000000000001',
        role: 'super_admin',
        createdBy: '00000000-0000-0000-0000-000000000000',
      };

      expect(admin.role).toBe('super_admin');
    });

    it('should support creating a support admin', () => {
      const admin: NewSystemAdmin = {
        userId: '00000000-0000-0000-0000-000000000002',
        role: 'support',
        createdBy: '00000000-0000-0000-0000-000000000001',
      };

      expect(admin.role).toBe('support');
    });

    it('should support creating a billing admin', () => {
      const admin: NewSystemAdmin = {
        userId: '00000000-0000-0000-0000-000000000003',
        role: 'billing',
        createdBy: '00000000-0000-0000-0000-000000000001',
      };

      expect(admin.role).toBe('billing');
    });

    it('should default to active status', () => {
      const admin: NewSystemAdmin = {
        userId: '00000000-0000-0000-0000-000000000001',
        role: 'support',
      };

      // isActive is optional, database defaults to true
      expect(admin.isActive).toBeUndefined();
    });
  });

  describe('System Admin Capabilities', () => {
    it('super_admin should have highest privileges', () => {
      const admin: SystemAdmin = {
        id: '00000000-0000-0000-0000-000000000100',
        userId: '00000000-0000-0000-0000-000000000001',
        role: 'super_admin',
        isActive: true,
        createdAt: new Date(),
        createdBy: null,
      };

      expect(admin.role).toBe('super_admin');
      expect(admin.isActive).toBe(true);
    });

    it('support should have limited admin privileges', () => {
      const admin: SystemAdmin = {
        id: '00000000-0000-0000-0000-000000000101',
        userId: '00000000-0000-0000-0000-000000000002',
        role: 'support',
        isActive: true,
        createdAt: new Date(),
        createdBy: '00000000-0000-0000-0000-000000000001',
      };

      expect(admin.role).toBe('support');
    });
  });
});

describe('Platform Branding Types', () => {
  describe('Creating Branding Configuration', () => {
    it('should support full branding configuration', () => {
      const branding: Partial<PlatformBrandingType> = {
        logoUrl: 'https://cdn.argusiq.com/logo.png',
        logoDarkUrl: 'https://cdn.argusiq.com/logo-dark.png',
        faviconUrl: 'https://cdn.argusiq.com/favicon.ico',
        primaryColor: '#1890FF',
        accentColor: '#FF6B6B',
        loginBackgroundType: 'particles',
        loginWelcomeText: 'Welcome to ArgusIQ',
        loginSubtitle: 'Sign in to your account',
        termsOfServiceUrl: 'https://argusiq.com/terms',
        privacyPolicyUrl: 'https://argusiq.com/privacy',
        supportUrl: 'https://support.argusiq.com',
      };

      expect(branding.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(branding.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should support minimal branding configuration', () => {
      const branding: Partial<PlatformBrandingType> = {
        logoUrl: 'https://cdn.example.com/logo.png',
        primaryColor: '#0066CC',
      };

      expect(branding.logoUrl).toBeDefined();
      expect(branding.primaryColor).toBeDefined();
    });

    it('should support different login background types', () => {
      const backgrounds: Array<PlatformBrandingType['loginBackgroundType']> = [
        'particles',
        'image',
        'gradient',
        'solid',
      ];

      backgrounds.forEach((bgType) => {
        const branding: Partial<PlatformBrandingType> = {
          loginBackgroundType: bgType,
        };
        expect(['particles', 'image', 'gradient', 'solid']).toContain(branding.loginBackgroundType);
      });
    });

    it('should support image background with URL', () => {
      const branding: Partial<PlatformBrandingType> = {
        loginBackgroundType: 'image',
        loginBackgroundUrl: 'https://cdn.argusiq.com/backgrounds/hero.jpg',
      };

      expect(branding.loginBackgroundType).toBe('image');
      expect(branding.loginBackgroundUrl).toBeDefined();
    });
  });

  describe('Legal Links', () => {
    it('should support all legal link fields', () => {
      const branding: Partial<PlatformBrandingType> = {
        termsOfServiceUrl: 'https://example.com/terms',
        privacyPolicyUrl: 'https://example.com/privacy',
        supportUrl: 'https://support.example.com',
      };

      expect(branding.termsOfServiceUrl).toContain('/terms');
      expect(branding.privacyPolicyUrl).toContain('/privacy');
      expect(branding.supportUrl).toContain('support');
    });
  });
});

describe('Common Platform Configuration Scenarios', () => {
  describe('Security Configuration', () => {
    it('should configure strong password policy', () => {
      const settings: NewPlatformSetting[] = [
        { key: 'security.password_min_length', value: 12 },
        { key: 'security.password_require_uppercase', value: true },
        { key: 'security.password_require_number', value: true },
        { key: 'security.password_require_special', value: true },
      ];

      expect(settings).toHaveLength(4);
      expect(settings.find((s) => s.key === 'security.password_min_length')?.value).toBe(12);
    });

    it('should configure session security', () => {
      const settings: NewPlatformSetting[] = [
        { key: 'security.session_timeout_minutes', value: 30 },
        { key: 'security.mfa_enabled', value: true },
      ];

      expect(settings.find((s) => s.key === 'security.session_timeout_minutes')?.value).toBe(30);
      expect(settings.find((s) => s.key === 'security.mfa_enabled')?.value).toBe(true);
    });
  });

  describe('Email Configuration', () => {
    it('should configure SMTP settings', () => {
      const settings: NewPlatformSetting[] = [
        { key: 'email.smtp_host', value: 'smtp.sendgrid.net', isSecret: false },
        { key: 'email.smtp_port', value: 587 },
        { key: 'email.smtp_username', value: 'apikey' },
        { key: 'email.smtp_password', value: 'SG.xxxx', isSecret: true },
        { key: 'email.smtp_tls', value: 'starttls' },
        { key: 'email.from_address', value: 'noreply@argusiq.com' },
        { key: 'email.from_name', value: 'ArgusIQ Platform' },
      ];

      const passwordSetting = settings.find((s) => s.key === 'email.smtp_password');
      expect(passwordSetting?.isSecret).toBe(true);
    });
  });

  describe('Feature Toggles', () => {
    it('should configure feature flags', () => {
      const settings: NewPlatformSetting[] = [
        { key: 'features.self_registration_enabled', value: false },
        { key: 'features.social_login_enabled', value: true },
      ];

      expect(settings.find((s) => s.key === 'features.self_registration_enabled')?.value).toBe(false);
      expect(settings.find((s) => s.key === 'features.social_login_enabled')?.value).toBe(true);
    });
  });
});
