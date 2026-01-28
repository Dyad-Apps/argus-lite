# IoT Platform Deployment Architecture

## Overview

The IoT platform introduces infrastructure-heavy, stateful services that are fundamentally different from the existing multi-tenant SaaS web application. This document defines the deployment architecture, service separation, and scaling strategy.

---

## Problem Statement

**Current Application Stack**:
- Fastify API (stateless, horizontally scalable)
- React Frontend (static, CDN-served)
- PostgreSQL (single database, vertically scaled)
- Redis (cache, session storage)

**New IoT Services**:
- EMQX MQTT Broker (stateful, needs persistent connections)
- NATS JetStream Cluster (stateful, needs persistent storage)
- 6 Worker Services (stateless, CPU-intensive)
- MQTT→NATS Bridge (stateless)
- Real-Time Broadcaster (stateful, WebSocket connections)

**Why Separate Deployment?**

| Concern | Web App | IoT Services |
|---------|---------|-------------|
| **Connection Type** | Short-lived HTTP | Long-lived MQTT/WebSocket |
| **Port Requirements** | 80/443 only | 1883, 8883, 4222, 6222, 8222 |
| **Scaling Pattern** | Horizontal (stateless) | Hybrid (brokers vertical, workers horizontal) |
| **Resource Profile** | Low CPU, moderate memory | High CPU (workers), high network (brokers) |
| **Tenant Isolation** | Per-request (RLS) | Shared infrastructure, tenant ID in messages |
| **Failure Impact** | Single user request fails | Could affect all device telemetry |
| **Monitoring** | Web metrics (req/sec, latency) | Message throughput, queue depth, consumer lag |
| **Deployment Frequency** | Frequent (features, bug fixes) | Infrequent (infrastructure changes) |

---

## Recommended Deployment Architecture

### Option A: Separate Kubernetes Namespaces (Recommended)

Deploy IoT services in a dedicated namespace with separate resource quotas and network policies.

```
Kubernetes Cluster
├─ Namespace: argusiq-app
│  ├─ Deployment: api (Fastify)
│  ├─ Deployment: frontend (React/Nginx)
│  ├─ StatefulSet: postgres
│  └─ Deployment: redis
│
└─ Namespace: argusiq-iot
   ├─ StatefulSet: emqx (3 replicas)
   ├─ StatefulSet: nats (3 replicas)
   ├─ Deployment: redis-iot (separate instance)
   ├─ Deployment: mqtt-nats-bridge (3 replicas)
   ├─ Deployment: demux-worker (3 replicas)
   ├─ Deployment: normalization-worker (3 replicas)
   ├─ Deployment: tsdb-writer (6 replicas)
   ├─ Deployment: asset-worker (3 replicas)
   ├─ Deployment: realtime-broadcaster (3 replicas)
   └─ Deployment: event-engine (2 replicas)
```

#### Why This Approach?

✅ **Clear separation** - IoT infrastructure isolated from web app
✅ **Independent scaling** - Scale IoT workers without affecting API
✅ **Resource isolation** - Set CPU/memory limits per namespace
✅ **Network policies** - Control traffic between namespaces
✅ **Independent upgrades** - Deploy IoT changes without app downtime
✅ **Cost tracking** - Separate billing/monitoring per namespace
✅ **Security** - Limit blast radius of vulnerabilities

---

### Service Communication

