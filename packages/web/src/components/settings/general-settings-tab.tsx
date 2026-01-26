/**
 * General Settings Tab
 *
 * Manages platform-wide security and feature settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Shield, ToggleLeft, RefreshCw, Key, Lock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SecretInput } from '@/components/ui/secret-input';
import { apiClient } from '@/lib/api-client';

interface PlatformSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  isSecret: boolean;
  updatedAt: string;
}

interface SettingsState {
  // Login Security
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  lockoutNotificationEmail: string;
  activationLinkTtlHours: number;
  passwordResetLinkTtlHours: number;

  // Password Policy
  passwordMinLength: number;
  passwordMaxLength: number;
  passwordExpirationDays: number;
  passwordReuseFrequencyDays: number;
  passwordMinUppercase: number;
  passwordMinLowercase: number;
  passwordMinDigits: number;
  passwordMinSpecialChars: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordAllowWhitespace: boolean;
  forceResetIfInvalid: boolean;

  // Session Settings
  sessionTimeoutMinutes: number;
  mfaEnabled: boolean;

  // JWT Settings
  jwtIssuer: string;
  jwtSigningKey: string;

  // Rate limiting
  rateLimitRequestsPerMinute: number;
  rateLimitLoginAttempts: number;

  // Features
  selfRegistrationEnabled: boolean;
  socialLoginEnabled: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  // Login Security
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  lockoutNotificationEmail: '',
  activationLinkTtlHours: 24,
  passwordResetLinkTtlHours: 1,

  // Password Policy
  passwordMinLength: 8,
  passwordMaxLength: 128,
  passwordExpirationDays: 0,
  passwordReuseFrequencyDays: 0,
  passwordMinUppercase: 1,
  passwordMinLowercase: 1,
  passwordMinDigits: 1,
  passwordMinSpecialChars: 0,
  passwordRequireUppercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: false,
  passwordAllowWhitespace: false,
  forceResetIfInvalid: false,

  // Session Settings
  sessionTimeoutMinutes: 30,
  mfaEnabled: false,

  // JWT Settings
  jwtIssuer: '',
  jwtSigningKey: '',

  // Rate limiting
  rateLimitRequestsPerMinute: 100,
  rateLimitLoginAttempts: 5,

  // Features
  selfRegistrationEnabled: false,
  socialLoginEnabled: false,
};

const SETTING_KEYS = {
  // Login Security
  maxFailedLoginAttempts: 'security.max_failed_login_attempts',
  lockoutDurationMinutes: 'security.lockout_duration_minutes',
  lockoutNotificationEmail: 'security.lockout_notification_email',
  activationLinkTtlHours: 'security.activation_link_ttl_hours',
  passwordResetLinkTtlHours: 'security.password_reset_link_ttl_hours',

  // Password Policy
  passwordMinLength: 'security.password_min_length',
  passwordMaxLength: 'security.password_max_length',
  passwordExpirationDays: 'security.password_expiration_days',
  passwordReuseFrequencyDays: 'security.password_reuse_frequency_days',
  passwordMinUppercase: 'security.password_min_uppercase',
  passwordMinLowercase: 'security.password_min_lowercase',
  passwordMinDigits: 'security.password_min_digits',
  passwordMinSpecialChars: 'security.password_min_special_chars',
  passwordRequireUppercase: 'security.password_require_uppercase',
  passwordRequireNumber: 'security.password_require_number',
  passwordRequireSpecial: 'security.password_require_special',
  passwordAllowWhitespace: 'security.password_allow_whitespace',
  forceResetIfInvalid: 'security.force_reset_if_invalid',

  // Session Settings
  sessionTimeoutMinutes: 'security.session_timeout_minutes',
  mfaEnabled: 'security.mfa_enabled',

  // JWT Settings
  jwtIssuer: 'security.jwt_issuer',
  jwtSigningKey: 'security.jwt_signing_key',

  // Rate limiting
  rateLimitRequestsPerMinute: 'rate_limit.requests_per_minute',
  rateLimitLoginAttempts: 'rate_limit.login_attempts',

  // Features
  selfRegistrationEnabled: 'features.self_registration_enabled',
  socialLoginEnabled: 'features.social_login_enabled',
} as const;

export function GeneralSettingsTab() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<{ data: PlatformSetting[] }>(
        '/platform/settings'
      );

      const newSettings = { ...DEFAULT_SETTINGS };

      for (const setting of response.data) {
        const key = Object.entries(SETTING_KEYS).find(
          ([, v]) => v === setting.key
        )?.[0] as keyof SettingsState | undefined;

        if (key) {
          (newSettings as any)[key] = setting.value;
        }
      }

      setSettings(newSettings);
      setOriginalSettings(newSettings);
    } catch (err: any) {
      if (err?.status === 403) {
        setError('Access denied. Super Admin privileges required.');
      } else {
        setError('Failed to load settings');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Save each changed setting
      for (const [key, value] of Object.entries(settings)) {
        const settingKey = SETTING_KEYS[key as keyof typeof SETTING_KEYS];
        const originalValue = originalSettings[key as keyof SettingsState];

        if (value !== originalValue) {
          await apiClient.put('/platform/settings', {
            key: settingKey,
            value,
          });
        }
      }

      setOriginalSettings(settings);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const generateSigningKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const key = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    setSettings({ ...settings, jwtSigningKey: key });
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && error.includes('Access denied')) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* Login Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Login Security
          </CardTitle>
          <CardDescription>
            Configure login attempt limits and account lockout settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxFailedLoginAttempts">Max Failed Login Attempts</Label>
              <Input
                id="maxFailedLoginAttempts"
                type="number"
                min={1}
                max={20}
                value={settings.maxFailedLoginAttempts}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxFailedLoginAttempts: parseInt(e.target.value) || 5,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Account locks after this many failed attempts
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockoutDurationMinutes">Lockout Duration (minutes)</Label>
              <Input
                id="lockoutDurationMinutes"
                type="number"
                min={1}
                max={1440}
                value={settings.lockoutDurationMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    lockoutDurationMinutes: parseInt(e.target.value) || 30,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                How long the account stays locked
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lockoutNotificationEmail">Lockout Notification Email</Label>
            <Input
              id="lockoutNotificationEmail"
              type="email"
              placeholder="security@example.com"
              value={settings.lockoutNotificationEmail}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  lockoutNotificationEmail: e.target.value,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Email address to notify when accounts are locked (optional)
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activationLinkTtlHours">Activation Link TTL (hours)</Label>
              <Input
                id="activationLinkTtlHours"
                type="number"
                min={1}
                max={168}
                value={settings.activationLinkTtlHours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    activationLinkTtlHours: parseInt(e.target.value) || 24,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                How long activation links remain valid
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordResetLinkTtlHours">Password Reset Link TTL (hours)</Label>
              <Input
                id="passwordResetLinkTtlHours"
                type="number"
                min={1}
                max={24}
                value={settings.passwordResetLinkTtlHours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordResetLinkTtlHours: parseInt(e.target.value) || 1,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                How long password reset links remain valid
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Password Policy
          </CardTitle>
          <CardDescription>
            Configure password requirements and complexity rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Length Requirements */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passwordMinLength">Minimum Length</Label>
              <Input
                id="passwordMinLength"
                type="number"
                min={6}
                max={32}
                value={settings.passwordMinLength}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordMinLength: parseInt(e.target.value) || 8,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordMaxLength">Maximum Length</Label>
              <Input
                id="passwordMaxLength"
                type="number"
                min={16}
                max={256}
                value={settings.passwordMaxLength}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordMaxLength: parseInt(e.target.value) || 128,
                  })
                }
              />
            </div>
          </div>

          {/* Expiration and Reuse */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passwordExpirationDays">Password Expiration (days)</Label>
              <Input
                id="passwordExpirationDays"
                type="number"
                min={0}
                max={365}
                value={settings.passwordExpirationDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordExpirationDays: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                0 = never expires
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordReuseFrequencyDays">Password Reuse Frequency (days)</Label>
              <Input
                id="passwordReuseFrequencyDays"
                type="number"
                min={0}
                max={365}
                value={settings.passwordReuseFrequencyDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordReuseFrequencyDays: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                0 = can reuse immediately
              </p>
            </div>
          </div>

          <Separator />

          {/* Character Requirements */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Character Requirements</h4>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passwordMinUppercase">Min Uppercase</Label>
                <Input
                  id="passwordMinUppercase"
                  type="number"
                  min={0}
                  max={10}
                  value={settings.passwordMinUppercase}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      passwordMinUppercase: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordMinLowercase">Min Lowercase</Label>
                <Input
                  id="passwordMinLowercase"
                  type="number"
                  min={0}
                  max={10}
                  value={settings.passwordMinLowercase}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      passwordMinLowercase: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordMinDigits">Min Digits</Label>
                <Input
                  id="passwordMinDigits"
                  type="number"
                  min={0}
                  max={10}
                  value={settings.passwordMinDigits}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      passwordMinDigits: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordMinSpecialChars">Min Special Chars</Label>
                <Input
                  id="passwordMinSpecialChars"
                  type="number"
                  min={0}
                  max={10}
                  value={settings.passwordMinSpecialChars}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      passwordMinSpecialChars: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Toggle Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Whitespace</Label>
                <p className="text-sm text-muted-foreground">
                  Allow spaces in passwords
                </p>
              </div>
              <Switch
                checked={settings.passwordAllowWhitespace}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, passwordAllowWhitespace: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Force Reset If Invalid</Label>
                <p className="text-sm text-muted-foreground">
                  Require password change if current password doesnt meet policy
                </p>
              </div>
              <Switch
                checked={settings.forceResetIfInvalid}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, forceResetIfInvalid: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session & JWT Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Session & JWT Settings
          </CardTitle>
          <CardDescription>
            Configure session timeout and JWT token settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min={5}
                max={1440}
                value={settings.sessionTimeoutMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    sessionTimeoutMinutes: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jwtIssuer">JWT Issuer</Label>
              <Input
                id="jwtIssuer"
                placeholder="https://your-domain.com"
                value={settings.jwtIssuer}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    jwtIssuer: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jwtSigningKey">JWT Signing Key</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <SecretInput
                  id="jwtSigningKey"
                  placeholder="Enter or generate a signing key"
                  value={settings.jwtSigningKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      jwtSigningKey: e.target.value,
                    })
                  }
                />
              </div>
              <Button type="button" variant="outline" onClick={generateSigningKey}>
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Used to sign JWT tokens. Keep this secret and secure.
            </p>
          </div>

          <Separator />

          {/* MFA */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Multi-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require MFA for all users platform-wide
              </p>
            </div>
            <Switch
              checked={settings.mfaEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, mfaEnabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Rate Limiting
          </CardTitle>
          <CardDescription>
            Configure API request limits to prevent abuse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rateLimitRequests">
                API Requests per Minute
              </Label>
              <Input
                id="rateLimitRequests"
                type="number"
                min={10}
                max={1000}
                value={settings.rateLimitRequestsPerMinute}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rateLimitRequestsPerMinute: parseInt(e.target.value) || 100,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rateLimitLogin">
                Max Login Attempts per Minute
              </Label>
              <Input
                id="rateLimitLogin"
                type="number"
                min={3}
                max={20}
                value={settings.rateLimitLoginAttempts}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rateLimitLoginAttempts: parseInt(e.target.value) || 5,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleLeft className="h-5 w-5" />
            Feature Toggles
          </CardTitle>
          <CardDescription>
            Enable or disable platform features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Self Registration</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to register without an invitation
              </p>
            </div>
            <Switch
              checked={settings.selfRegistrationEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, selfRegistrationEnabled: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Social Login</Label>
              <p className="text-sm text-muted-foreground">
                Allow login with Google, Microsoft, and other social providers
              </p>
            </div>
            <Switch
              checked={settings.socialLoginEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, socialLoginEnabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={fetchSettings}
          disabled={isSaving}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
