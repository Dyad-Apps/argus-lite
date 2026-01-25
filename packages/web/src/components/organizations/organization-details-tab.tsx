import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Organization {
  id: string;
  name: string;
  orgCode: string;
  slug: string;
  description?: string;
  path?: string;
  depth: number;
  isActive: boolean;
  isRoot: boolean;
  canHaveChildren: boolean;
  plan: string;
  profileId?: string;
  parentOrganizationId?: string;
  subdomain?: string;
  settings?: {
    timezone?: string;
    locale?: string;
    features?: {
      allowWhiteLabeling?: boolean;
      allowImpersonation?: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface OrganizationDetailsTabProps {
  organization: Organization;
  onUpdated: () => void;
}

export function OrganizationDetailsTab({ organization, onUpdated }: OrganizationDetailsTabProps) {
  const [formData, setFormData] = useState({
    name: organization.name,
    description: organization.description || '',
    isActive: organization.isActive,
    canHaveChildren: organization.canHaveChildren,
    plan: organization.plan,
    timezone: organization.settings?.timezone || '',
    locale: organization.settings?.locale || '',
    allowWhiteLabeling: organization.settings?.features?.allowWhiteLabeling || false,
    allowImpersonation: organization.settings?.features?.allowImpersonation || false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      await apiClient.patch(`/organizations/${organization.id}`, {
        name: formData.name,
        description: formData.description || undefined,
        isActive: formData.isActive,
        canHaveChildren: formData.canHaveChildren,
        plan: formData.plan,
        settings: {
          timezone: formData.timezone || undefined,
          locale: formData.locale || undefined,
          features: {
            allowWhiteLabeling: formData.allowWhiteLabeling,
            allowImpersonation: formData.allowImpersonation,
          },
        },
      });

      setSuccess(true);
      onUpdated();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update organization:', err);
      const message = err?.data?.error?.message || 'Failed to update organization';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
  };

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ];

  const locales = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'fr-FR', label: 'French' },
    { value: 'de-DE', label: 'German' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'zh-CN', label: 'Chinese (Simplified)' },
  ];

  const plans = ['free', 'starter', 'professional', 'enterprise'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-green-700 text-sm">
          Organization updated successfully.
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Core organization details and identification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgCode">Organization Code</Label>
              <Input
                id="orgCode"
                value={organization.orgCode}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Organization code cannot be changed
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={organization.slug}
                disabled
                className="bg-muted"
              />
            </div>
            {organization.isRoot && (
              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input
                  id="subdomain"
                  value={organization.subdomain || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder="Optional description for the organization"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Select
              value={formData.plan}
              onValueChange={(value) => updateFormData('plan', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    <span className="capitalize">{plan}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Status & Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Capabilities</CardTitle>
          <CardDescription>
            Control organization status and what it can do
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Whether this organization is active and accessible
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => updateFormData('isActive', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Can Have Children</Label>
              <p className="text-sm text-muted-foreground">
                Allow this organization to create child organizations
              </p>
            </div>
            <Switch
              checked={formData.canHaveChildren}
              onCheckedChange={(checked) => updateFormData('canHaveChildren', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>White Labeling</Label>
              <p className="text-sm text-muted-foreground">
                Allow custom branding and appearance
              </p>
            </div>
            <Switch
              checked={formData.allowWhiteLabeling}
              onCheckedChange={(checked) => updateFormData('allowWhiteLabeling', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Impersonation</Label>
              <p className="text-sm text-muted-foreground">
                Allow platform admins to sign in as users
              </p>
            </div>
            <Switch
              checked={formData.allowImpersonation}
              onCheckedChange={(checked) => updateFormData('allowImpersonation', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
          <CardDescription>Timezone and locale preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => updateFormData('timezone', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">Locale</Label>
              <Select
                value={formData.locale}
                onValueChange={(value) => updateFormData('locale', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select locale" />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((locale) => (
                    <SelectItem key={locale.value} value={locale.value}>
                      {locale.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </form>
  );
}