```mermaid
graph TB
    subgraph Internet
        Devices["IoT Devices<br/>(MQTT clients)"]
        WebUsers["Web Users<br/>(Browser)"]
    end

    subgraph LB["Load Balancers"]
        MQTT_LB["MQTT Load Balancer<br/>TCP 1883, 8883"]
        HTTP_LB["HTTP Load Balancer<br/>TCP 80, 443"]
    end

    subgraph K8s_App["K8s Namespace: argusiq-app"]
        API["API Service<br/>(Fastify)"]
        Frontend["Frontend<br/>(React)"]
        Postgres["PostgreSQL<br/>(StatefulSet)"]
        Redis_App["Redis<br/>(App Cache)"]
    end

    subgraph K8s_IoT["K8s Namespace: argusiq-iot"]
        EMQX["EMQX<br/>(StatefulSet)"]
        NATS["NATS JetStream<br/>(StatefulSet)"]
        Bridge["MQTT Bridge<br/>(Deployment)"]
        Workers["Workers<br/>(6 Deployments)"]
        Redis_IoT["Redis<br/>(IoT Cache)"]
        Broadcaster["Real-Time Broadcaster<br/>(Deployment)"]
    end

    Devices -->|MQTT/TLS| MQTT_LB
    WebUsers -->|HTTPS| HTTP_LB

    MQTT_LB --> EMQX
    HTTP_LB --> API
    HTTP_LB --> Frontend

    EMQX -->|Webhook| Bridge
    Bridge -->|Publish| NATS
    NATS -->|Consume| Workers
    Workers -->|Write| Postgres
    Workers -->|Cache| Redis_IoT
    Workers -->|Publish| NATS
    Broadcaster -->|Consume| NATS
    Broadcaster -->|WebSocket| HTTP_LB

    API -->|Query| Postgres
    API -->|Cache| Redis_App
    API -->|HTTP REST| Bridge

    Workers -.->|Invalidate Cache| Redis_App

    style K8s_App fill:#e3f2fd
    style K8s_IoT fill:#fff3e0
    style LB fill:#f3e5f5
```

#### Cross-Namespace Communication

**IoT → App Namespace**:
- Workers write to PostgreSQL (via internal service: `postgres.argusiq-app.svc.cluster.local`)
- Workers invalidate API cache (via Redis pub/sub)
- API queries PostgreSQL for device/asset data

**App → IoT Namespace**:
- API posts telemetry via HTTP to MQTT Bridge (via internal service: `mqtt-bridge.argusiq-iot.svc.cluster.local`)
- Frontend receives WebSocket updates from Real-Time Broadcaster (via external load balancer)

**Security**:
- Network policies restrict cross-namespace traffic to specific services only
- Service accounts with RBAC for inter-namespace communication
- TLS for all inter-service communication

---

## Resource Allocation

### Development Environment (docker-compose)

**Single machine deployment** - All services on one host

```yaml
# docker-compose.yml (simplified deployment)
services:
  # Web App Services
  api:
    cpus: '1'
    mem_limit: 2g

  postgres:
    cpus: '2'
    mem_limit: 4g

  redis:
    cpus: '0.5'
    mem_limit: 1g

  # IoT Infrastructure Services
  emqx:
    cpus: '1'
    mem_limit: 2g

  nats-1:
    cpus: '1'
    mem_limit: 1g

  nats-2:
    cpus: '1'
    mem_limit: 1g

  nats-3:
    cpus: '1'
    mem_limit: 1g

  # IoT Workers (combined for dev)
  mqtt-bridge:
    cpus: '0.5'
    mem_limit: 512m

  demux-worker:
    cpus: '0.5'
    mem_limit: 512m

  normalization-worker:
    cpus: '0.5'
    mem_limit: 512m

  tsdb-writer:
    cpus: '1'
    mem_limit: 1g

  asset-worker:
    cpus: '1'
    mem_limit: 1g

  event-engine:
    cpus: '0.5'
    mem_limit: 512m

  realtime-broadcaster:
    cpus: '0.5'
    mem_limit: 512m

# Total: 13 CPUs, 17GB RAM
```

**Note**: Development uses single instances for simplicity. Production uses replicas for HA.

---

### Production Environment (Kubernetes)

#### Cluster Sizing for 30K msg/sec

**Option 1: Shared Cluster, Separate Namespaces**

```yaml
# Namespace: argusiq-app
ResourceQuota:
  requests.cpu: "8"
  requests.memory: "16Gi"
  limits.cpu: "16"
  limits.memory: "32Gi"

# Namespace: argusiq-iot
ResourceQuota:
  requests.cpu: "20"
  requests.memory: "40Gi"
  limits.cpu: "40"
  limits.memory: "80Gi"

# Total Cluster: 24 vCPU (requests), 56 GB RAM (requests)
# Recommended: 3 nodes × 16 vCPU, 32GB RAM = 48 vCPU, 96GB total
```

