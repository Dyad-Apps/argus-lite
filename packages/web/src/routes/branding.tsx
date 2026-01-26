import { useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Paintbrush, Loader2, Building2 } from 'lucide-react';
import { OrganizationBrandingTab } from '@/components/organizations/organization-branding-tab';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/branding')({
  component: BrandingPage,
});

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  isPrimary: boolean;
}

interface AuthOrganizationsResponse {
  organizations: Organization[];
  currentOrganizationId: string;
}

function BrandingPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get<AuthOrganizationsResponse>(
        '/auth/organizations'
      );

      // Filter to only orgs where user is admin or owner
      const adminOrgs = response.organizations.filter(
        (org) => org.role === 'admin' || org.role === 'owner'
      );

      setOrganizations(adminOrgs);

      // Set the primary org as default, or first admin org
      const primaryOrg = adminOrgs.find((org) => org.isPrimary);
      const currentOrg = adminOrgs.find(
        (org) => org.id === response.currentOrganizationId
      );
      setSelectedOrg(currentOrg || primaryOrg || adminOrgs[0] || null);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      setError('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Paintbrush className="h-6 w-6" />
            White Labeling
          </h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Paintbrush className="h-6 w-6" />
            White Labeling
          </h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              You don't have admin access to any organizations. Only organization
              admins and owners can manage branding settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Paintbrush className="h-6 w-6" />
            White Labeling
          </h1>
          <p className="text-muted-foreground">
            Customize your organization's branding including logos, colors, and
            login page
          </p>
        </div>

        {organizations.length > 1 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="org-select" className="text-sm text-muted-foreground">
              <Building2 className="h-4 w-4 inline mr-1" />
              Organization:
            </Label>
            <Select
              value={selectedOrg?.id}
              onValueChange={(value) => {
                const org = organizations.find((o) => o.id === value);
                if (org) setSelectedOrg(org);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selectedOrg && (
        <OrganizationBrandingTab
          organization={selectedOrg}
          onUpdated={() => {
            // Optionally refresh something
          }}
        />
      )}
    </div>
  );
}
