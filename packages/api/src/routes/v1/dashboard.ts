/**
 * Dashboard routes - Stats and recent activity for the home/dashboard page
 * All routes require authentication
 *
 * System metrics are now powered by Prometheus queries.
 * See ADR-003 for data source classification.
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  getOrganizationRepository,
  getUserRepository,
} from '../../repositories/index.js';
import { getRecentActivity } from '../../repositories/audit-log.repository.js';
import { createOrganizationId } from '@argus/shared';
import {
  getPrometheusClient,
  isPrometheusConfigured,
} from '../../services/prometheus-client.service.js';

// Response schemas
const dashboardStatsSchema = z.object({
  organizations: z.number(),
  users: z.number(),
  devices: z.number(),
  assets: z.number(),
});

const recentActivityItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  action: z.string(),
  userEmail: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  outcome: z.string(),
  createdAt: z.string(),
});

const recentActivityResponseSchema = z.object({
  data: z.array(recentActivityItemSchema),
});

// System metrics schemas (Prometheus-backed)
const systemMetricsSchema = z.object({
  configured: z.boolean(),
  healthy: z.boolean(),
  metrics: z
    .object({
      cpu: z.object({
        usage: z.number().nullable(),
        cores: z.number().nullable(),
      }),
      memory: z.object({
        usage: z.number().nullable(),
        totalBytes: z.number().nullable(),
        usedBytes: z.number().nullable(),
      }),
      disk: z.object({
        usage: z.number().nullable(),
        totalBytes: z.number().nullable(),
        usedBytes: z.number().nullable(),
      }),
      api: z.object({
        requestRate: z.number().nullable(),
        errorRate: z.number().nullable(),
        avgLatencyMs: z.number().nullable(),
      }),
    })
    .nullable(),
});

const systemLoadDataPointSchema = z.object({
  timestamp: z.number(),
  cpu: z.number().nullable(),
  memory: z.number().nullable(),
  requestRate: z.number().nullable(),
});

const systemLoadResponseSchema = z.object({
  configured: z.boolean(),
  data: z.array(systemLoadDataPointSchema),
});

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const orgRepo = getOrganizationRepository();
  const userRepo = getUserRepository();

  // All dashboard routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /dashboard/stats - Get key metrics counts
  app.withTypeProvider<ZodTypeProvider>().get(
    '/stats',
    {
      schema: {
        response: {
          200: dashboardStatsSchema,
        },
      },
    },
    async () => {
      // Get counts from database
      const [orgResult, userResult] = await Promise.all([
        orgRepo.findAll({ page: 1, pageSize: 1 }),
        userRepo.findAll({ page: 1, pageSize: 1 }),
      ]);

      // Devices and assets are 0 until Entity CRUD API is implemented
      // See ADR-003 for data source classification
      return {
        organizations: orgResult.pagination.totalCount,
        users: userResult.pagination.totalCount,
        devices: 0,
        assets: 0,
      };
    }
  );

  // GET /dashboard/recent-activity - Get recent activity from audit logs
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recent-activity',
    {
      schema: {
        querystring: z.object({
          organizationId: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(50).default(10),
        }),
        response: {
          200: recentActivityResponseSchema,
        },
      },
    },
    async (request) => {
      const { organizationId, limit } = request.query;

      const data = await getRecentActivity(
        organizationId ? createOrganizationId(organizationId) : undefined,
        limit
      );

      return {
        data: data.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    }
  );

  // GET /dashboard/system-metrics - Get current system metrics from Prometheus
  app.withTypeProvider<ZodTypeProvider>().get(
    '/system-metrics',
    {
      schema: {
        response: {
          200: systemMetricsSchema,
        },
      },
    },
    async () => {
      if (!isPrometheusConfigured()) {
        return {
          configured: false,
          healthy: false,
          metrics: null,
        };
      }

      const client = getPrometheusClient();
      const healthy = await client.isHealthy();

      if (!healthy) {
        return {
          configured: true,
          healthy: false,
          metrics: null,
        };
      }

      // Query Prometheus for current metrics
      // Note: Queries are designed to work with node_exporter in Docker containers
      const [
        cpuUsage,
        cpuCores,
        memUsage,
        memTotal,
        memUsed,
        diskUsage,
        diskTotal,
        diskUsed,
        requestRate,
        errorRate,
        avgLatency,
      ] = await Promise.all([
        // CPU usage percentage (from node_exporter)
        // Use irate for more accurate instant rate, clamp to 0-100
        client.getMetricValue(
          'clamp_min(clamp_max(100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100), 100), 0)'
        ),
        // CPU cores - count unique cpu labels
        client.getMetricValue(
          'count(count by (cpu) (node_cpu_seconds_total{mode="idle"}))'
        ),
        // Memory usage percentage
        client.getMetricValue(
          '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)'
        ),
        // Memory total
        client.getMetricValue('node_memory_MemTotal_bytes'),
        // Memory used
        client.getMetricValue(
          'node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes'
        ),
        // Disk usage percentage - try / first, then any non-tmpfs, finally any filesystem
        client.getMetricValue(
          '100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) or ' +
            '100 * (1 - max(node_filesystem_avail_bytes{fstype!="tmpfs"}) / max(node_filesystem_size_bytes{fstype!="tmpfs"})) or ' +
            '100 * (1 - max(node_filesystem_avail_bytes) / max(node_filesystem_size_bytes))'
        ),
        // Disk total - try / first, then any non-tmpfs, finally any filesystem
        client.getMetricValue(
          'node_filesystem_size_bytes{mountpoint="/"} or ' +
            'max(node_filesystem_size_bytes{fstype!="tmpfs"}) or ' +
            'max(node_filesystem_size_bytes)'
        ),
        // Disk used - try / first, then any non-tmpfs, finally any filesystem
        client.getMetricValue(
          '(node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"}) or ' +
            '(max(node_filesystem_size_bytes{fstype!="tmpfs"}) - max(node_filesystem_avail_bytes{fstype!="tmpfs"})) or ' +
            '(max(node_filesystem_size_bytes) - max(node_filesystem_avail_bytes))'
        ),
        // API request rate (per second over last 5 minutes)
        client.getMetricValue('sum(rate(argus_http_requests_total[5m]))'),
        // API error rate (4xx and 5xx) - handle division by zero
        client.getMetricValue(
          'sum(rate(argus_http_requests_total{status=~"4..|5.."}[5m])) / sum(rate(argus_http_requests_total[5m])) * 100 or vector(0)'
        ),
        // Average latency in milliseconds
        client.getMetricValue(
          '(sum(rate(argus_http_request_duration_seconds_sum[5m])) / sum(rate(argus_http_request_duration_seconds_count[5m]))) * 1000 or vector(0)'
        ),
      ]);

      return {
        configured: true,
        healthy: true,
        metrics: {
          cpu: {
            usage: cpuUsage,
            cores: cpuCores,
          },
          memory: {
            usage: memUsage,
            totalBytes: memTotal,
            usedBytes: memUsed,
          },
          disk: {
            usage: diskUsage,
            totalBytes: diskTotal,
            usedBytes: diskUsed,
          },
          api: {
            requestRate: requestRate,
            errorRate: errorRate,
            avgLatencyMs: avgLatency,
          },
        },
      };
    }
  );

  // GET /dashboard/system-load - Get historical system load data for charts
  app.withTypeProvider<ZodTypeProvider>().get(
    '/system-load',
    {
      schema: {
        querystring: z.object({
          // Time range in minutes (default 60 = 1 hour)
          range: z.coerce.number().int().min(5).max(1440).default(60),
          // Step interval in seconds (default 60 = 1 minute)
          step: z.coerce.number().int().min(15).max(300).default(60),
        }),
        response: {
          200: systemLoadResponseSchema,
        },
      },
    },
    async (request) => {
      if (!isPrometheusConfigured()) {
        return {
          configured: false,
          data: [],
        };
      }

      const client = getPrometheusClient();
      const healthy = await client.isHealthy();

      if (!healthy) {
        return {
          configured: true,
          data: [],
        };
      }

      const { range, step } = request.query;
      const end = new Date();
      const start = new Date(end.getTime() - range * 60 * 1000);

      // Query time series data
      // Note: Using clamp for CPU to handle edge cases in containerized environments
      const [cpuResult, memResult, requestResult] = await Promise.all([
        client.queryRange(
          'clamp_min(clamp_max(100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[1m])) * 100), 100), 0)',
          start,
          end,
          `${step}s`
        ),
        client.queryRange(
          '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
          start,
          end,
          `${step}s`
        ),
        client.queryRange(
          'sum(rate(argus_http_requests_total[1m])) or vector(0)',
          start,
          end,
          `${step}s`
        ),
      ]);

      // Combine results into a unified time series
      const cpuValues = cpuResult.data?.result?.[0]?.values ?? [];
      const memValues = memResult.data?.result?.[0]?.values ?? [];
      const requestValues = requestResult.data?.result?.[0]?.values ?? [];

      // Create a map of timestamp -> data point
      const dataMap = new Map<
        number,
        { cpu: number | null; memory: number | null; requestRate: number | null }
      >();

      for (const [ts, val] of cpuValues) {
        const timestamp = Math.floor(ts);
        if (!dataMap.has(timestamp)) {
          dataMap.set(timestamp, { cpu: null, memory: null, requestRate: null });
        }
        dataMap.get(timestamp)!.cpu = parseFloat(val);
      }

      for (const [ts, val] of memValues) {
        const timestamp = Math.floor(ts);
        if (!dataMap.has(timestamp)) {
          dataMap.set(timestamp, { cpu: null, memory: null, requestRate: null });
        }
        dataMap.get(timestamp)!.memory = parseFloat(val);
      }

      for (const [ts, val] of requestValues) {
        const timestamp = Math.floor(ts);
        if (!dataMap.has(timestamp)) {
          dataMap.set(timestamp, { cpu: null, memory: null, requestRate: null });
        }
        dataMap.get(timestamp)!.requestRate = parseFloat(val);
      }

      // Convert to sorted array
      const data = Array.from(dataMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([timestamp, values]) => ({
          timestamp,
          ...values,
        }));

      return {
        configured: true,
        data,
      };
    }
  );
}
