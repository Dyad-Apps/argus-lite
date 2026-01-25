/**
 * General Settings Tab
 *
 * Manages platform-wide security and feature settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Shield, ToggleLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  // Security settings
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  sessionTimeoutMinutes: number;
  mfaEnabled: boolean;
  // Rate limiting
  rateLimitRequestsPerMinute: number;
  rateLimitLoginAttempts: number;
  // Features
  selfRegistrationEnabled: boolean;
  socialLoginEnabled: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: false,
  sessionTimeoutMinutes: 30,
  mfaEnabled: false,
  rateLimitRequestsPerMinute: 100,
  rateLimitLoginAttempts: 5,
  selfRegistrationEnabled: false,
  socialLoginEnabled: false,
};

const SETTING_KEYS = {
  passwordMinLength: 'security.password_min_length',
  passwordRequireUppercase: 'security.password_require_uppercase',
  passwordRequireNumber: 'security.password_require_number',
  passwordRequireSpecial: 'security.password_require_special',
  sessionTimeoutMinutes: 'security.session_timeout_minutes',
  mfaEnabled: 'security.mfa_enabled',
  rateLimitRequestsPerMinute: 'rate_limit.requests_per_minute',
  rateLimitLoginAttempts: 'rate_limit.login_attempts',
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

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Configure password requirements and session security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Requirements */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Password Requirements</h4>
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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Uppercase Letter</Label>
                  <p className="text-sm text-muted-foreground">
                    Password must contain at least one uppercase letter
                  </p>
                </div>
                <Switch
                  checked={settings.passwordRequireUppercase}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, passwordRequireUppercase: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Number</Label>
                  <p className="text-sm text-muted-foreground">
                    Password must contain at least one number
                  </p>
                </div>
                <Switch
                  checked={settings.passwordRequireNumber}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, passwordRequireNumber: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Special Character</Label>
                  <p className="text-sm text-muted-foreground">
                    Password must contain at least one special character
                  </p>
                </div>
                <Switch
                  checked={settings.passwordRequireSpecial}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, passwordRequireSpecial: checked })
                  }
                />
              </div>
            </div>
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

          <Separator />

          {/* Rate Limiting */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Rate Limiting</h4>
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
                  Max Login Attempts
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
