/**
 * Security General Tab
 * Contains General Policy, Password Policy, and JWT Security settings
 */

import { useState, useCallback } from 'react';
import { Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SecretInput } from '@/components/ui/secret-input';

interface GeneralPolicySettings {
  maxFailedLoginAttempts: number;
  lockoutNotificationEmail: string;
  activationLinkTtlHours: number;
  passwordResetLinkTtlHours: number;
}

interface PasswordPolicySettings {
  minLength: number;
  maxLength: number;
  expirationDays: number;
  reuseFrequencyDays: number;
  minUppercase: number;
  minLowercase: number;
  minDigits: number;
  minSpecialChars: number;
  allowWhitespace: boolean;
  forceResetIfInvalid: boolean;
}

interface JwtSettings {
  issuerName: string;
  signingKey: string;
}

interface SecuritySettings {
  generalPolicy: GeneralPolicySettings;
  passwordPolicy: PasswordPolicySettings;
  jwt: JwtSettings;
}

const defaultSettings: SecuritySettings = {
  generalPolicy: {
    maxFailedLoginAttempts: 5,
    lockoutNotificationEmail: 'security@argus.io',
    activationLinkTtlHours: 24,
    passwordResetLinkTtlHours: 24,
  },
  passwordPolicy: {
    minLength: 8,
    maxLength: 32,
    expirationDays: 90,
    reuseFrequencyDays: 365,
    minUppercase: 1,
    minLowercase: 1,
    minDigits: 1,
    minSpecialChars: 1,
    allowWhitespace: false,
    forceResetIfInvalid: true,
  },
  jwt: {
    issuerName: 'argus.platform',
    signingKey: '',
  },
};

