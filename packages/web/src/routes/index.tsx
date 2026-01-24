import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickLinks } from '@/components/dashboard/quick-links';
import { PLATFORM_VERSION } from '@/lib/theme-defaults';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  // TODO: Fetch actual stats from API
  const stats = {
    organizations: 1,
    users: 1,
    devices: 0,
    assets: 0,
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Top Row: Key Metrics + Platform Info */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          title="Organizations"
          value={stats.organizations}
          link="/organizations"
          className="h-24"
        />
        <StatCard
          title="Users"
          value={stats.users}
          link="/users"
          variant="green"
          className="h-24"
        />
        <StatCard
          title="Devices"
          value={stats.devices}
          variant="blue"
          className="h-24"
        />
        <StatCard
          title="Assets"
          value={stats.assets}
          variant="purple"
          className="h-24"
        />
        <StatCard
          title="Platform Version"
          value={`v${PLATFORM_VERSION}`}
          subValue="Stable"
          variant="info"
          className="h-24"
        />
      </div>

      {/* Middle Row: System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm">All systems operational</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">99.9%</div>
                <div className="text-xs text-muted-foreground">Uptime</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Active Issues</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">Healthy</div>
                <div className="text-xs text-muted-foreground">API Status</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <QuickLinks />
      </div>

      {/* Bottom Row: Recent Activity */}
      <Card className="flex-1 min-h-[200px]">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="flex-1">System initialized successfully</span>
              <span className="text-xs text-muted-foreground">Just now</span>
            </div>
            <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="flex-1">Database seeded with default data</span>
              <span className="text-xs text-muted-foreground">Just now</span>
            </div>
            <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="flex-1">Admin user created</span>
              <span className="text-xs text-muted-foreground">Just now</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
