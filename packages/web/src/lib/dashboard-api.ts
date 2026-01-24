/**
 * Dashboard API client
 * Provides typed access to dashboard endpoints
 *
 * System metrics are now powered by Prometheus queries.
 * See ADR-003 for data source classification.
 */

import { apiClient } from './api-client';

// Types for dashboard API responses
export interface DashboardStats {
  organizations: number;
  users: number;
  devices: number;
  assets: number;
}

export interface RecentActivityItem {
  id: string;
  category: string;
  action: string;
  userEmail: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  createdAt: string;
}

export interface RecentActivityResponse {
  data: RecentActivityItem[];
}

// System metrics types (Prometheus-backed)
export interface SystemMetrics {
  configured: boolean;
  healthy: boolean;
  metrics: {
    cpu: {
      usage: number | null;
      cores: number | null;
    };
    memory: {
      usage: number | null;
      totalBytes: number | null;
      usedBytes: number | null;
    };
    disk: {
      usage: number | null;
      totalBytes: number | null;
      usedBytes: number | null;
    };
    api: {
      requestRate: number | null;
      errorRate: number | null;
      avgLatencyMs: number | null;
    };
  } | null;
}

export interface SystemLoadDataPoint {
  timestamp: number;
  cpu: number | null;
  memory: number | null;
  requestRate: number | null;
}

export interface SystemLoadResponse {
  configured: boolean;
  data: SystemLoadDataPoint[];
}

/**
 * Fetches dashboard key metrics (organization, user, device, asset counts)
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/dashboard/stats');
}

/**
 * Fetches recent activity from audit logs
 * @param limit Number of recent items to fetch (default: 10, max: 50)
 */
export async function fetchRecentActivity(
  limit = 10
): Promise<RecentActivityItem[]> {
  const response = await apiClient.get<RecentActivityResponse>(
    `/dashboard/recent-activity?limit=${limit}`
  );
  return response.data;
}

/**
 * Fetches current system metrics from Prometheus
 * Returns CPU, memory, disk, and API metrics
 */
export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  return apiClient.get<SystemMetrics>('/dashboard/system-metrics');
}

/**
 * Fetches historical system load data for charts
 * @param range Time range in minutes (default: 60, max: 1440)
 * @param step Step interval in seconds (default: 60)
 */
export async function fetchSystemLoad(
  range = 60,
  step = 60
): Promise<SystemLoadResponse> {
  return apiClient.get<SystemLoadResponse>(
    `/dashboard/system-load?range=${range}&step=${step}`
  );
}

/**
 * Dashboard API object for convenient access
 */
export const dashboardApi = {
  getStats: fetchDashboardStats,
  getRecentActivity: fetchRecentActivity,
  getSystemMetrics: fetchSystemMetrics,
  getSystemLoad: fetchSystemLoad,
};
