/**
 * Notification Settings Tab
 *
 * Configure SMS, Slack, and Firebase push notification providers.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Save,
  MessageSquare,
  Smartphone,
  Bell,
  RefreshCw,
  Send,
  Hash,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SecretInput } from '@/components/ui/secret-input';
import { apiClient } from '@/lib/api-client';

interface NotificationSettings {
  // SMS Provider
  smsEnabled: boolean;
  smsProvider: 'twilio' | 'nexmo' | 'aws_sns' | '';
  smsFromNumber: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  nexmoApiKey: string;
  nexmoApiSecret: string;
  awsSnsRegion: string;
  awsSnsAccessKey: string;
  awsSnsSecretKey: string;

  // Slack Integration
  slackEnabled: boolean;
  slackBotToken: string;
  slackDefaultChannel: string;

  // Firebase Push
  firebaseEnabled: boolean;
  firebaseCredentialMethod: 'upload' | 'secret_reference' | '';
  firebaseServiceAccountJson: string;
  firebaseSecretReference: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  // SMS Provider
  smsEnabled: false,
  smsProvider: '',
  smsFromNumber: '',
  twilioAccountSid: '',
  twilioAuthToken: '',
  nexmoApiKey: '',
  nexmoApiSecret: '',
  awsSnsRegion: 'us-east-1',
  awsSnsAccessKey: '',
  awsSnsSecretKey: '',

  // Slack Integration
  slackEnabled: false,
  slackBotToken: '',
  slackDefaultChannel: '',

  // Firebase Push
  firebaseEnabled: false,
  firebaseCredentialMethod: '',
  firebaseServiceAccountJson: '',
  firebaseSecretReference: '',
};

interface TestSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationSettingsTab() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [testSmsNumber, setTestSmsNumber] = useState('');
  const [testSmsResult, setTestSmsResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to fetch notification settings from platform settings
      try {
        const response = await apiClient.get<{
          id: string;
          key: string;
          value: unknown;
          description: string | null;
          isSecret: boolean;
          updatedBy: string | null;
          updatedAt: string;
        }>('/platform/settings/notifications');

        const notificationSettings = response.value as NotificationSettings;
        setSettings(notificationSettings || DEFAULT_SETTINGS);
        setOriginalSettings(notificationSettings || DEFAULT_SETTINGS);
      } catch (err: any) {
        // If setting doesn't exist (404), use defaults
        if (err?.status === 404) {
          setSettings(DEFAULT_SETTINGS);
          setOriginalSettings(DEFAULT_SETTINGS);
        } else if (err?.status === 403) {
          setError('Access denied. Super Admin privileges required.');
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      setError('Failed to load settings');
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

      // Platform settings API expects key, value, description format
      await apiClient.put('/platform/settings', {
        key: 'notifications',
        value: settings,
        description: 'Platform notification provider configuration',
        isSecret: false,
      });

      setOriginalSettings(settings);
      await fetchSettings(); // Refresh to confirm save
    } catch (err: any) {
      if (err?.status === 403) {
        setError('Access denied. Super Admin privileges required.');
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSms = async () => {
    if (!testSmsNumber) return;
    try {
      setIsTestingSms(true);
      setTestSmsResult(null);
      await apiClient.post('/platform/settings/test-sms', {
        phoneNumber: testSmsNumber,
      });
      setTestSmsResult({ success: true, message: 'Test SMS sent successfully!' });
    } catch (err) {
      setTestSmsResult({ success: false, message: 'Failed to send test SMS' });
    } finally {
      setIsTestingSms(false);
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

      {/* SMS Provider Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                SMS Provider
              </CardTitle>
              <CardDescription>
                Configure SMS delivery for verification codes and alerts.
              </CardDescription>
            </div>
            <Switch
              checked={settings.smsEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, smsEnabled: checked })
              }
            />
          </div>
        </CardHeader>
        {settings.smsEnabled && (
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={settings.smsProvider}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      smsProvider: value as NotificationSettings['smsProvider'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select SMS provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="nexmo">Nexmo (Vonage)</SelectItem>
                    <SelectItem value="aws_sns">AWS SNS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smsFromNumber">From Number (E.164)</Label>
                <Input
                  id="smsFromNumber"
                  placeholder="+15551234567"
                  value={settings.smsFromNumber}
                  onChange={(e) =>
                    setSettings({ ...settings, smsFromNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Twilio Settings */}
            {settings.smsProvider === 'twilio' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Twilio Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="twilioAccountSid">Account SID</Label>
                    <Input
                      id="twilioAccountSid"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.twilioAccountSid}
                      onChange={(e) =>
                        setSettings({ ...settings, twilioAccountSid: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twilioAuthToken">Auth Token</Label>
                    <SecretInput
                      id="twilioAuthToken"
                      placeholder="Enter Auth Token"
                      value={settings.twilioAuthToken}
                      onChange={(e) =>
                        setSettings({ ...settings, twilioAuthToken: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Nexmo Settings */}
            {settings.smsProvider === 'nexmo' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Nexmo (Vonage) Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nexmoApiKey">API Key</Label>
                    <Input
                      id="nexmoApiKey"
                      placeholder="Enter API Key"
                      value={settings.nexmoApiKey}
                      onChange={(e) =>
                        setSettings({ ...settings, nexmoApiKey: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nexmoApiSecret">API Secret</Label>
                    <SecretInput
                      id="nexmoApiSecret"
                      placeholder="Enter API Secret"
                      value={settings.nexmoApiSecret}
                      onChange={(e) =>
                        setSettings({ ...settings, nexmoApiSecret: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AWS SNS Settings */}
            {settings.smsProvider === 'aws_sns' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">AWS SNS Configuration</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="awsSnsRegion">AWS Region</Label>
                    <Select
                      value={settings.awsSnsRegion}
                      onValueChange={(value) =>
                        setSettings({ ...settings, awsSnsRegion: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                        <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                        <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                        <SelectItem value="ap-southeast-1">
                          Asia Pacific (Singapore)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="awsSnsAccessKey">Access Key ID</Label>
                      <Input
                        id="awsSnsAccessKey"
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        value={settings.awsSnsAccessKey}
                        onChange={(e) =>
                          setSettings({ ...settings, awsSnsAccessKey: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsSnsSecretKey">Secret Access Key</Label>
                      <SecretInput
                        id="awsSnsSecretKey"
                        placeholder="Enter Secret Key"
                        value={settings.awsSnsSecretKey}
                        onChange={(e) =>
                          setSettings({ ...settings, awsSnsSecretKey: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test SMS */}
            {settings.smsProvider && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Test SMS</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="+15551234567"
                      value={testSmsNumber}
                      onChange={(e) => setTestSmsNumber(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button
                      variant="outline"
                      onClick={handleTestSms}
                      disabled={!testSmsNumber || isTestingSms}
                    >
                      {isTestingSms ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send Test SMS
                    </Button>
                  </div>
                  {testSmsResult && (
                    <p
                      className={`text-sm ${testSmsResult.success ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {testSmsResult.message}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Slack Integration
              </CardTitle>
              <CardDescription>
                Send notifications to Slack channels.
              </CardDescription>
            </div>
            <Switch
              checked={settings.slackEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, slackEnabled: checked })
              }
            />
          </div>
        </CardHeader>
        {settings.slackEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slackBotToken">Bot OAuth Token</Label>
              <SecretInput
                id="slackBotToken"
                placeholder="xoxb-..."
                value={settings.slackBotToken}
                onChange={(e) =>
                  setSettings({ ...settings, slackBotToken: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Required scopes: chat:write, channels:read, users:read
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slackDefaultChannel">Default Channel</Label>
              <Input
                id="slackDefaultChannel"
                placeholder="#notifications"
                value={settings.slackDefaultChannel}
                onChange={(e) =>
                  setSettings({ ...settings, slackDefaultChannel: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Channel to send notifications when no specific channel is specified
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Firebase Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Mobile Push (Firebase)
              </CardTitle>
              <CardDescription>
                Configure Firebase Cloud Messaging for mobile push notifications.
              </CardDescription>
            </div>
            <Switch
              checked={settings.firebaseEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, firebaseEnabled: checked })
              }
            />
          </div>
        </CardHeader>
        {settings.firebaseEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Credential Method</Label>
              <RadioGroup
                value={settings.firebaseCredentialMethod}
                onValueChange={(value) =>
                  setSettings({
                    ...settings,
                    firebaseCredentialMethod:
                      value as NotificationSettings['firebaseCredentialMethod'],
                  })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upload" id="upload" />
                  <Label htmlFor="upload" className="font-normal">
                    Upload Service Account JSON
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="secret_reference" id="secret_reference" />
                  <Label htmlFor="secret_reference" className="font-normal">
                    Reference External Secret
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {settings.firebaseCredentialMethod === 'upload' && (
              <div className="space-y-2">
                <Label htmlFor="firebaseServiceAccountJson">
                  Service Account JSON
                </Label>
                <Textarea
                  id="firebaseServiceAccountJson"
                  placeholder='{"type": "service_account", ...}'
                  rows={6}
                  value={settings.firebaseServiceAccountJson}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      firebaseServiceAccountJson: e.target.value,
                    })
                  }
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Paste the contents of your Firebase service account JSON file
                </p>
              </div>
            )}

            {settings.firebaseCredentialMethod === 'secret_reference' && (
              <div className="space-y-2">
                <Label htmlFor="firebaseSecretReference">Secret Reference</Label>
                <Input
                  id="firebaseSecretReference"
                  placeholder="aws-secretsmanager:firebase-credentials"
                  value={settings.firebaseSecretReference}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      firebaseSecretReference: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Reference to credentials stored in an external secret manager
                </p>
              </div>
            )}
          </CardContent>
        )}
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
