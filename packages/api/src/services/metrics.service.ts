/**
 * Metrics Service
 * Provides application metrics using prom-client
 * Works with both local Prometheus and AWS Managed Prometheus
 *
 * Configuration:
 * - Local: Prometheus scrapes /metrics endpoint
 * - AWS: Use remote_write or push gateway with SigV4 auth
 */

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

// Create a custom registry for application metrics
const register = new Registry();

// Add default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({
  register,
  prefix: 'argus_',
  labels: {
    service: process.env.SERVICE_NAME ?? 'argus-api',
    environment: process.env.NODE_ENV ?? 'development',
  },
});

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: 'argus_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'argus_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'argus_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

export const dbConnectionsActive = new Gauge({
  name: 'argus_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// Authentication metrics
export const authAttemptsTotal = new Counter({
  name: 'argus_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'outcome'] as const,
  registers: [register],
});

// Business metrics
export const activeUsersGauge = new Gauge({
  name: 'argus_active_users',
  help: 'Number of active users in the system',
  registers: [register],
});

export const organizationsGauge = new Gauge({
  name: 'argus_organizations_total',
  help: 'Total number of organizations',
  registers: [register],
});

// Cache metrics
export const cacheHitsTotal = new Counter({
  name: 'argus_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache'] as const,
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: 'argus_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache'] as const,
  registers: [register],
});

/**
 * Get the metrics registry
 */
export function getMetricsRegistry(): Registry {
  return register;
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get the content type for Prometheus metrics
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Helper to measure async function duration
 */
export function measureDuration<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  return fn().finally(() => end());
}
