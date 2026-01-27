import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickLinks } from '@/components/dashboard/quick-links';
import { RealtimeChart } from '@/components/dashboard/realtime-chart';
import { MessageChart } from '@/components/dashboard/message-chart';
import { SystemResourceGroup } from '@/components/dashboard/system-resource-group';
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

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">

      {/* Top Row: Key Metrics + Platform Info */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-tour-id="dashboard-stat-cards">
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
          className="h-24 border-l-4 border-l-green-500"
        />
        <StatCard
          title="Devices"
          value={stats?.devices ?? 0}
          variant="blue"
          className="h-24 border-l-4 border-l-blue-500"
          tooltip="Device management coming soon"
        />
        <StatCard
          title="Assets"
          value={stats?.assets ?? 0}
          variant="purple"
          className="h-24 border-l-4 border-l-purple-500"
          tooltip="Asset management coming soon"
        />

        {/* Platform Info as Stat Card */}
        <StatCard
          title="Platform Version"
          value={`v${PLATFORM_VERSION}`}
          subValue="Stable"
          variant="info"
          className="h-24 bg-blue-50/50 border-blue-200"
        />
      </div>

      {/* Middle Row: System Health (Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[260px]" data-tour-id="dashboard-system-health">
        {/* Realtime System Load */}
        <div className="lg:col-span-2 h-full">
          <RealtimeChart data={systemLoad} />
        </div>

        {/* Resource Usage Gauges */}
        <div className="h-full">
          <SystemResourceGroup data={systemMetrics} />
        </div>
      </div>

      {/* Bottom Row: Message Throughput & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[220px]">
        <div className="lg:col-span-2 h-full" data-tour-id="dashboard-message-chart">
          <MessageChart />
        </div>
        <div className="h-full" data-tour-id="dashboard-quick-links">
          <QuickLinks />
        </div>
      </div>

    </div>
  );
}