**Option 2: Separate Clusters (Higher Isolation)**

```
Cluster 1: argusiq-app
- 3 nodes × 8 vCPU, 16GB RAM
- Total: 24 vCPU, 48GB RAM
- Runs: API, Frontend, PostgreSQL, Redis

Cluster 2: argusiq-iot
- 5 nodes × 8 vCPU, 16GB RAM
- Total: 40 vCPU, 80GB RAM
- Runs: EMQX, NATS, Workers, Bridge
```

**Cost Comparison** (AWS EKS example):

| Option | Nodes | Instance Type | Monthly Cost* |
|--------|-------|---------------|---------------|
| **Shared Cluster** | 3 × c5.4xlarge | 16 vCPU, 32GB | ~$1,200 |
| **Separate Clusters** | 3 × c5.2xlarge + 5 × c5.2xlarge | Total 8 nodes | ~$2,000 |

*Approximate, excludes storage, bandwidth, load balancers

**Recommendation**: Start with **Shared Cluster, Separate Namespaces** for cost efficiency. Move to separate clusters when:
- Need different Kubernetes versions for app vs IoT
- Regulatory/compliance requires physical isolation
- Budget allows for operational overhead of managing 2 clusters

---

## Service-Specific Deployment

### EMQX MQTT Broker

**Deployment Type**: StatefulSet (requires stable network identity)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: emqx
  namespace: argusiq-iot
spec:
  serviceName: emqx-headless
  replicas: 3
  selector:
    matchLabels:
      app: emqx
  template:
    metadata:
      labels:
        app: emqx
    spec:
      containers:
      - name: emqx
        image: emqx/emqx:5.5.0
        ports:
        - containerPort: 1883
          name: mqtt
        - containerPort: 8883
          name: mqtt-ssl
        - containerPort: 18083
          name: dashboard
        resources:
          requests:
            cpu: "2"
            memory: "4Gi"
          limits:
            cpu: "4"
            memory: "8Gi"
        volumeMounts:
        - name: emqx-data
          mountPath: /opt/emqx/data
        - name: certs
          mountPath: /opt/emqx/etc/certs
          readOnly: true
  volumeClaimTemplates:
  - metadata:
      name: emqx-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
```

**Load Balancer**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: emqx-mqtt
  namespace: argusiq-iot
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  ports:
  - port: 1883
    targetPort: 1883
    name: mqtt
  - port: 8883
    targetPort: 8883
    name: mqtt-ssl
  selector:
    app: emqx
```

**Why StatefulSet?**
- Stable network identity (emqx-0, emqx-1, emqx-2)
- Persistent storage for session state
- Ordered deployment/scaling
- Cluster formation requires stable hostnames

**Scaling**:
- Vertical: Increase CPU/memory for high connection count
- Horizontal: Add replicas for >100K concurrent connections

---

### NATS JetStream Cluster

**Deployment Type**: StatefulSet (requires persistent storage)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nats
  namespace: argusiq-iot
spec:
  serviceName: nats-headless
  replicas: 3
  selector:
    matchLabels:
      app: nats
  template:
    metadata:
      labels:
        app: nats
    spec:
      containers:
      - name: nats
        image: nats:2.10-alpine
        command:
        - nats-server
        - --cluster_name=argusiq-cluster
        - --cluster=nats://0.0.0.0:6222
        - --routes=nats://nats-0.nats-headless:6222,nats://nats-1.nats-headless:6222,nats://nats-2.nats-headless:6222
        - --http_port=8222
        - --js
        - --sd=/data
        ports:
        - containerPort: 4222
          name: client
        - containerPort: 6222
          name: cluster
        - containerPort: 8222
          name: monitor
        resources:
          requests:
            cpu: "1"
            memory: "2Gi"
          limits:
            cpu: "2"
            memory: "4Gi"
        volumeMounts:
        - name: nats-data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: nats-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