export function SecurityGeneralTab() {
  const [settings, setSettings] = useState<SecuritySettings>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<SecuritySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateGeneralPolicy = useCallback(
    <K extends keyof GeneralPolicySettings>(key: K, value: GeneralPolicySettings[K]) => {
      setSettings((prev) => ({
        ...prev,
        generalPolicy: { ...prev.generalPolicy, [key]: value },
      }));
      setHasChanges(true);
    },
    []
  );

  const updatePasswordPolicy = useCallback(
    <K extends keyof PasswordPolicySettings>(key: K, value: PasswordPolicySettings[K]) => {
      setSettings((prev) => ({
        ...prev,
        passwordPolicy: { ...prev.passwordPolicy, [key]: value },
      }));
      setHasChanges(true);
    },
    []
  );

  const updateJwt = useCallback(<K extends keyof JwtSettings>(key: K, value: JwtSettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      jwt: { ...prev.jwt, [key]: value },
    }));
    setHasChanges(true);
  }, []);

  const generateSigningKey = useCallback(() => {
    // Generate a random 256-bit key (32 bytes) as base64
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const key = btoa(String.fromCharCode(...array));
    updateJwt('signingKey', key);
  }, [updateJwt]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // TODO: Implement API call to save settings
      // await apiClient.patch('/platform/security-settings', settings);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulated delay
      setOriginalSettings(settings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save security settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const handleUndo = useCallback(() => {
    setSettings(originalSettings);
    setHasChanges(false);
  }, [originalSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={handleUndo} disabled={!hasChanges || isSaving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Undo Changes
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

      {/* General Policy */}
      <Card>
        <CardHeader>
          <CardTitle>General Policy</CardTitle>
          <CardDescription>Login attempts and link expiration settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="maxFailedLoginAttempts">Max Failed Login Attempts</Label>
              <Input
                id="maxFailedLoginAttempts"
                type="number"
                min={1}
                max={20}
                value={settings.generalPolicy.maxFailedLoginAttempts}
                onChange={(e) =>
                  updateGeneralPolicy('maxFailedLoginAttempts', parseInt(e.target.value) || 5)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockoutNotificationEmail">Lockout Notification Email</Label>
              <Input
                id="lockoutNotificationEmail"
                type="email"
                value={settings.generalPolicy.lockoutNotificationEmail}
                onChange={(e) => updateGeneralPolicy('lockoutNotificationEmail', e.target.value)}
                placeholder="security@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="activationLinkTtlHours">Activation Link TTL (Hours)</Label>
              <Input
                id="activationLinkTtlHours"
                type="number"
                min={1}
                max={168}
                value={settings.generalPolicy.activationLinkTtlHours}
                onChange={(e) =>
                  updateGeneralPolicy('activationLinkTtlHours', parseInt(e.target.value) || 24)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordResetLinkTtlHours">Password Reset Link TTL (Hours)</Label>
              <Input
                id="passwordResetLinkTtlHours"
                type="number"
                min={1}
                max={168}
                value={settings.generalPolicy.passwordResetLinkTtlHours}
                onChange={(e) =>
                  updateGeneralPolicy('passwordResetLinkTtlHours', parseInt(e.target.value) || 24)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>Complexity and expiration requirements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Length and Expiration */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minLength">Min Length</Label>
              <Input
                id="minLength"
                type="number"
                min={6}
                max={32}
                value={settings.passwordPolicy.minLength}
                onChange={(e) =>
                  updatePasswordPolicy('minLength', parseInt(e.target.value) || 8)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxLength">Max Length</Label>
              <Input
                id="maxLength"
                type="number"
                min={16}
                max={128}
                value={settings.passwordPolicy.maxLength}
                onChange={(e) =>
                  updatePasswordPolicy('maxLength', parseInt(e.target.value) || 32)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expirationDays">Expiration (Days)</Label>
              <Input
                id="expirationDays"
                type="number"
                min={0}
                max={365}
                value={settings.passwordPolicy.expirationDays}
                onChange={(e) =>
                  updatePasswordPolicy('expirationDays', parseInt(e.target.value) || 90)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reuseFrequencyDays">Reuse Freq (Days)</Label>
              <Input
                id="reuseFrequencyDays"
                type="number"
                min={0}
                max={365}
                value={settings.passwordPolicy.reuseFrequencyDays}
                onChange={(e) =>
                  updatePasswordPolicy('reuseFrequencyDays', parseInt(e.target.value) || 365)
                }
              />
            </div>
          </div>

          {/* Character Requirements */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minUppercase">Min Uppercase</Label>
              <Input
                id="minUppercase"
                type="number"
                min={0}
                max={10}
                value={settings.passwordPolicy.minUppercase}
                onChange={(e) =>
                  updatePasswordPolicy('minUppercase', parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minLowercase">Min Lowercase</Label>
              <Input
                id="minLowercase"
                type="number"
                min={0}
                max={10}
                value={settings.passwordPolicy.minLowercase}
                onChange={(e) =>
                  updatePasswordPolicy('minLowercase', parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minDigits">Min Digits</Label>
              <Input
                id="minDigits"
                type="number"
                min={0}
                max={10}
                value={settings.passwordPolicy.minDigits}
                onChange={(e) =>
                  updatePasswordPolicy('minDigits', parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minSpecialChars">Min Special Chars</Label>
              <Input
                id="minSpecialChars"
                type="number"
                min={0}
                max={10}
                value={settings.passwordPolicy.minSpecialChars}
                onChange={(e) =>
                  updatePasswordPolicy('minSpecialChars', parseInt(e.target.value) || 0)
                }
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="allowWhitespace"
                checked={settings.passwordPolicy.allowWhitespace}
                onCheckedChange={(checked) => updatePasswordPolicy('allowWhitespace', checked)}
              />
              <Label htmlFor="allowWhitespace">Allow Whitespace</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="forceResetIfInvalid"
                checked={settings.passwordPolicy.forceResetIfInvalid}
                onCheckedChange={(checked) => updatePasswordPolicy('forceResetIfInvalid', checked)}
              />
              <Label htmlFor="forceResetIfInvalid">Force Reset if Invalid</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* JWT Security */}
      <Card>
        <CardHeader>
          <CardTitle>JWT Security</CardTitle>
          <CardDescription>Token issuance and signing configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="jwtIssuerName">JWT Issuer Name</Label>
            <Input
              id="jwtIssuerName"
              value={settings.jwt.issuerName}
              onChange={(e) => updateJwt('issuerName', e.target.value)}
              placeholder="your-platform.com"
            />
            <p className="text-xs text-muted-foreground">
              The issuer claim (iss) included in all JWT tokens
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signingKey">Signing Key</Label>
            <div className="flex gap-2">
              <SecretInput
                id="signingKey"
                value={settings.jwt.signingKey}
                onChange={(e) => updateJwt('signingKey', e.target.value)}
                placeholder="Enter or generate a signing key"
                className="flex-1"
              />
              <Button variant="outline" onClick={generateSigningKey}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The secret key used to sign JWT tokens. Keep this secure.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
