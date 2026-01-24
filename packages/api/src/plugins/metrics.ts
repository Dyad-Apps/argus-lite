/**
 * Metrics Plugin
 * Exposes Prometheus metrics endpoint and tracks HTTP request metrics
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  getMetrics,
  getMetricsContentType,
  httpRequestsTotal,
  httpRequestDuration,
} from '../services/metrics.service.js';

export interface MetricsPluginOptions {
  /** Path for metrics endpoint (default: /metrics) */
  path?: string;
  /** Whether to collect HTTP request metrics (default: true) */
  collectHttpMetrics?: boolean;
  /** Routes to exclude from metrics collection */
  excludeRoutes?: string[];
}

const metricsPlugin: FastifyPluginAsync<MetricsPluginOptions> = async (
  app: FastifyInstance,
  options: MetricsPluginOptions
) => {
  const {
    path = '/metrics',
    collectHttpMetrics = true,
    excludeRoutes = ['/metrics', '/health/live', '/health/ready'],
  } = options;

  // Register metrics endpoint
  app.get(path, async (request, reply) => {
    try {
      const metrics = await getMetrics();
      reply.header('Content-Type', getMetricsContentType());
      return metrics;
    } catch (error) {
      request.log.error(error, 'Failed to collect metrics');
      reply.status(500);
      return { error: 'Failed to collect metrics' };
    }
  });

  // Track HTTP request metrics
  if (collectHttpMetrics) {
    app.addHook('onRequest', async (request) => {
      // Store start time for duration calculation
      (request as any).metricsStartTime = process.hrtime.bigint();
    });

    app.addHook('onResponse', async (request, reply) => {
      const url = request.routeOptions?.url ?? request.url;

      // Skip excluded routes
      if (excludeRoutes.some((route) => url.startsWith(route))) {
        return;
      }

      const method = request.method;
      const status = reply.statusCode.toString();
      const route = normalizeRoute(url);

      // Increment request counter
      httpRequestsTotal.inc({ method, route, status });

      // Record request duration
      const startTime = (request as any).metricsStartTime;
      if (startTime) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
        httpRequestDuration.observe({ method, route, status }, duration);
      }
    });
  }

  app.log.info(`Metrics endpoint registered at ${path}`);
};

/**
 * Normalize route for metrics labels
 * Replaces dynamic segments with placeholders
 */
function normalizeRoute(url: string): string {
  // Remove query string
  const path = url.split('?')[0];

  // Replace UUIDs with :id
  return path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
}

export default fp(metricsPlugin, {
  name: 'metrics',
  fastify: '5.x',
});
