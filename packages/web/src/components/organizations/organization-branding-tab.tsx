import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Upload, X, Palette, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
}

interface OrganizationBranding {
  id: string;
  organizationId: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  loginBackgroundType: 'default' | 'image' | 'particles' | 'solid';
  loginBackgroundUrl: string | null;
  loginBackgroundColor: string | null;
  loginWelcomeText: string | null;
  loginSubtitle: string | null;
  customCss: string | null;
}

interface OrganizationBrandingTabProps {
  organization: Organization;
  onUpdated: () => void;
}

const defaultBranding: Omit<OrganizationBranding, 'id' | 'organizationId'> = {
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  primaryColor: null,
  accentColor: null,
  loginBackgroundType: 'default',
  loginBackgroundUrl: null,
  loginBackgroundColor: null,
  loginWelcomeText: null,
  loginSubtitle: null,
  customCss: null,
};

export function OrganizationBrandingTab({ organization, onUpdated }: OrganizationBrandingTabProps) {
  const [branding, setBranding] = useState<Omit<OrganizationBranding, 'id' | 'organizationId'>>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<OrganizationBranding>(
        `/organizations/${organization.id}/branding`
      );
      setBranding({
        logoUrl: response.logoUrl,
        logoDarkUrl: response.logoDarkUrl,
        faviconUrl: response.faviconUrl,
        primaryColor: response.primaryColor,
        accentColor: response.accentColor,
        loginBackgroundType: response.loginBackgroundType,
        loginBackgroundUrl: response.loginBackgroundUrl,
        loginBackgroundColor: response.loginBackgroundColor,
        loginWelcomeText: response.loginWelcomeText,
        loginSubtitle: response.loginSubtitle,
        customCss: response.customCss,
      });
    } catch (err: any) {
      // If 404, branding doesn't exist yet - use defaults
      if (err?.status !== 404) {
        console.error('Failed to fetch branding:', err);
        setError('Failed to load branding settings');
      }
    } finally {
      setIsLoading(false);
    }
  }, [organization.id]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      await apiClient.patch(`/organizations/${organization.id}/branding`, {
        logoUrl: branding.logoUrl || null,
        logoDarkUrl: branding.logoDarkUrl || null,
        faviconUrl: branding.faviconUrl || null,
        primaryColor: branding.primaryColor || null,
        accentColor: branding.accentColor || null,
        loginBackgroundType: branding.loginBackgroundType,
        loginBackgroundUrl: branding.loginBackgroundUrl || null,
        loginBackgroundColor: branding.loginBackgroundColor || null,
        loginWelcomeText: branding.loginWelcomeText || null,
        loginSubtitle: branding.loginSubtitle || null,
        customCss: branding.customCss || null,
      });

      setSuccess(true);
      onUpdated();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save branding:', err);
      const message = err?.data?.error?.message || 'Failed to save branding settings';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateBranding = <K extends keyof typeof branding>(
    field: K,
    value: (typeof branding)[K]
  ) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
  };

  const backgroundTypes = [
    { value: 'default', label: 'Default' },
    { value: 'image', label: 'Custom Image' },
    { value: 'particles', label: 'Animated Particles' },
    { value: 'solid', label: 'Solid Color' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-green-700 text-sm">
          Branding settings saved successfully.
        </div>
      )}

      {/* Logo & Favicon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo & Favicon
          </CardTitle>
          <CardDescription>
            Upload your organization's logo and favicon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (Light Mode)</Label>
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                value={branding.logoUrl || ''}
                onChange={(e) => updateBranding('logoUrl', e.target.value || null)}
              />
              {branding.logoUrl && (
                <div className="mt-2 p-4 bg-white border rounded-lg">
                  <img
                    src={branding.logoUrl}
                    alt="Logo preview"
                    className="max-h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoDarkUrl">Logo URL (Dark Mode)</Label>
              <Input
                id="logoDarkUrl"
                placeholder="https://example.com/logo-dark.png"
                value={branding.logoDarkUrl || ''}
                onChange={(e) => updateBranding('logoDarkUrl', e.target.value || null)}
              />
              {branding.logoDarkUrl && (
                <div className="mt-2 p-4 bg-slate-900 border rounded-lg">
                  <img
                    src={branding.logoDarkUrl}
                    alt="Logo dark preview"
                    className="max-h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="faviconUrl">Favicon URL</Label>
            <Input
              id="faviconUrl"
              placeholder="https://example.com/favicon.ico"
              value={branding.faviconUrl || ''}
              onChange={(e) => updateBranding('faviconUrl', e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Colors
          </CardTitle>
          <CardDescription>
            Customize the primary and accent colors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  placeholder="#1890FF"
                  value={branding.primaryColor || ''}
                  onChange={(e) => updateBranding('primaryColor', e.target.value || null)}
                  className="font-mono"
                />
                <Input
                  type="color"
                  value={branding.primaryColor || '#1890FF'}
                  onChange={(e) => updateBranding('primaryColor', e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accentColor"
                  placeholder="#52C41A"
                  value={branding.accentColor || ''}
                  onChange={(e) => updateBranding('accentColor', e.target.value || null)}
                  className="font-mono"
                />
                <Input
                  type="color"
                  value={branding.accentColor || '#52C41A'}
                  onChange={(e) => updateBranding('accentColor', e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Color Preview */}
          <div className="flex gap-4 mt-4">
            <div className="text-sm text-muted-foreground">Preview:</div>
            <div
              className="h-8 w-24 rounded"
              style={{ backgroundColor: branding.primaryColor || '#1890FF' }}
            />
            <div
              className="h-8 w-24 rounded"
              style={{ backgroundColor: branding.accentColor || '#52C41A' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Login Page */}
      <Card>
        <CardHeader>
          <CardTitle>Login Page Customization</CardTitle>
          <CardDescription>
            Customize the appearance of the login page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loginWelcomeText">Welcome Text</Label>
              <Input
                id="loginWelcomeText"
                placeholder="Welcome to Our Platform"
                value={branding.loginWelcomeText || ''}
                onChange={(e) => updateBranding('loginWelcomeText', e.target.value || null)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loginSubtitle">Subtitle</Label>
              <Input
                id="loginSubtitle"
                placeholder="Sign in to continue"
                value={branding.loginSubtitle || ''}
                onChange={(e) => updateBranding('loginSubtitle', e.target.value || null)}
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loginBackgroundType">Background Type</Label>
            <Select
              value={branding.loginBackgroundType}
              onValueChange={(value: OrganizationBranding['loginBackgroundType']) =>
                updateBranding('loginBackgroundType', value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select background type" />
              </SelectTrigger>
              <SelectContent>
                {backgroundTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {branding.loginBackgroundType === 'image' && (
            <div className="space-y-2">
              <Label htmlFor="loginBackgroundUrl">Background Image URL</Label>
              <Input
                id="loginBackgroundUrl"
                placeholder="https://example.com/background.jpg"
                value={branding.loginBackgroundUrl || ''}
                onChange={(e) => updateBranding('loginBackgroundUrl', e.target.value || null)}
              />
            </div>
          )}

          {branding.loginBackgroundType === 'solid' && (
            <div className="space-y-2">
              <Label htmlFor="loginBackgroundColor">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="loginBackgroundColor"
                  placeholder="#F0F2F5"
                  value={branding.loginBackgroundColor || ''}
                  onChange={(e) => updateBranding('loginBackgroundColor', e.target.value || null)}
                  className="font-mono"
                />
                <Input
                  type="color"
                  value={branding.loginBackgroundColor || '#F0F2F5'}
                  onChange={(e) => updateBranding('loginBackgroundColor', e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom CSS */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Customization</CardTitle>
          <CardDescription>
            Add custom CSS for advanced styling (Enterprise only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customCss">Custom CSS</Label>
            <Textarea
              id="customCss"
              placeholder="/* Add custom CSS here */
.header {
  background-color: var(--primary);
}"
              value={branding.customCss || ''}
              onChange={(e) => updateBranding('customCss', e.target.value || null)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Maximum 10,000 characters. Use with caution.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Branding
        </Button>
      </div>
    </div>
  );
}
