import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  ArrowLeft,
  RefreshCw,
  Loader2,
  LayoutDashboard,
  Settings,
  GitBranch,
  Network,
  Palette,
  Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TenantOverviewTab } from '@/components/organizations/tenant-overview-tab';
import { TenantDetailsTab } from '@/components/organizations/tenant-details-tab';
import { ChildTenantsTab } from '@/components/organizations/child-tenants-tab';
import { TenantHierarchyTab } from '@/components/organizations/tenant-hierarchy-tab';
import { TenantBrandingTab } from '@/components/organizations/tenant-branding-tab';

export const Route = createFileRoute('/organizations/$orgId')({
  component: OrganizationDetailsPage,
});

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
  rootOrganizationId?: string;
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

interface OrganizationStats {
  userCount: number;
  childCount: number;
  activeUsers: number;
}

function OrganizationDetailsPage() {
  const { orgId } = Route.useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<OrganizationStats>({
    userCount: 0,
    childCount: 0,
    activeUsers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchOrganization = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<Organization>(`/organizations/${orgId}`);
      setOrganization(response);

      // Fetch children count for stats
      try {
        const childrenResponse = await apiClient.get<{ data: Organization[] }>(
          `/organizations/${orgId}/children`
        );
        setStats((prev) => ({
          ...prev,
          childCount: childrenResponse.data?.length ?? 0,
        }));
      } catch {
        // Children endpoint might not exist yet
      }
    } catch (err) {
      console.error('Failed to fetch organization:', err);
      setError('Failed to load organization details');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const handleOrganizationUpdated = () => {
    fetchOrganization();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="space-y-6">
        <Link to="/organizations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organizations
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          {error || 'Organization not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link to="/organizations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-primary">
                  {organization.name}
                </h1>
                <Badge variant={organization.isActive ? 'default' : 'secondary'}>
                  {organization.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {organization.isRoot && (
                  <Badge variant="outline">Root</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>{organization.orgCode}</span>
                {organization.subdomain && (
                  <>
                    <span>•</span>
                    <span>{organization.subdomain}.argusiq.com</span>
                  </>
                )}
                {organization.path && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-xs">{organization.path}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchOrganization}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="details">
            <Settings className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          {organization.canHaveChildren && (
            <TabsTrigger value="children">
              <GitBranch className="mr-2 h-4 w-4" />
              Child Tenants
            </TabsTrigger>
          )}
          <TabsTrigger value="hierarchy">
            <Network className="mr-2 h-4 w-4" />
            Hierarchy
          </TabsTrigger>
          {organization.settings?.features?.allowWhiteLabeling && (
            <TabsTrigger value="branding">
              <Palette className="mr-2 h-4 w-4" />
              Branding
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <TenantOverviewTab
            organization={organization}
            stats={stats}
            onNavigateToTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="details">
          <TenantDetailsTab
            organization={organization}
            onUpdated={handleOrganizationUpdated}
          />
        </TabsContent>

        {organization.canHaveChildren && (
          <TabsContent value="children">
            <ChildTenantsTab
              organization={organization}
              onChildCreated={handleOrganizationUpdated}
            />
          </TabsContent>
        )}

        <TabsContent value="hierarchy">
          <TenantHierarchyTab organization={organization} />
        </TabsContent>

        {organization.settings?.features?.allowWhiteLabeling && (
          <TabsContent value="branding">
            <TenantBrandingTab
              organization={organization}
              onUpdated={handleOrganizationUpdated}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