```

**Service (Headless)**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nats-headless
  namespace: argusiq-iot
spec:
  clusterIP: None
  selector:
    app: nats
  ports:
  - port: 4222
    name: client
  - port: 6222
    name: cluster
```

**Why StatefulSet?**
- Persistent storage for JetStream data
- Cluster formation via stable DNS names
- Data replication across replicas

**Scaling**:
- 3 replicas sufficient for 99.9% availability
- Scale storage (50GB → 100GB+) based on retention needs

---

### Workers (Stateless)

**Deployment Type**: Deployment (stateless, horizontally scalable)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: asset-worker
  namespace: argusiq-iot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: asset-worker
  template:
    metadata:
      labels:
        app: asset-worker
    spec:
      containers:
      - name: worker
        image: argusiq/asset-worker:latest
        env:
        - name: NATS_URL
          value: "nats://nats-headless:4222"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: url
        - name: REDIS_HOST
          value: "redis-iot"
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1"
            memory: "1Gi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: asset-worker-hpa
  namespace: argusiq-iot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: asset-worker
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: nats_consumer_lag
      target:
        type: AverageValue
        averageValue: "1000"
```

**Why Deployment?**
- Stateless (no persistent storage)
- Horizontally scalable based on CPU or queue depth
- Rolling updates without data loss (NATS redelivers)

**Worker Sizing**:

| Worker | Min Replicas | Max Replicas | CPU (each) | Memory (each) | Reason |
|--------|--------------|--------------|------------|---------------|--------|
| Demux | 2 | 5 | 500m | 512Mi | CPU-intensive (parsing) |
| Normalization | 3 | 10 | 500m | 512Mi | JSON validation |
| TSDB Writer | 6 | 20 | 1000m | 1Gi | Batch DB writes |
| Asset Processor | 3 | 10 | 1000m | 1Gi | Complex calculations |
| Event Engine | 2 | 5 | 500m | 512Mi | Rule evaluation |
| Realtime Broadcaster | 3 | 8 | 500m | 512Mi | WebSocket connections |

**Total (min)**: 19 replicas, 11.5 CPU, 11.5 GB RAM
**Total (max)**: 58 replicas, 33.5 CPU, 35.5 GB RAM

---

## Network Architecture

### Ports & Protocols

| Service | Port | Protocol | Exposed | Purpose |
|---------|------|----------|---------|---------|
| **EMQX** | 1883 | MQTT | External | Device connections (non-TLS) |
| **EMQX** | 8883 | MQTT/TLS | External | Device connections (mTLS) |
| **EMQX** | 18083 | HTTP | Internal | Admin dashboard |
| **NATS** | 4222 | NATS | Internal | Client connections |
| **NATS** | 6222 | NATS | Internal | Cluster routes |
| **NATS** | 8222 | HTTP | Internal | Monitoring |
| **API** | 3000 | HTTP | External | REST API |
| **Frontend** | 80/443 | HTTP/HTTPS | External | Web UI |
| **Broadcaster** | 3002 | WebSocket | External | Real-time updates |

### Network Policies

**Restrict IoT namespace access**:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: iot-namespace-policy
  namespace: argusiq-iot
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Allow EMQX from internet
  - from:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 8883
  # Allow workers to talk to each other
  - from:
    - podSelector:
        matchLabels:
          tier: worker
  egress:
  # Allow workers to access Postgres in app namespace
  - to:
    - namespaceSelector:
        matchLabels:
          name: argusiq-app
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  # Allow workers to access NATS
  - to:
    - podSelector:
        matchLabels:
          app: nats
    ports:
    - protocol: TCP
      port: 4222
```

---

## Storage Strategy

### Data Persistence Requirements

| Service | Storage Type | Size | Retention | Backup |
|---------|--------------|------|-----------|--------|
| **EMQX** | Persistent Volume | 20GB | Session state | No (stateless clients) |
| **NATS** | Persistent Volume | 50GB | 7 days raw, 1 day processed | Yes (snapshots) |
| **PostgreSQL** | Persistent Volume | 500GB | Permanent | Yes (daily, PITR) |
| **Redis** | Ephemeral (with AOF) | 20GB | Cache only | No |

