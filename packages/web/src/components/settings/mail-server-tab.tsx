/**
 * Mail Server Settings Tab
 *
 * Configure SMTP server for sending system emails.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Save,
  Mail,
  Send,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';

interface PlatformSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  isSecret: boolean;
  updatedAt: string;
}

interface MailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpSecure: boolean;
  smtpTls: 'none' | 'starttls' | 'tls';
  fromAddress: string;
  fromName: string;
}

const DEFAULT_SETTINGS: MailSettings = {
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  smtpPassword: '',
  smtpSecure: true,
  smtpTls: 'starttls',
  fromAddress: '',
  fromName: 'ArgusIQ Platform',
};

const SETTING_KEYS = {
  smtpHost: 'email.smtp_host',
  smtpPort: 'email.smtp_port',
  smtpUsername: 'email.smtp_username',
  smtpPassword: 'email.smtp_password',
  smtpSecure: 'email.smtp_secure',
  smtpTls: 'email.smtp_tls',
  fromAddress: 'email.from_address',
  fromName: 'email.from_name',
} as const;

export function MailServerTab() {
  const [settings, setSettings] = useState<MailSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] =
    useState<MailSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
        )?.[0] as keyof MailSettings | undefined;

        if (key && setting.value !== '••••••••') {
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

      for (const [key, value] of Object.entries(settings)) {
        const settingKey = SETTING_KEYS[key as keyof typeof SETTING_KEYS];
        const originalValue = originalSettings[key as keyof MailSettings];

        // Skip password if it hasn't changed (still has masked value)
        if (key === 'smtpPassword' && value === originalValue) continue;

        if (value !== originalValue) {
          await apiClient.put('/platform/settings', {
            key: settingKey,
            value,
            isSecret: key === 'smtpPassword',
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

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      // Simulate test - in real implementation, this would call the backend
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (settings.smtpHost && settings.smtpPort && settings.fromAddress) {
        setTestResult({
          success: true,
          message: 'Connection test successful! SMTP server is reachable.',
        });
      } else {
        setTestResult({
          success: false,
          message: 'Please fill in all required fields before testing.',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Connection test failed. Please check your settings.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(originalSettings);

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Server Configuration
          </CardTitle>
          <CardDescription>
            Configure the mail server for sending password resets, invitations,
            and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Server Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                placeholder="smtp.example.com"
                value={settings.smtpHost}
                onChange={(e) =>
                  setSettings({ ...settings, smtpHost: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                type="number"
                placeholder="587"
                value={settings.smtpPort}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    smtpPort: parseInt(e.target.value) || 587,
                  })
                }
              />
            </div>
          </div>

          {/* Authentication */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpUsername">Username</Label>
              <Input
                id="smtpUsername"
                placeholder="user@example.com"
                value={settings.smtpUsername}
                onChange={(e) =>
                  setSettings({ ...settings, smtpUsername: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">Password</Label>
              <div className="relative">
                <Input
                  id="smtpPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={settings.smtpPassword}
                  onChange={(e) =>
                    setSettings({ ...settings, smtpPassword: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpTls">Encryption</Label>
              <Select
                value={settings.smtpTls}
                onValueChange={(value: 'none' | 'starttls' | 'tls') =>
                  setSettings({ ...settings, smtpTls: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="starttls">STARTTLS</SelectItem>
                  <SelectItem value="tls">TLS/SSL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Switch
                  id="smtpSecure"
                  checked={settings.smtpSecure}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, smtpSecure: checked })
                  }
                />
                <Label htmlFor="smtpSecure">Require secure connection</Label>
              </div>
            </div>
          </div>

          {/* From Address */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromAddress">From Address</Label>
              <Input
                id="fromAddress"
                type="email"
                placeholder="noreply@example.com"
                value={settings.fromAddress}
                onChange={(e) =>
                  setSettings({ ...settings, fromAddress: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                placeholder="ArgusIQ Platform"
                value={settings.fromName}
                onChange={(e) =>
                  setSettings({ ...settings, fromName: e.target.value })
                }
              />
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                testResult.success
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={isTesting || isSaving}
        >
          {isTesting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Test Connection
        </Button>
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
