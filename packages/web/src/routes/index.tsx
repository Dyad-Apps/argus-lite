import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickLinks } from '@/components/dashboard/quick-links';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { SystemMetricsCard } from '@/components/dashboard/system-metrics-card';
import { SystemLoadChart } from '@/components/dashboard/system-load-chart';
import { NotConfiguredCard } from '@/components/shared/placeholder-card';
import { PLATFORM_VERSION } from '@/lib/theme-defaults';
import {
  dashboardApi,
  type DashboardStats,
  type RecentActivityItem,
  type SystemMetrics,
  type SystemLoadResponse,
} from '@/lib/dashboard-api';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [systemLoad, setSystemLoad] = useState<SystemLoadResponse | null>(null);
  const [loadRange, setLoadRange] = useState(60);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSystemLoad = useCallback(async (range: number) => {
    try {
      const data = await dashboardApi.getSystemLoad(range);
      setSystemLoad(data);
    } catch (error) {
      console.error('Failed to fetch system load:', error);
    }
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        const [statsData, activityData, metricsData, loadData] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getRecentActivity(10),
          dashboardApi.getSystemMetrics(),
          dashboardApi.getSystemLoad(loadRange),
        ]);
        setStats(statsData);
        setRecentActivity(activityData);
        setSystemMetrics(metricsData);
        setSystemLoad(loadData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Set default values on error
        setStats({ organizations: 0, users: 0, devices: 0, assets: 0 });
        setRecentActivity([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [loadRange]);

  const handleRangeChange = useCallback((range: number) => {
    setLoadRange(range);
    fetchSystemLoad(range);
  }, [fetchSystemLoad]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Top Row: Key Metrics + Platform Info */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
        data-tour-id="dashboard-stat-cards"
      >
        <StatCard
          title="Organizations"
          value={stats?.organizations ?? '-'}
          link="/organizations"
          className="h-24"
        />
        <StatCard
          title="Users"
          value={stats?.users ?? '-'}
          link="/users"
          variant="green"
          className="h-24"
        />
        <StatCard
          title="Devices"
          value={stats?.devices ?? 0}
          variant="blue"
          className="h-24"
          tooltip="No devices configured yet"
        />
        <StatCard
          title="Assets"
          value={stats?.assets ?? 0}
          variant="purple"
          className="h-24"
          tooltip="No assets configured yet"
        />
        <StatCard
          title="Platform Version"
          value={`v${PLATFORM_VERSION}`}
          subValue="Stable"
          variant="info"
          className="h-24"
        />
      </div>

      {/* Middle Row: Recent Activity + System Metrics */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[260px]"
        data-tour-id="dashboard-system-health"
      >
        {/* Recent Activity */}
        <div className="lg:col-span-2 h-full">
          <RecentActivity data={recentActivity} isLoading={isLoading} />
        </div>

        {/* System Metrics (Prometheus) */}
        <div className="h-full">
          <SystemMetricsCard data={systemMetrics} isLoading={isLoading} />
        </div>
      </div>

      {/* Bottom Row: System Load Chart + Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[260px]">
        <div className="lg:col-span-2 h-full">
          <SystemLoadChart
            data={systemLoad}
            isLoading={isLoading}
            onRangeChange={handleRangeChange}
          />
        </div>
        <div className="h-full" data-tour-id="dashboard-quick-links">
          <QuickLinks />
        </div>
      </div>
    </div>
  );
}
