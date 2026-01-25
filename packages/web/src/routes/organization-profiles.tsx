import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  Copy,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export const Route = createFileRoute('/organization-profiles')({
  component: OrganizationProfilesPage,
});

interface OrganizationProfile {
  id: string;
  name: string;
  description: string | null;
  type: 'root' | 'child' | 'universal';
  capabilities: {
    maxUsers?: number;
    maxDevices?: number;
    maxAssets?: number;
    maxChildOrganizations?: number;
    maxStorageGb?: number;
    allowWhiteLabeling?: boolean;
    allowImpersonation?: boolean;
    allowSso?: boolean;
    allowApi?: boolean;
    allowCustomDomain?: boolean;
  };
  limits: {
    dataRetentionDays?: number;
    apiRateLimit?: number;
    maxExportsPerDay?: number;
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationProfileListResponse {
  data: OrganizationProfile[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface CreateProfileFormData {
  name: string;
  description: string;
  type: 'root' | 'child' | 'universal';
  maxUsers: string;
  maxDevices: string;
  maxAssets: string;
  maxChildOrganizations: string;
  maxStorageGb: string;
  allowWhiteLabeling: boolean;
  allowImpersonation: boolean;
  allowSso: boolean;
  allowApi: boolean;
  allowCustomDomain: boolean;
  dataRetentionDays: string;
  apiRateLimit: string;
  maxExportsPerDay: string;
  isDefault: boolean;
}

const initialFormData: CreateProfileFormData = {
  name: '',
  description: '',
  type: 'universal',
  maxUsers: '',
  maxDevices: '',
  maxAssets: '',
  maxChildOrganizations: '',
  maxStorageGb: '',
  allowWhiteLabeling: false,
  allowImpersonation: false,
  allowSso: false,
  allowApi: true,
  allowCustomDomain: false,
  dataRetentionDays: '90',
  apiRateLimit: '1000',
  maxExportsPerDay: '10',
  isDefault: false,
};

function OrganizationProfilesPage() {
  const [profiles, setProfiles] = useState<OrganizationProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<OrganizationProfile | null>(null);
  const [formData, setFormData] = useState<CreateProfileFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<OrganizationProfileListResponse>('/organization-profiles');
      setProfiles(response.data || []);
    } catch (err) {
      console.error('Failed to fetch organization profiles:', err);
      setError('Failed to load organization profiles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const profileToFormData = (profile: OrganizationProfile): CreateProfileFormData => ({
    name: profile.name,
    description: profile.description || '',
    type: profile.type,
    maxUsers: profile.capabilities.maxUsers?.toString() || '',
    maxDevices: profile.capabilities.maxDevices?.toString() || '',
    maxAssets: profile.capabilities.maxAssets?.toString() || '',
    maxChildOrganizations: profile.capabilities.maxChildOrganizations?.toString() || '',
    maxStorageGb: profile.capabilities.maxStorageGb?.toString() || '',
    allowWhiteLabeling: profile.capabilities.allowWhiteLabeling || false,
    allowImpersonation: profile.capabilities.allowImpersonation || false,
    allowSso: profile.capabilities.allowSso || false,
    allowApi: profile.capabilities.allowApi ?? true,
    allowCustomDomain: profile.capabilities.allowCustomDomain || false,
    dataRetentionDays: profile.limits.dataRetentionDays?.toString() || '90',
    apiRateLimit: profile.limits.apiRateLimit?.toString() || '1000',
    maxExportsPerDay: profile.limits.maxExportsPerDay?.toString() || '10',
    isDefault: profile.isDefault,
  });

  const formDataToPayload = (data: CreateProfileFormData) => ({
    name: data.name,
    description: data.description || undefined,
    type: data.type,
    capabilities: {
      maxUsers: data.maxUsers ? parseInt(data.maxUsers) : undefined,
      maxDevices: data.maxDevices ? parseInt(data.maxDevices) : undefined,
      maxAssets: data.maxAssets ? parseInt(data.maxAssets) : undefined,
      maxChildOrganizations: data.maxChildOrganizations ? parseInt(data.maxChildOrganizations) : undefined,
      maxStorageGb: data.maxStorageGb ? parseInt(data.maxStorageGb) : undefined,
      allowWhiteLabeling: data.allowWhiteLabeling,
      allowImpersonation: data.allowImpersonation,
      allowSso: data.allowSso,
      allowApi: data.allowApi,
      allowCustomDomain: data.allowCustomDomain,
    },
    limits: {
      dataRetentionDays: data.dataRetentionDays ? parseInt(data.dataRetentionDays) : undefined,
      apiRateLimit: data.apiRateLimit ? parseInt(data.apiRateLimit) : undefined,
      maxExportsPerDay: data.maxExportsPerDay ? parseInt(data.maxExportsPerDay) : undefined,
    },
    isDefault: data.isDefault,
  });

  const handleCreateOrUpdate = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const payload = formDataToPayload(formData);

      if (editingProfile) {
        await apiClient.patch(`/organization-profiles/${editingProfile.id}`, payload);
      } else {
        await apiClient.post('/organization-profiles', payload);
      }

      await fetchProfiles();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Failed to save organization profile:', err);
      const message = err?.data?.error?.message || 'Failed to save organization profile';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await apiClient.delete(`/organization-profiles/${id}`);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to delete organization profile:', err);
      setError('Failed to delete organization profile');
    }
  };

  const handleDuplicateProfile = (profile: OrganizationProfile) => {
    const duplicateData = profileToFormData(profile);
    duplicateData.name = `${profile.name} (Copy)`;
    duplicateData.isDefault = false;
    setFormData(duplicateData);
    setEditingProfile(null);
    setIsCreateDialogOpen(true);
  };

  const handleEditProfile = (profile: OrganizationProfile) => {
    setFormData(profileToFormData(profile));
    setEditingProfile(profile);
    setIsCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingProfile(null);
    setFormData(initialFormData);
    setError(null);
  };

  const updateFormData = (field: keyof CreateProfileFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = formData.name.trim().length > 0;

  const getTypeBadgeVariant = (type: OrganizationProfile['type']) => {
    switch (type) {
      case 'root':
        return 'default';
      case 'child':
        return 'secondary';
      case 'universal':
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Organization Profiles</h1>
          <p className="text-muted-foreground">
            Manage profile templates that define capabilities and limits for organizations
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Profile
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search profiles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchProfiles}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Features</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading profiles...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'No profiles match your search' : 'No organization profiles found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Layers className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{profile.name}</span>
                            {profile.isDefault && (
                              <Badge variant="outline" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                          {profile.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {profile.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(profile.type)}>
                        {profile.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {profile.capabilities.maxUsers || 'Unlimited'}
                    </TableCell>
                    <TableCell>
                      {profile.capabilities.maxStorageGb
                        ? `${profile.capabilities.maxStorageGb} GB`
                        : 'Unlimited'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {profile.capabilities.allowSso && (
                          <Badge variant="secondary" className="text-xs">SSO</Badge>
                        )}
                        {profile.capabilities.allowApi && (
                          <Badge variant="secondary" className="text-xs">API</Badge>
                        )}
                        {profile.capabilities.allowWhiteLabeling && (
                          <Badge variant="secondary" className="text-xs">Branding</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider delayDuration={0}>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditProfile(profile)}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDuplicateProfile(profile)}
                              >
                                <Copy className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteProfile(profile.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? 'Edit Organization Profile' : 'Create Organization Profile'}
            </DialogTitle>
            <DialogDescription>
              {editingProfile
                ? 'Update the profile settings and capabilities.'
                : 'Create a new profile template for organizations.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium">Basic Information</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profileName">Profile Name</Label>
                  <Input
                    id="profileName"
                    placeholder="e.g., Enterprise"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileType">Profile Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => updateFormData('type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Root Only</SelectItem>
                      <SelectItem value="child">Child Only</SelectItem>
                      <SelectItem value="universal">Universal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileDescription">Description</Label>
                <Textarea
                  id="profileDescription"
                  placeholder="Describe this profile's purpose..."
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Capabilities */}
            <div className="space-y-4">
              <h4 className="font-medium">Capabilities</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maxUsers">Max Users</Label>
                  <Input
                    id="maxUsers"
                    type="number"
                    placeholder="Unlimited"
                    value={formData.maxUsers}
                    onChange={(e) => updateFormData('maxUsers', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDevices">Max Devices</Label>
                  <Input
                    id="maxDevices"
                    type="number"
                    placeholder="Unlimited"
                    value={formData.maxDevices}
                    onChange={(e) => updateFormData('maxDevices', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxStorageGb">Storage (GB)</Label>
                  <Input
                    id="maxStorageGb"
                    type="number"
                    placeholder="Unlimited"
                    value={formData.maxStorageGb}
                    onChange={(e) => updateFormData('maxStorageGb', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maxAssets">Max Assets</Label>
                  <Input
                    id="maxAssets"
                    type="number"
                    placeholder="Unlimited"
                    value={formData.maxAssets}
                    onChange={(e) => updateFormData('maxAssets', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxChildOrganizations">Max Child Orgs</Label>
                  <Input
                    id="maxChildOrganizations"
                    type="number"
                    placeholder="Unlimited"
                    value={formData.maxChildOrganizations}
                    onChange={(e) => updateFormData('maxChildOrganizations', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h4 className="font-medium">Features</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowSso"
                    checked={formData.allowSso}
                    onCheckedChange={(checked) => updateFormData('allowSso', checked === true)}
                  />
                  <Label htmlFor="allowSso" className="font-normal cursor-pointer">
                    SSO Authentication
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowApi"
                    checked={formData.allowApi}
                    onCheckedChange={(checked) => updateFormData('allowApi', checked === true)}
                  />
                  <Label htmlFor="allowApi" className="font-normal cursor-pointer">
                    API Access
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowWhiteLabeling"
                    checked={formData.allowWhiteLabeling}
                    onCheckedChange={(checked) => updateFormData('allowWhiteLabeling', checked === true)}
                  />
                  <Label htmlFor="allowWhiteLabeling" className="font-normal cursor-pointer">
                    White Labeling
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowImpersonation"
                    checked={formData.allowImpersonation}
                    onCheckedChange={(checked) => updateFormData('allowImpersonation', checked === true)}
                  />
                  <Label htmlFor="allowImpersonation" className="font-normal cursor-pointer">
                    Impersonation
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowCustomDomain"
                    checked={formData.allowCustomDomain}
                    onCheckedChange={(checked) => updateFormData('allowCustomDomain', checked === true)}
                  />
                  <Label htmlFor="allowCustomDomain" className="font-normal cursor-pointer">
                    Custom Domain
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => updateFormData('isDefault', checked === true)}
                  />
                  <Label htmlFor="isDefault" className="font-normal cursor-pointer">
                    Set as Default
                  </Label>
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-4">
              <h4 className="font-medium">Limits</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="dataRetentionDays">Data Retention (days)</Label>
                  <Input
                    id="dataRetentionDays"
                    type="number"
                    value={formData.dataRetentionDays}
                    onChange={(e) => updateFormData('dataRetentionDays', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiRateLimit">API Rate Limit/hr</Label>
                  <Input
                    id="apiRateLimit"
                    type="number"
                    value={formData.apiRateLimit}
                    onChange={(e) => updateFormData('apiRateLimit', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxExportsPerDay">Max Exports/day</Label>
                  <Input
                    id="maxExportsPerDay"
                    type="number"
                    value={formData.maxExportsPerDay}
                    onChange={(e) => updateFormData('maxExportsPerDay', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrUpdate} disabled={!isFormValid || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProfile ? 'Save Changes' : 'Create Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
