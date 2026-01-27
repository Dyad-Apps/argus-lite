import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  Eye,
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
  DialogTrigger,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/organizations/')({
  component: OrganizationsIndexPage,
});

interface Organization {
  id: string;
  name: string;
  orgCode: string;
  slug: string;
  path?: string;
  isActive: boolean;
  isRoot: boolean;
  plan: string;
  profileId?: string | null;
  createdAt: string;
}

interface OrganizationListResponse {
  data: Organization[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface OrganizationProfile {
  id: string;
  name: string;
  description: string | null;
  type: string;
}

interface OrganizationProfileListResponse {
  data: OrganizationProfile[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

interface CreateOrgFormData {
  name: string;
  orgCode: string;
  domainType: 'platform' | 'custom';
  customDomain?: string;
  profileId: string;
  adminEmail: string;
  allowWhiteLabeling: boolean;
  allowImpersonation: boolean;
}

const initialFormData: CreateOrgFormData = {
  name: '',
  orgCode: '',
  domainType: 'platform',
  customDomain: '',
  profileId: '',
  adminEmail: '',
  allowWhiteLabeling: false,
  allowImpersonation: false,
};

function OrganizationsIndexPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationProfiles, setOrganizationProfiles] = useState<OrganizationProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateOrgFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<OrganizationListResponse>('/organizations');
      setOrganizations(response.data);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      setError('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOrganizationProfiles = useCallback(async () => {
    try {
      const response = await apiClient.get<OrganizationProfileListResponse>('/organization-profiles');
      setOrganizationProfiles(response.data);
    } catch (err) {
      console.error('Failed to fetch organization profiles:', err);
      // Non-critical, don't show error to user
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
    fetchOrganizationProfiles();
  }, [fetchOrganizations, fetchOrganizationProfiles]);

  // Only show root organizations on this page
  const rootOrgs = organizations.filter((org) => org.isRoot);

  const filteredOrgs = rootOrgs.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.orgCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to get profile name from profileId
  const getProfileName = (profileId?: string | null) => {
    if (!profileId) return '-';
    const profile = organizationProfiles.find((p) => p.id === profileId);
    return profile?.name || '-';
  };

  const handleCreateOrganization = async () => {
    try {
      setIsCreating(true);
      setError(null);

      const payload = {
        name: formData.name,
        orgCode: formData.orgCode.toUpperCase(),
        domainType: formData.domainType,
        customDomain: formData.domainType === 'custom' ? formData.customDomain : undefined,
        profileId: formData.profileId || undefined,
        adminEmail: formData.adminEmail,
        allowWhiteLabeling: formData.allowWhiteLabeling,
        allowImpersonation: formData.allowImpersonation,
      };

      await apiClient.post('/organizations/root', payload);

      // Refresh the list after successful creation
      await fetchOrganizations();

      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
    } catch (err: any) {
      console.error('Failed to create organization:', err);
      const message = err?.data?.error?.message || 'Failed to create organization';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteOrganization = async (id: string) => {
    try {
      await apiClient.delete(`/organizations/${id}`);
      await fetchOrganizations();
    } catch (err) {
      console.error('Failed to delete organization:', err);
      setError('Failed to delete organization');
    }
  };

  const updateFormData = (field: keyof CreateOrgFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    formData.name &&
    formData.orgCode &&
    formData.adminEmail &&
    (formData.domainType === 'platform' || (formData.domainType === 'custom' && formData.customDomain));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Organizations</h1>
          <p className="text-muted-foreground">
            Total Root Organizations: {rootOrgs.length}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Create New Root Organization</DialogTitle>
              <DialogDescription>
                Configure a new top-level organization on the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              {/* Organization Name and Code - side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    placeholder="e.g., Radio Communications Inc"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgCode">Organization Code</Label>
                  <Input
                    id="orgCode"
                    placeholder="e.g., RADIO"
                    value={formData.orgCode}
                    onChange={(e) => updateFormData('orgCode', e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              {/* Domain Configuration */}
              <div className="space-y-3">
                <Label>Domain Configuration</Label>
                <RadioGroup
                  value={formData.domainType}
                  onValueChange={(value) => updateFormData('domainType', value)}
                  className="flex items-center gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="platform" id="platform-domain" />
                    <Label htmlFor="platform-domain" className="font-normal cursor-pointer">
                      Use Platform Domain
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom-domain" />
                    <Label htmlFor="custom-domain" className="font-normal cursor-pointer">
                      Use Custom Domain
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Custom Domain Input - shown when custom domain is selected */}
              {formData.domainType === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Custom Domain</Label>
                  <Input
                    id="customDomain"
                    placeholder="e.g., radio.vxcloud.com"
                    value={formData.customDomain || ''}
                    onChange={(e) => updateFormData('customDomain', e.target.value)}
                  />
                </div>
              )}

              {/* Organization Profile */}
              <div className="space-y-2">
                <Label htmlFor="profile">Organization Profile</Label>
                <Select
                  value={formData.profileId}
                  onValueChange={(value) => updateFormData('profileId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a profile (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationProfiles.length > 0 ? (
                      organizationProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No profiles available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {organizationProfiles.length === 0
                    ? 'Create organization profiles in the Organization Profiles page first'
                    : 'Defines capabilities and limits for this organization'
                  }
                </p>
              </div>

              {/* Root Organization Admin Email */}
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Root Organization Admin Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@company.com"
                  value={formData.adminEmail}
                  onChange={(e) => updateFormData('adminEmail', e.target.value)}
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-4 pt-2">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="allowWhiteLabeling"
                    checked={formData.allowWhiteLabeling}
                    onCheckedChange={(checked) =>
                      updateFormData('allowWhiteLabeling', checked === true)
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="allowWhiteLabeling"
                      className="font-medium cursor-pointer"
                    >
                      Allow Organization White Labeling
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Permit this organization to customize their own branding and appearance.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="allowImpersonation"
                    checked={formData.allowImpersonation}
                    onCheckedChange={(checked) =>
                      updateFormData('allowImpersonation', checked === true)
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="allowImpersonation"
                      className="font-medium cursor-pointer"
                    >
                      Allow Impersonation
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Allow platform administrators to sign in as users of this organization.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setFormData(initialFormData);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrganization}
                disabled={!isFormValid || isCreating}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Root Organization
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                placeholder="Search root organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchOrganizations}
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
                <TableHead className="w-[40px]">
                  <Checkbox />
                </TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading organizations...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredOrgs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    {searchQuery ? 'No organizations match your search' : 'No organizations found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Checkbox />
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/organizations/$orgId"
                        params={{ orgId: org.id }}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {org.orgCode}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={org.isActive ? 'default' : 'secondary'}
                      >
                        {org.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getProfileName(org.profileId)}
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider delayDuration={0}>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate({ to: '/organizations/$orgId', params: { orgId: org.id } })}
                              >
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View / Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteOrganization(org.id)}
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
    </div>
  );
}