### TimescaleDB Retention Policies

```sql
-- Raw telemetry: 7 days
SELECT add_retention_policy('telemetry_raw', INTERVAL '7 days');

-- Processed telemetry: 1 year
SELECT add_retention_policy('telemetry_history', INTERVAL '1 year');

-- Aggregated telemetry: Forever (with compression)
SELECT add_compression_policy('telemetry_history_5min', INTERVAL '7 days');
```

### NATS JetStream Retention

```typescript
// Stream retention: 7 days or 10GB (whichever hits first)
await jsm.streams.add({
  name: 'TELEMETRY_RAW_V1',
  retention: 'limits',
  max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days
  max_bytes: 10 * 1024 * 1024 * 1024, // 10GB
});
```

---

## Monitoring & Observability

### Prometheus Metrics

**Per-Namespace Monitoring**:

```yaml
# ServiceMonitor for IoT namespace
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: iot-workers
  namespace: argusiq-iot
spec:
  selector:
    matchLabels:
      tier: worker
  endpoints:
  - port: metrics
    interval: 30s
```

**Key Metrics**:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `iot_messages_received_total` | Messages ingested | < 100 msg/sec for 5min |
| `iot_messages_processed_total` | Messages processed | Rate < ingestion rate |
| `iot_processing_duration_seconds` | Worker latency | P95 > 5s |
| `iot_nats_consumer_lag` | Consumer lag | > 10,000 messages |
| `iot_dlq_size` | Dead letter queue size | > 100 messages |
| `iot_worker_errors_total` | Worker errors | > 10 errors/min |
| `emqx_connections_count` | MQTT connections | > 80% of limit |
| `nats_jetstream_storage_bytes` | NATS storage | > 80% of limit |

### Grafana Dashboards

**Dashboard 1: IoT Infrastructure Overview**
- Total messages/sec (ingestion, processing, output)
- Worker health (CPU, memory, replica count)
- NATS stream sizes
- EMQX connection count
- End-to-end latency

**Dashboard 2: Worker Performance**
- Per-worker throughput
- Consumer lag per worker
- Error rates
- DLQ size

**Dashboard 3: Resource Utilization**
- CPU/memory per namespace
- Storage usage
- Network bandwidth

---

## Deployment Workflow

### Development → Staging → Production

```
Development (docker-compose)
    ↓
    docker build + push to registry
    ↓
Staging (K8s namespace: argusiq-iot-staging)
    ↓
    Automated tests
    ↓
    Manual approval
    ↓
Production (K8s namespace: argusiq-iot)
```

### GitOps with ArgoCD

```yaml
# ArgoCD Application for IoT namespace
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: argusiq-iot
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/yourorg/argusiq-lite
    targetRevision: main
    path: k8s/iot
  destination:
    server: https://kubernetes.default.svc
    namespace: argusiq-iot
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

### Zero-Downtime Deployment

**Workers**:
- Rolling update (default)
- NATS redelivers messages to new replicas
- No data loss

**EMQX**:
- Blue/green deployment
- Move load balancer to new version
- Drain connections from old version

**NATS**:
- Rolling update (one node at a time)
- Cluster maintains quorum with 2/3 nodes

---

## Cost Optimization

### Recommendations

1. **Use Spot Instances for Workers** (AWS, GCP)
   - Workers are stateless and can handle interruptions
   - NATS redelivers messages automatically
   - Save 60-80% on compute costs

2. **Separate Storage Classes**
   - NATS: gp3 (cheaper, slower is fine)
   - PostgreSQL: io2 (faster, critical for OLTP)
   - EMQX: gp3 (session state, acceptable latency)

3. **Autoscaling Configuration**
   - Scale down to min replicas during off-hours
   - Scale up based on queue depth (proactive)
   - Use PodDisruptionBudget to ensure availability

4. **Network Egress Optimization**
   - Use VPC peering for inter-namespace communication
   - Keep MQTT load balancer in same AZ as EMQX pods
   - Use private service endpoints where possible

**Monthly Cost Estimate** (AWS):

| Component | Size | Monthly Cost |
|-----------|------|--------------|
| EC2 Instances (shared cluster) | 3 × c5.4xlarge | $1,200 |
| EBS Storage (NATS + EMQX) | 200GB gp3 | $16 |
| EBS Storage (PostgreSQL) | 500GB io2 | $250 |
| Network Load Balancer | 1 × NLB | $25 |
| Data Transfer | 1TB/month | $90 |
| **Total** | | **~$1,580/month** |

For 100K messages/second: ~$3,200/month (scale up nodes)

---

## Development Setup

### Local docker-compose

For local development, all services run on one machine:

```bash
# Start web app only
docker-compose up api postgres redis frontend

