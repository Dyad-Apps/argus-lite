/**
 * Two-Factor Authentication Tab
 *
 * Configure 2FA providers and security settings.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Save,
  Smartphone,
  MessageSquare,
  Mail,
  Key,
  Shield,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';

interface TwoFactorSettings {
  // Authenticator App
  authenticatorEnabled: boolean;
  authenticatorProvider: 'google' | 'microsoft' | 'authy' | '';
  authenticatorIssuerName: string;

  // SMS Verification
  smsVerificationEnabled: boolean;
  smsMessageTemplate: string;
  smsCodeLifetimeSeconds: number;

  // Email Verification
  emailVerificationEnabled: boolean;
  emailCodeLifetimeSeconds: number;

  // Backup Codes
  backupCodesEnabled: boolean;
  backupCodeCount: number;

  // Security Limitations
  totalAllowedTimeSeconds: number;
  retryPeriodSeconds: number;
  maxFailuresBeforeLockout: number;

  // Rate Limiting
  rateLimitingEnabled: boolean;
  rateLimitMaxRequests: number;
  rateLimitTimeWindowSeconds: number;
}

const DEFAULT_SETTINGS: TwoFactorSettings = {
  // Authenticator App
  authenticatorEnabled: false,
  authenticatorProvider: '',
  authenticatorIssuerName: '',

  // SMS Verification
  smsVerificationEnabled: false,
  smsMessageTemplate: 'Your verification code is: {{code}}',
  smsCodeLifetimeSeconds: 300,

  // Email Verification
  emailVerificationEnabled: false,
  emailCodeLifetimeSeconds: 600,

  // Backup Codes
  backupCodesEnabled: false,
  backupCodeCount: 10,

  // Security Limitations
  totalAllowedTimeSeconds: 300,
  retryPeriodSeconds: 30,
  maxFailuresBeforeLockout: 5,

  // Rate Limiting
  rateLimitingEnabled: true,
  rateLimitMaxRequests: 5,
  rateLimitTimeWindowSeconds: 60,
};

export function TwoFactorTab() {
  const [settings, setSettings] = useState<TwoFactorSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] =
    useState<TwoFactorSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient
        .get<{ data: TwoFactorSettings }>('/platform/settings/2fa')
        .catch(() => ({ data: DEFAULT_SETTINGS }));
      setSettings(response.data || DEFAULT_SETTINGS);
      setOriginalSettings(response.data || DEFAULT_SETTINGS);
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
      await apiClient.put('/platform/settings/2fa', settings);
      setOriginalSettings(settings);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const noProvidersEnabled =
    !settings.authenticatorEnabled &&
    !settings.smsVerificationEnabled &&
    !settings.emailVerificationEnabled;

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

      {/* Warning when no providers enabled */}
      {noProvidersEnabled && (
        <div className="bg-orange-500/10 text-orange-700 dark:text-orange-400 px-4 py-3 rounded-md flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>
            No 2FA providers are enabled. Enable at least one provider to use
            two-factor authentication.
          </span>
        </div>
      )}

      {/* 2FA Providers */}
      <Card>
        <CardHeader>
          <CardTitle>2FA Providers</CardTitle>
          <CardDescription>
            Enable and configure two-factor authentication methods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authenticator App */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-base">Authenticator App</Label>
                  <p className="text-sm text-muted-foreground">
                    Time-based one-time passwords (TOTP)
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.authenticatorEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, authenticatorEnabled: checked })
                }
              />
            </div>
            {settings.authenticatorEnabled && (
              <div className="ml-12 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={settings.authenticatorProvider}
                      onValueChange={(value) =>
                        setSettings({
                          ...settings,
                          authenticatorProvider:
                            value as TwoFactorSettings['authenticatorProvider'],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google">Google Authenticator</SelectItem>
                        <SelectItem value="microsoft">Microsoft Authenticator</SelectItem>
                        <SelectItem value="authy">Authy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authenticatorIssuerName">Issuer Name</Label>
                    <Input
                      id="authenticatorIssuerName"
                      placeholder="Your App Name"
                      value={settings.authenticatorIssuerName}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          authenticatorIssuerName: e.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Displayed in the authenticator app
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* SMS Verification */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-500/10 p-2">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <Label className="text-base">SMS Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Send verification codes via SMS
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.smsVerificationEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, smsVerificationEnabled: checked })
                }
              />
            </div>
            {settings.smsVerificationEnabled && (
              <div className="ml-12 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="smsMessageTemplate">Message Template</Label>
                  <Textarea
                    id="smsMessageTemplate"
                    placeholder="Your verification code is: {{code}}"
                    value={settings.smsMessageTemplate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        smsMessageTemplate: e.target.value,
                      })
                    }
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{code}}"} as placeholder for the verification code
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smsCodeLifetime">Code Lifetime (seconds)</Label>
                  <Input
                    id="smsCodeLifetime"
                    type="number"
                    min={60}
                    max={900}
                    value={settings.smsCodeLifetimeSeconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        smsCodeLifetimeSeconds: parseInt(e.target.value) || 300,
                      })
                    }
                    className="max-w-[150px]"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Email Verification */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <Label className="text-base">Email Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Send verification codes via email
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.emailVerificationEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailVerificationEnabled: checked })
                }
              />
            </div>
            {settings.emailVerificationEnabled && (
              <div className="ml-12 space-y-2">
                <Label htmlFor="emailCodeLifetime">Code Lifetime (seconds)</Label>
                <Input
                  id="emailCodeLifetime"
                  type="number"
                  min={60}
                  max={1800}
                  value={settings.emailCodeLifetimeSeconds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailCodeLifetimeSeconds: parseInt(e.target.value) || 600,
                    })
                  }
                  className="max-w-[150px]"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Backup Codes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-500/10 p-2">
                  <Key className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <Label className="text-base">Backup Codes</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate one-time use backup codes
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.backupCodesEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, backupCodesEnabled: checked })
                }
              />
            </div>
            {settings.backupCodesEnabled && (
              <div className="ml-12 space-y-2">
                <Label htmlFor="backupCodeCount">Number of Codes</Label>
                <Input
                  id="backupCodeCount"
                  type="number"
                  min={5}
                  max={20}
                  value={settings.backupCodeCount}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      backupCodeCount: parseInt(e.target.value) || 10,
                    })
                  }
                  className="max-w-[150px]"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Limitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Limitations
          </CardTitle>
          <CardDescription>
            Configure timing and failure limits for 2FA verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalAllowedTime">Total Allowed Time (seconds)</Label>
              <Input
                id="totalAllowedTime"
                type="number"
                min={60}
                max={900}
                value={settings.totalAllowedTimeSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    totalAllowedTimeSeconds: parseInt(e.target.value) || 300,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Max time to complete 2FA
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retryPeriod">Retry Period (seconds)</Label>
              <Input
                id="retryPeriod"
                type="number"
                min={10}
                max={120}
                value={settings.retryPeriodSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    retryPeriodSeconds: parseInt(e.target.value) || 30,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Wait time between retries
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxFailures">Max Failures Before Lockout</Label>
              <Input
                id="maxFailures"
                type="number"
                min={3}
                max={10}
                value={settings.maxFailuresBeforeLockout}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxFailuresBeforeLockout: parseInt(e.target.value) || 5,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Failed attempts before lockout
              </p>
            </div>
          </div>

          <Separator />

          {/* Rate Limiting */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Rate Limiting</Label>
                <p className="text-sm text-muted-foreground">
                  Limit verification requests to prevent abuse
                </p>
              </div>
              <Switch
                checked={settings.rateLimitingEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, rateLimitingEnabled: checked })
                }
              />
            </div>
            {settings.rateLimitingEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateLimitMaxRequests">Max Requests</Label>
                  <Input
                    id="rateLimitMaxRequests"
                    type="number"
                    min={1}
                    max={20}
                    value={settings.rateLimitMaxRequests}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        rateLimitMaxRequests: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimitTimeWindow">Time Window (seconds)</Label>
                  <Input
                    id="rateLimitTimeWindow"
                    type="number"
                    min={30}
                    max={300}
                    value={settings.rateLimitTimeWindowSeconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        rateLimitTimeWindowSeconds: parseInt(e.target.value) || 60,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={fetchSettings} disabled={isSaving}>
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
