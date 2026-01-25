/**
 * Branding Editor
 *
 * Editor for platform-wide branding configuration including logos, colors, and login page.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Save,
  RefreshCw,
  Upload,
  Palette,
  Globe,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api-client';

interface PlatformBranding {
  id: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  loginBackgroundType: string;
  loginBackgroundUrl: string | null;
  loginWelcomeText: string | null;
  loginSubtitle: string | null;
  termsOfServiceUrl: string | null;
  privacyPolicyUrl: string | null;
  supportUrl: string | null;
  updatedAt: string;
}

interface BrandingState {
  logoUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  loginBackgroundType: string;
  loginBackgroundUrl: string;
  loginWelcomeText: string;
  loginSubtitle: string;
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  supportUrl: string;
}

const DEFAULT_BRANDING: BrandingState = {
  logoUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
  primaryColor: '#1890FF',
  accentColor: '#FF6B6B',
  loginBackgroundType: 'particles',
  loginBackgroundUrl: '',
  loginWelcomeText: 'Welcome',
  loginSubtitle: 'Sign in to your account',
  termsOfServiceUrl: '',
  privacyPolicyUrl: '',
  supportUrl: '',
};

export function BrandingEditor() {
  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING);
  const [originalBranding, setOriginalBranding] =
    useState<BrandingState>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<PlatformBranding | null>(
        '/platform/branding'
      );

      if (response) {
        const newBranding: BrandingState = {
          logoUrl: response.logoUrl || '',
          logoDarkUrl: response.logoDarkUrl || '',
          faviconUrl: response.faviconUrl || '',
          primaryColor: response.primaryColor || '#1890FF',
          accentColor: response.accentColor || '#FF6B6B',
          loginBackgroundType: response.loginBackgroundType || 'particles',
          loginBackgroundUrl: response.loginBackgroundUrl || '',
          loginWelcomeText: response.loginWelcomeText || 'Welcome',
          loginSubtitle: response.loginSubtitle || 'Sign in to your account',
          termsOfServiceUrl: response.termsOfServiceUrl || '',
          privacyPolicyUrl: response.privacyPolicyUrl || '',
          supportUrl: response.supportUrl || '',
        };
        setBranding(newBranding);
        setOriginalBranding(newBranding);
      }
    } catch (err: any) {
      if (err?.status === 403) {
        setError('Access denied. Super Admin privileges required.');
      } else {
        setError('Failed to load branding settings');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      await apiClient.patch('/platform/branding', {
        logoUrl: branding.logoUrl || null,
        logoDarkUrl: branding.logoDarkUrl || null,
        faviconUrl: branding.faviconUrl || null,
        primaryColor: branding.primaryColor || null,
        accentColor: branding.accentColor || null,
        loginBackgroundType: branding.loginBackgroundType,
        loginBackgroundUrl: branding.loginBackgroundUrl || null,
        loginWelcomeText: branding.loginWelcomeText || null,
        loginSubtitle: branding.loginSubtitle || null,
        termsOfServiceUrl: branding.termsOfServiceUrl || null,
        privacyPolicyUrl: branding.privacyPolicyUrl || null,
        supportUrl: branding.supportUrl || null,
      });

      setOriginalBranding(branding);
    } catch (err) {
      setError('Failed to save branding settings');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify(branding) !== JSON.stringify(originalBranding);

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

      {/* Logo & Favicon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Logo & Favicon
          </CardTitle>
          <CardDescription>
            Upload your organization's logo and favicon for branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (Light Mode)</Label>
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                value={branding.logoUrl}
                onChange={(e) =>
                  setBranding({ ...branding, logoUrl: e.target.value })
                }
              />
              {branding.logoUrl && (
                <div className="mt-2 p-4 bg-white rounded border">
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
                value={branding.logoDarkUrl}
                onChange={(e) =>
                  setBranding({ ...branding, logoDarkUrl: e.target.value })
                }
              />
              {branding.logoDarkUrl && (
                <div className="mt-2 p-4 bg-gray-900 rounded border">
                  <img
                    src={branding.logoDarkUrl}
                    alt="Dark logo preview"
                    className="max-h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="faviconUrl">Favicon URL</Label>
              <Input
                id="faviconUrl"
                placeholder="https://example.com/favicon.ico"
                value={branding.faviconUrl}
                onChange={(e) =>
                  setBranding({ ...branding, faviconUrl: e.target.value })
                }
              />
              {branding.faviconUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={branding.faviconUrl}
                    alt="Favicon preview"
                    className="w-6 h-6"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    Favicon preview
                  </span>
                </div>
              )}
            </div>
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
            Define your brand's primary and accent colors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding({ ...branding, primaryColor: e.target.value })
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding({ ...branding, primaryColor: e.target.value })
                  }
                  placeholder="#1890FF"
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Used for buttons, links, and primary UI elements
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accentColor"
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) =>
                    setBranding({ ...branding, accentColor: e.target.value })
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={branding.accentColor}
                  onChange={(e) =>
                    setBranding({ ...branding, accentColor: e.target.value })
                  }
                  placeholder="#FF6B6B"
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Used for highlights and secondary UI elements
              </p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-6 p-4 border rounded-lg">
            <p className="text-sm font-medium mb-3">Preview</p>
            <div className="flex gap-4">
              <button
                className="px-4 py-2 text-white rounded-md text-sm font-medium"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Primary Button
              </button>
              <button
                className="px-4 py-2 text-white rounded-md text-sm font-medium"
                style={{ backgroundColor: branding.accentColor }}
              >
                Accent Button
              </button>
              <span
                className="px-4 py-2 underline cursor-pointer text-sm"
                style={{ color: branding.primaryColor }}
              >
                Link Text
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Login Page */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Login Page
          </CardTitle>
          <CardDescription>
            Customize the login page appearance and text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loginWelcomeText">Welcome Text</Label>
              <Input
                id="loginWelcomeText"
                placeholder="Welcome"
                value={branding.loginWelcomeText}
                onChange={(e) =>
                  setBranding({ ...branding, loginWelcomeText: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loginSubtitle">Subtitle</Label>
              <Input
                id="loginSubtitle"
                placeholder="Sign in to your account"
                value={branding.loginSubtitle}
                onChange={(e) =>
                  setBranding({ ...branding, loginSubtitle: e.target.value })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loginBackgroundType">Background Type</Label>
              <Select
                value={branding.loginBackgroundType}
                onValueChange={(value) =>
                  setBranding({ ...branding, loginBackgroundType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="particles">Animated Particles</SelectItem>
                  <SelectItem value="gradient">Gradient</SelectItem>
                  <SelectItem value="image">Custom Image</SelectItem>
                  <SelectItem value="solid">Solid Color</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {branding.loginBackgroundType === 'image' && (
              <div className="space-y-2">
                <Label htmlFor="loginBackgroundUrl">Background Image URL</Label>
                <Input
                  id="loginBackgroundUrl"
                  placeholder="https://example.com/background.jpg"
                  value={branding.loginBackgroundUrl}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      loginBackgroundUrl: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legal Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Legal & Support Links
          </CardTitle>
          <CardDescription>
            Links displayed in the footer and login page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="termsOfServiceUrl">Terms of Service</Label>
              <Input
                id="termsOfServiceUrl"
                placeholder="https://example.com/terms"
                value={branding.termsOfServiceUrl}
                onChange={(e) =>
                  setBranding({ ...branding, termsOfServiceUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="privacyPolicyUrl">Privacy Policy</Label>
              <Input
                id="privacyPolicyUrl"
                placeholder="https://example.com/privacy"
                value={branding.privacyPolicyUrl}
                onChange={(e) =>
                  setBranding({ ...branding, privacyPolicyUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportUrl">Support</Label>
              <Input
                id="supportUrl"
                placeholder="https://support.example.com"
                value={branding.supportUrl}
                onChange={(e) =>
                  setBranding({ ...branding, supportUrl: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={fetchBranding} disabled={isSaving}>
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
