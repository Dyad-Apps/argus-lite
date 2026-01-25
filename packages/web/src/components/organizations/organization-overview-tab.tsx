import {
  Building2,
  Users,
  GitBranch,
  Calendar,
  Clock,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

interface OrganizationStats {
  userCount: number;
  childCount: number;
  activeUsers: number;
}

interface OrganizationOverviewTabProps {
  organization: Organization;
  stats: OrganizationStats;
  onNavigateToTab: (tab: string) => void;
}

export function OrganizationOverviewTab({
  organization,
  stats,
  onNavigateToTab,
}: OrganizationOverviewTabProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.userCount}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers} active
            </p>
          </CardContent>
        </Card>

        {organization.canHaveChildren && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Child Tenants</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.childCount}</div>
              <Button
                variant="link"
                className="px-0 text-xs"
                onClick={() => onNavigateToTab('children')}
              >
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hierarchy Depth</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Level {organization.depth}</div>
            <p className="text-xs text-muted-foreground">
              {organization.isRoot ? 'Root organization' : 'Child organization'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{organization.plan}</div>
            <p className="text-xs text-muted-foreground">Current tier</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Organization Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Organization Code</span>
              <span className="font-mono">{organization.orgCode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono">{organization.slug}</span>
            </div>
            {organization.subdomain && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Subdomain</span>
                <span className="font-mono">{organization.subdomain}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={organization.isActive ? 'default' : 'secondary'}>
                {organization.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Can Have Children</span>
              <Badge variant={organization.canHaveChildren ? 'default' : 'outline'}>
                {organization.canHaveChildren ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onNavigateToTab('details')}
              >
                Edit Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Capabilities Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">White Labeling</span>
              <Badge
                variant={
                  organization.settings?.features?.allowWhiteLabeling
                    ? 'default'
                    : 'outline'
                }
              >
                {organization.settings?.features?.allowWhiteLabeling
                  ? 'Enabled'
                  : 'Disabled'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Impersonation</span>
              <Badge
                variant={
                  organization.settings?.features?.allowImpersonation
                    ? 'default'
                    : 'outline'
                }
              >
                {organization.settings?.features?.allowImpersonation
                  ? 'Enabled'
                  : 'Disabled'}
              </Badge>
            </div>
            {organization.settings?.timezone && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Timezone</span>
                <span>{organization.settings.timezone}</span>
              </div>
            )}
            {organization.settings?.locale && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Locale</span>
                <span>{organization.settings.locale}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(organization.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(organization.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description Card */}
      {organization.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{organization.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
