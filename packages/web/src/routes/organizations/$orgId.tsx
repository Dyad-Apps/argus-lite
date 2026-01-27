import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  RefreshCw,
  Loader2,
  LayoutDashboard,
  Settings,
  GitBranch,
  Network,
  Palette,
  Users,
  Shield,
  Key,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  OrganizationOverviewTab,
  OrganizationDetailsTab,
  ChildOrganizationsTab,
  OrganizationHierarchyTab,
  OrganizationBrandingTab,
  OrganizationAuditLogTab,
  OrganizationSSOTab,
  OrganizationAPIAccessTab,
} from '@/components/organizations';
import { StartImpersonationDialog } from '@/components/impersonation/start-impersonation-dialog';
import { useImpersonationSafe } from '@/contexts/impersonation-context';

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

interface UserOrganization {
  id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

function OrganizationDetailsPage() {
  const { orgId } = Route.useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<OrganizationStats>({
    userCount: 0,
    childCount: 0,
    activeUsers: 0,
  });
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | 'viewer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isImpersonateDialogOpen, setIsImpersonateDialogOpen] = useState(false);
  const impersonation = useImpersonationSafe();

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

      // Fetch user role for this organization to handle RBAC
      try {
        const authResponse = await apiClient.get<{ organizations: UserOrganization[] }>('/auth/organizations');
        const currentOrgMembership = authResponse.organizations.find(o => o.id === orgId);
        if (currentOrgMembership) {
          setUserRole(currentOrgMembership.role);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to="/organizations" className="hover:text-foreground">Organizations</Link>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          {error || 'Organization not found'}
        </div>
      </div>
    );
  }

  const isAdminOrAbove = userRole === 'owner' || userRole === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link to="/organizations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Organizations
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            {/* Impersonate Button */}
            {organization.settings?.features?.allowImpersonation && (
              impersonation?.isActive ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => impersonation.endImpersonation()}
                >
                  <Users className="mr-2 h-4 w-4" />
                  End Session
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImpersonateDialogOpen(true)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Impersonate
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={fetchOrganization}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Title Section */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
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
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
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
          <TabsTrigger value="audit-logs">
            <FileText className="mr-2 h-4 w-4" />
            Audit Logs
          </TabsTrigger>

          {/* RBAC Protected Tabs */}
          {isAdminOrAbove && (
            <>
              <TabsTrigger value="sso">
                <Shield className="mr-2 h-4 w-4" />
                Organization SSO
              </TabsTrigger>
              <TabsTrigger value="api-access">
                <Key className="mr-2 h-4 w-4" />
                API Access
              </TabsTrigger>
            </>
          )}

          {organization.settings?.features?.allowWhiteLabeling && isAdminOrAbove && (
            <TabsTrigger value="branding">
              <Palette className="mr-2 h-4 w-4" />
              Branding
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OrganizationOverviewTab
            organization={organization}
            stats={stats}
            onNavigateToTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="details">
          <OrganizationDetailsTab
            organization={organization}
            onUpdated={handleOrganizationUpdated}
          />
        </TabsContent>

        {organization.canHaveChildren && (
          <TabsContent value="children">
            <ChildOrganizationsTab
              organization={organization}
              onChildCreated={handleOrganizationUpdated}
            />
          </TabsContent>
        )}

        <TabsContent value="hierarchy">
          <OrganizationHierarchyTab organization={organization} />
        </TabsContent>

        <TabsContent value="audit-logs">
          <OrganizationAuditLogTab organizationId={organization.id} />
        </TabsContent>

        {isAdminOrAbove && (
          <>
            <TabsContent value="sso">
              <OrganizationSSOTab organizationId={organization.id} />
            </TabsContent>
            <TabsContent value="api-access">
              <OrganizationAPIAccessTab />
            </TabsContent>
          </>
        )}

        {organization.settings?.features?.allowWhiteLabeling && isAdminOrAbove && (
          <TabsContent value="branding">
            <OrganizationBrandingTab
              organization={organization}
              onUpdated={handleOrganizationUpdated}
            />
          </TabsContent>
        )}
      </Tabs>

      <StartImpersonationDialog
        open={isImpersonateDialogOpen}
        onOpenChange={setIsImpersonateDialogOpen}
        organizationId={organization.id}
      />
    </div>
  );
}
