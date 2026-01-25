/**
 * Prometheus Query Client
 * Provides a unified interface for querying metrics from:
 * - Local Prometheus (development)
 * - AWS Managed Prometheus (production)
 *
 * Configuration:
 * - PROMETHEUS_ENDPOINT: Base URL for Prometheus API
 * - PROMETHEUS_AUTH: 'none' | 'sigv4' (default: 'none')
 * - AWS_REGION: Required when PROMETHEUS_AUTH=sigv4
 */

import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

export interface PrometheusConfig {
  endpoint: string;
  auth: 'none' | 'sigv4';
  region?: string;
}

export interface PrometheusQueryResult {
  status: 'success' | 'error';
  data?: {
    resultType: 'matrix' | 'vector' | 'scalar' | 'string';
    result: PrometheusMetricResult[];
  };
  error?: string;
  errorType?: string;
}

export interface PrometheusMetricResult {
  metric: Record<string, string>;
  value?: [number, string]; // [timestamp, value] for instant queries
  values?: [number, string][]; // [[timestamp, value], ...] for range queries
}

/**
 * Get Prometheus configuration from environment
 */
export function getPrometheusConfig(): PrometheusConfig {
  return {
    endpoint: process.env.PROMETHEUS_ENDPOINT ?? 'http://localhost:9090',
    auth: (process.env.PROMETHEUS_AUTH as 'none' | 'sigv4') ?? 'none',
    region: process.env.AWS_REGION,
  };
}

/**
 * Check if Prometheus is explicitly configured via environment variable
 */
export function isPrometheusConfigured(): boolean {
  // Only return true if PROMETHEUS_ENDPOINT is explicitly set
  // Don't rely on the default localhost:9090 since it's unlikely to exist
  return !!process.env.PROMETHEUS_ENDPOINT;
}

/**
 * Prometheus Query Client
 */
class PrometheusClient {
  private config: PrometheusConfig;
  private signer?: SignatureV4;

  constructor(config: PrometheusConfig) {
    this.config = config;

    if (config.auth === 'sigv4' && config.region) {
      this.signer = new SignatureV4({
        service: 'aps',
        region: config.region,
        credentials: defaultProvider(),
        sha256: Sha256,
      });
    }
  }

  /**
   * Execute an instant query
   */
  async query(promql: string, time?: Date): Promise<PrometheusQueryResult> {
    const params = new URLSearchParams({
      query: promql,
    });

    if (time) {
      params.set('time', (time.getTime() / 1000).toString());
    }

    return this.fetch(`/api/v1/query?${params}`);
  }

  /**
   * Execute a range query
   */
  async queryRange(
    promql: string,
    start: Date,
    end: Date,
    step: string = '15s'
  ): Promise<PrometheusQueryResult> {
    const params = new URLSearchParams({
      query: promql,
      start: (start.getTime() / 1000).toString(),
      end: (end.getTime() / 1000).toString(),
      step,
    });

    return this.fetch(`/api/v1/query_range?${params}`);
  }

  /**
   * Get current value of a metric
   */
  async getMetricValue(promql: string): Promise<number | null> {
    try {
      const result = await this.query(promql);

      if (result.status === 'success' && result.data?.result?.[0]?.value) {
        return parseFloat(result.data.result[0].value[1]);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if Prometheus is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/-/healthy`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Make a request to Prometheus API
   */
  private async fetch(path: string): Promise<PrometheusQueryResult> {
    const url = `${this.config.endpoint}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Sign request for AWS Managed Prometheus
    if (this.config.auth === 'sigv4' && this.signer) {
      const signedRequest = await this.signRequest(url, 'GET', headers);
      Object.assign(headers, signedRequest.headers);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Prometheus query failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sign a request using AWS SigV4
   */
  private async signRequest(
    url: string,
    method: string,
    headers: Record<string, string>
  ) {
    if (!this.signer) {
      throw new Error('SigV4 signer not configured');
    }

    const parsedUrl = new URL(url);

    return this.signer.sign({
      method,
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port) : undefined,
      path: parsedUrl.pathname + parsedUrl.search,
      headers,
    });
  }
}

// Singleton instance
let client: PrometheusClient | null = null;

/**
 * Get the Prometheus client instance
 */
export function getPrometheusClient(): PrometheusClient {
  if (!client) {
    client = new PrometheusClient(getPrometheusConfig());
  }
  return client;
}

/**
 * Reset the client (useful for testing)
 */
export function resetPrometheusClient(): void {
  client = null;
}
