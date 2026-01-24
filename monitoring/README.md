# Monitoring Stack

This directory contains the configuration for the Prometheus + Grafana monitoring stack.

## Quick Start (Local Development)

Start the monitoring stack:

```bash
docker compose --profile monitoring up -d
```

Access the services:
- **Grafana**: http://localhost:3001 (admin / argus_dev)
- **Prometheus**: http://localhost:9090
- **Node Exporter**: http://localhost:9100/metrics
- **API Metrics**: http://localhost:3040/metrics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Argus API     │    │  Node Exporter  │    │   Prometheus    │
│  /metrics       │◄───│  Host metrics   │◄───│   Scraping      │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │    Grafana      │
                                              │   Dashboards    │
                                              └─────────────────┘
```

## Directory Structure

```
monitoring/
├── prometheus.yml        # Prometheus scrape configuration
├── alerts.yml            # Alerting rules
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/  # Auto-configured datasources
│   │   └── dashboards/   # Dashboard provisioning
│   └── dashboards/
│       └── argus-system-health.json  # Main dashboard
└── README.md
```

## Application Metrics

The API exposes the following custom metrics at `/metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `argus_http_requests_total` | Counter | Total HTTP requests by method, route, status |
| `argus_http_request_duration_seconds` | Histogram | Request latency distribution |
| `argus_active_connections` | Gauge | Currently active connections |
| `argus_database_pool_size` | Gauge | Database connection pool size |
| `argus_database_pool_available` | Gauge | Available database connections |
| `argus_cache_operations_total` | Counter | Cache operations by type and result |

Default Node.js metrics (heap size, event loop lag, GC, etc.) are also collected.

## Environment Configuration

### Local Development (Default)

```env
METRICS_ENABLED=true
PROMETHEUS_ENDPOINT=http://localhost:9090
```

### AWS Managed Prometheus

```env
METRICS_ENABLED=true
PROMETHEUS_ENDPOINT=https://aps-workspaces.us-east-1.amazonaws.com/workspaces/ws-xxx
PROMETHEUS_AUTH=sigv4
AWS_REGION=us-east-1
PROMETHEUS_REMOTE_WRITE_URL=https://aps-workspaces.us-east-1.amazonaws.com/workspaces/ws-xxx/api/v1/remote_write
```

For AWS deployment, ensure your EC2 instance or ECS task has an IAM role with the `AmazonPrometheusRemoteWriteAccess` policy.

## Dashboard API Endpoints

The dashboard now includes Prometheus-backed endpoints:

### GET /api/v1/dashboard/system-metrics

Returns current system metrics:

```json
{
  "configured": true,
  "healthy": true,
  "metrics": {
    "cpu": { "usage": 45.2, "cores": 4 },
    "memory": { "usage": 62.1, "totalBytes": 8589934592, "usedBytes": 5334212608 },
    "disk": { "usage": 34.5, "totalBytes": 107374182400, "usedBytes": 37044092928 },
    "api": { "requestRate": 12.5, "errorRate": 0.5, "avgLatencyMs": 45.2 }
  }
}
```

### GET /api/v1/dashboard/system-load

Returns time series data for charts:

```json
{
  "configured": true,
  "data": [
    { "timestamp": 1706100000, "cpu": 45.2, "memory": 62.1, "requestRate": 12.5 },
    { "timestamp": 1706100060, "cpu": 47.8, "memory": 61.9, "requestRate": 14.2 }
  ]
}
```

Query parameters:
- `range`: Time range in minutes (default: 60, max: 1440)
- `step`: Step interval in seconds (default: 60)

## Alert Rules

The following alerts are configured in `alerts.yml`:

| Alert | Condition | Severity |
|-------|-----------|----------|
| ArgusApiDown | API not responding for 1m | critical |
| ArgusHighErrorRate | Error rate > 5% for 5m | warning |
| ArgusHighLatency | P95 latency > 1s for 5m | warning |
| NodeHighCPU | CPU usage > 80% for 5m | warning |
| NodeHighMemory | Memory usage > 85% for 5m | warning |
| NodeDiskSpaceLow | Disk usage > 90% | warning |

## Migrating to AWS

1. **Set up AWS Managed Prometheus workspace**:
   ```bash
   aws amp create-workspace --alias argus-production
   ```

2. **Configure remote write** (in Prometheus or using AWS agent):
   - Use the workspace's remote write URL
   - Configure SigV4 authentication

3. **Update environment variables**:
   ```env
   PROMETHEUS_ENDPOINT=https://aps-workspaces.us-east-1.amazonaws.com/workspaces/ws-xxx
   PROMETHEUS_AUTH=sigv4
   AWS_REGION=us-east-1
   ```

4. **Import Grafana dashboards**:
   - Export dashboards from local Grafana (or use files from `grafana/dashboards/`)
   - Import into Amazon Managed Grafana
   - Update datasource references

The API code requires no changes - only configuration.

## Troubleshooting

### Metrics endpoint returns empty

Check that `METRICS_ENABLED` is not set to `false`.

### Prometheus cannot scrape API

Ensure the API is accessible from the Prometheus container:
```bash
docker exec argus-prometheus wget -qO- http://host.docker.internal:3040/metrics
```

### Grafana shows "No data"

1. Verify Prometheus datasource is configured correctly
2. Check that Prometheus is scraping targets: http://localhost:9090/targets
3. Verify metrics exist: http://localhost:9090/graph and query `argus_http_requests_total`

### AWS authentication errors

Ensure:
- `PROMETHEUS_AUTH=sigv4` is set
- `AWS_REGION` matches the workspace region
- IAM credentials have `aps:RemoteWrite` and `aps:QueryMetrics` permissions