# Start IoT services only
docker-compose up emqx nats-1 mqtt-bridge demux-worker normalization-worker

# Start everything
docker-compose up
```

### Minikube/Kind (Local Kubernetes)

Test K8s deployment locally:

```bash
# Create namespaces
kubectl create namespace argusiq-app
kubectl create namespace argusiq-iot

# Deploy IoT services
kubectl apply -f k8s/iot/ -n argusiq-iot

# Port forward for testing
kubectl port-forward -n argusiq-iot svc/emqx-mqtt 8883:8883
kubectl port-forward -n argusiq-iot svc/nats 4222:4222
```

---

## Security Considerations

### Network Isolation

- IoT namespace can only access:
  - PostgreSQL in app namespace (port 5432)
  - Redis in app namespace (port 6379)
- App namespace can only access:
  - MQTT Bridge in IoT namespace (port 3001)
  - Realtime Broadcaster in IoT namespace (port 3002)

### Secrets Management

**Option 1: Kubernetes Secrets**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-connection
  namespace: argusiq-iot
type: Opaque
stringData:
  url: postgresql://user:pass@postgres.argusiq-app:5432/argusiq
```

**Option 2: External Secrets Operator** (Recommended)
- Store secrets in AWS Secrets Manager / GCP Secret Manager
- Sync to Kubernetes via External Secrets Operator
- Rotate secrets without redeploying

### RBAC

```yaml
# Service account for workers to access Postgres
apiVersion: v1
kind: ServiceAccount
metadata:
  name: iot-worker
  namespace: argusiq-iot
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: iot-worker-postgres-access
  namespace: argusiq-app
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: postgres-client
subjects:
- kind: ServiceAccount
  name: iot-worker
  namespace: argusiq-iot
```

---

## Summary

### Deployment Strategy

✅ **Separate Kubernetes Namespaces** (argusiq-app, argusiq-iot)
✅ **Shared cluster** for cost efficiency (3 nodes × 16 vCPU, 32GB RAM)
✅ **StatefulSets** for EMQX and NATS (persistent storage)
✅ **Deployments** for workers (stateless, autoscaling)
✅ **Network policies** for cross-namespace isolation
✅ **Separate monitoring** per namespace

### Key Principles

1. **Logical Separation** - IoT services isolated in dedicated namespace
2. **Independent Scaling** - Scale IoT workers without affecting web app
3. **Resource Isolation** - CPU/memory quotas per namespace
4. **Cost Efficiency** - Shared infrastructure, spot instances for workers
5. **Security** - Network policies, RBAC, secrets management
6. **Observability** - Per-namespace metrics and dashboards

### Migration Path

**Phase 1**: Deploy IoT services in separate namespace (Week 1)
**Phase 2**: Test with simulated devices (Week 2-3)
**Phase 3**: Onboard 10 real devices (Week 4)
**Phase 4**: Scale to 100+ devices (Week 5-8)
**Phase 5**: Production ready, 1000+ devices (Week 9-12)

---

## Next Steps

1. **Create K8s manifests** for IoT namespace
2. **Set up CI/CD pipeline** for IoT services (separate from web app)
3. **Configure monitoring** (Prometheus, Grafana)
4. **Document runbook** for IoT operations team
5. **Implement network policies** for security
6. **Test failover scenarios** (node failure, pod restarts)

This deployment architecture ensures the IoT platform is **production-ready, scalable, and maintainable** while keeping costs reasonable.
