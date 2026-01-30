# ArgusIQ Lite - IoT Platform Architecture Design

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Architecture Design Phase
**Target Throughput:** 30,000 messages/second
**Primary Protocol:** MQTT with mTLS
**Real-Time:** WebSocket for UI updates

---

## 1. Executive Summary

This document defines the production-grade architecture for ArgusIQ Lite's IoT Platform, capable of:

- **Ingesting 30K messages/second** from MQTT devices
- **Real-time UI updates** via WebSocket
- **Certificate-based device authentication** (mTLS)
- **Device onboarding workflow** (authorized devices only)
- **Asset-centric telemetry** (device data mapped to business assets)
- **Event-driven automation** (telemetry → events → activities)
- **Zero data loss** through immutable storage and replay capability

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph DeviceLayer["DEVICE LAYER"]
        Devices["Devices with mTLS Certs"]
        MQTT["MQTT Broker<br/>(EMQX)"]
        Simulator["Device Simulator<br/>(Testing)"]
        Devices --> MQTT
        Simulator -.-> MQTT
    end

    subgraph IngestionLayer["INGESTION LAYER"]
        Bridge["MQTT Bridge Service<br/>(MQTT subscriber → NATS publisher)"]
        NATS["Message Bus<br/>(NATS JetStream)<br/>30K/sec capable"]
        RawStream["Stream: telemetry.raw.v1<br/>(Immutable, Replay Source)"]
        Bridge --> NATS
        NATS --> RawStream
    end

    subgraph ProcessingLayer["PROCESSING LAYER"]
        Norm["[1] Normalization Worker<br/>• Validate schema<br/>• Enrich metadata<br/>• Write to telemetry_raw<br/>• Publish: telemetry.normalized.v1"]
        TSDB["[2] TSDB Writer Worker<br/>• Consume: telemetry.normalized.v1<br/>• Write to TimescaleDB<br/>• Idempotent writes"]
        Asset["[3] Asset Telemetry Worker<br/>• Query device-asset links<br/>• Map device → asset metrics<br/>• Compute health scores<br/>• Publish: telemetry.asset.v1"]
        Event["[4] Event Engine Worker<br/>• Evaluate threshold rules<br/>• On breach: Create system_events<br/>• Publish: events.threshold.v1"]
        Activity["[5] Activity Creator Worker<br/>• Match event → template<br/>• Create activities<br/>• Publish: activities.created.v1"]
        RT["[6] Real-Time Broadcaster<br/>• Consume all streams<br/>• Broadcast to WebSocket<br/>• UI updates <2sec"]

        Norm --> TSDB
        Norm --> Asset
        Asset --> Event
        Event --> Activity
        Norm --> RT
        Event --> RT
        Activity --> RT
    end

    subgraph DataLayer["DATA LAYER"]
        PG["PostgreSQL + TimescaleDB<br/>• telemetry_raw<br/>• telemetry_history<br/>• devices, assets, edges<br/>• threshold_rules<br/>• system_events, activities"]
        Redis["Redis Cache<br/>• Device-asset links (5min TTL)<br/>• Device metadata (1hr TTL)<br/>• WebSocket subscriptions"]
    end

    subgraph APILayer["API & UI LAYER"]
        API["Fastify API Server<br/>• REST APIs<br/>• WebSocket Server<br/>• Device Onboarding<br/>• Telemetry Query"]
        UI["React Frontend<br/>• IoT Hub<br/>• Asset Hub<br/>• Real-time charts<br/>• Device simulator UI"]
    end

    MQTT -.->|"Bridge subscribes to topics"| Bridge
    RawStream --> Norm
    TSDB --> PG
    Asset --> PG
    Asset --> Redis
    Event --> PG
    Activity --> PG
    RT --> API
    API --> UI

    style DeviceLayer fill:#e1f5ff
    style IngestionLayer fill:#fff3e0
    style ProcessingLayer fill:#f3e5f5
    style DataLayer fill:#e8f5e9
    style APILayer fill:#fce4ec
```

---

## 3. Technology Stack Decisions

### 3.1 Message Bus: **NATS JetStream** (Recommended)

| Criteria | Redis Streams | NATS JetStream | Kafka | Decision |
|----------|---------------|----------------|-------|----------|
| **Throughput** | ~10-50K/sec | ~1M/sec | ~100K+/sec | ✅ NATS (headroom) |
| **Latency** | <10ms | <5ms | ~50ms | ✅ NATS (real-time) |
| **Persistence** | RDB/AOF | Built-in | Built-in | ✅ NATS (simpler) |
| **Replay** | Manual | Native | Native | ✅ NATS/Kafka |
| **Ops Complexity** | Low | Low | High | ✅ NATS (2 nodes) |
| **Ecosystem** | Mature | Growing | Mature | All good |
| **Cost** | Low (1 node) | Low (2-3 nodes) | Medium (3+ nodes) | ✅ NATS |

**Decision: NATS JetStream**
- **Why**: 30K/sec is 3% of NATS capacity (safe margin)
- Lightweight (Go binary, <100MB RAM baseline)
- Built-in persistence and replay
- Consumer groups for horizontal scaling
- Low latency for real-time requirements
- Easy to deploy (2-3 node cluster in docker-compose)

**Redis Still Used For**:
- Device-asset link cache (hot path optimization)
- Device metadata cache
- WebSocket pub/sub (Socket.IO adapter)
- Rate limiting

### 3.2 MQTT Broker: **EMQX** (Recommended)

| Criteria | Mosquitto | EMQX | VerneMQ | Decision |
|----------|-----------|------|---------|----------|
| **Throughput** | ~100K/sec | ~2M/sec | ~500K/sec | ✅ EMQX (headroom) |
| **mTLS Support** | ✅ | ✅ | ✅ | All good |
| **Clustering** | No | ✅ | ✅ | ✅ EMQX |
| **Dashboard** | No | ✅ (built-in) | Basic | ✅ EMQX |
| **Bridging** | Manual | Built-in | Built-in | ✅ EMQX |
| **Webhook/Rules** | No | ✅ (powerful) | Limited | ✅ EMQX |
| **License** | EPL | Apache 2.0 | Apache 2.0 | All good |

**Decision: EMQX**
- **Why**: 30K/sec is 1.5% of capacity (huge headroom)
- Built-in web dashboard for monitoring
- Native bridge to NATS (or we write custom bridge)
- mTLS certificate validation (client certs)
- Webhook rules engine (can trigger on connect/disconnect)
- Scales horizontally (if needed later)

**Alternative**: Mosquitto (simpler, sufficient if EMQX overkill)

### 3.2.1 EMQX → Bridge Integration Pattern

**Decision: Bridge subscribes to EMQX as MQTT client (Option 2)**

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Option 1: EMQX Rule Engine → HTTP Webhook** | Simple mental model (broker pushes) | HTTP retry/backpressure complexity, webhook delivery guarantees, extra HTTP layer | ❌ Not chosen |
| **Option 2: Bridge subscribes to EMQX topics** | Standard MQTT flow control, shared subscriptions for scaling, clearer at-least-once semantics, fewer moving parts | Bridge must maintain MQTT connection | ✅ **Chosen for MVP** |

**Why Option 2:**
- **Simpler architecture**: Bridge is just another MQTT client with QoS 1
- **Better backpressure**: MQTT has built-in flow control (PUBACK acknowledgments)
- **Easier horizontal scaling**: Use EMQX shared subscriptions (`$share/bridge-group/v1/telemetry/#`) so multiple Bridge replicas automatically split the load
- **Clearer semantics**: Standard MQTT at-least-once delivery guarantees
- **No HTTP layer**: Removes webhook retry complexity and HTTP-specific failure modes
- **Easier to test**: Standard MQTT client testing tools work out of the box

**Implementation Details:**
- Bridge subscribes to topic pattern: `$share/bridge-group/v1/telemetry/{orgId}/{deviceId}`
- Shared subscription group: `bridge-group` (multiple Bridge instances auto-balance)
- QoS 1: At-least-once delivery (Bridge must handle duplicate messages idempotently)
- Connection: Bridge uses service account credentials (not mTLS, just username/password or token)

### 3.3 Time-Series Database: **TimescaleDB**

**Decision: TimescaleDB (Postgres extension)**
- Already using PostgreSQL
- Convert `telemetry_history` to hypertable (one SQL command)
- Continuous aggregates for rollups
- Compression (10x storage savings after 7 days)
- Retention policies (auto-delete old data)
- No new infrastructure to manage

**Future Consideration**: If >100K/sec later, migrate to QuestDB or InfluxDB

### 3.4 Real-Time Updates: **Socket.IO**

**Decision: Socket.IO over WebSocket**
- **Why**: Fallback to long-polling (compatibility)
- Room-based subscriptions (per organization)
- Redis adapter for multi-server scaling
- Built-in reconnection logic
- Typed events (TypeScript)

**Alternative**: Server-Sent Events (simpler, one-way only)

### 3.5 Device Authentication: **mTLS (Mutual TLS)**

**Decision: X.509 Client Certificates**
- Devices present certificate during MQTT connect
- EMQX validates cert against CA certificate
- Certificate CN (Common Name) = Device ID (UUID)
- Certificates stored in `device_certificates` table
- Onboarding flow generates cert, device downloads it

---

## 4. Data Flow: Device → UI (Complete Path)

### 4.1 Device Publishes Telemetry

```
Device (deviceId=abc-123, cert=valid)
  ↓ TLS handshake with client cert
EMQX Broker (validates cert CN=abc-123)
  ↓ MQTT PUBLISH to topic: v1/telemetry/{orgId}/{deviceId}
  Payload: { "ts": 1706370000, "metrics": { "temp": 25.5, "pressure": 101.3 } }
```

### 4.2 EMQX → NATS Bridge

```
MQTT Bridge Service (runs as MQTT client)
  ↓ Subscribes to: $share/bridge-group/v1/telemetry/{orgId}/{deviceId}
  ↓ Receives message with QoS 1 (at-least-once)
  ↓ Validates: deviceId exists in DB, orgId matches, payload schema valid
  ↓ Extract orgId, deviceId from topic
  ↓ Enrich: { "deviceId", "orgId", "ts", "metrics", "receivedAt" }
NATS JetStream: telemetry.raw.v1
  ↓ Persisted to disk (durable)
  ↓ Ack back to NATS
  ↓ MQTT Ack back to EMQX (message processed)

Note: EMQX shared subscriptions ($share/bridge-group/...) enable horizontal scaling
Multiple Bridge replicas share the message load automatically
```

### 4.3 Normalization Worker

```
Worker 1: Consume telemetry.raw.v1
  ↓ Validate schema (Zod: deviceId required, metrics object, ts timestamp)
  ↓ Query device metadata from cache/DB
  ↓ Enrich: { ...raw, deviceType, orgName, serialNumber }
  ↓ INSERT INTO telemetry_raw (device_id, payload, received_at)
  ↓ Publish: telemetry.normalized.v1
  ↓ On error: Publish telemetry.dlq
  ↓ Ack message (idempotent: if duplicate, skip)
```

### 4.4 TSDB Writer Worker

```
Worker 2: Consume telemetry.normalized.v1
  ↓ For each metric in payload.metrics:
      INSERT INTO telemetry_history (entity_id, entity_type='Device', metric_key='temp', value=25.5, timestamp)
      ON CONFLICT (entity_id, metric_key, timestamp) DO NOTHING
  ↓ Ack message
```

### 4.5 Asset Telemetry Worker

```
Worker 3: Consume telemetry.normalized.v1
  ↓ Query Redis cache: GET device_asset_links:{deviceId}
  ↓ If miss: Query Postgres entity_edges (device MONITORED_BY asset, valid_from <= now < valid_until)
  ↓ For each linked asset:
      - Apply transformation (e.g., device.voltage * device.current = asset.power)
      - Compute derived metrics
      - UPDATE assets SET health_score = computed_score WHERE id = assetId
      - INSERT INTO telemetry_history (entity_id, entity_type='Asset', metric_key='power', value, timestamp)
  ↓ Publish: telemetry.asset.v1 (includes assetId, deviceId, metrics)
  ↓ Ack message
```

### 4.6 Event Engine Worker

```
Worker 4: Consume telemetry.asset.v1
  ↓ Query threshold_rules WHERE entity_id = assetId OR entity_id IS NULL (global)
  ↓ For each rule:
      - Evaluate condition: IF asset.health_score < 50 THEN breach
      - If breach:
          INSERT INTO system_events (event_type='THRESHOLD_BREACH', entity_id=assetId, payload={rule, value, timestamp})
          Publish: events.threshold.v1
  ↓ Ack message
```

### 4.7 Activity Creator Worker

```
Worker 5: Consume events.threshold.v1
  ↓ Query activity_templates WHERE trigger_event_type = 'THRESHOLD_BREACH' AND entity_type = 'Asset'
  ↓ For each template:
      - Create activity:
          INSERT INTO activities (name, description, target_type='asset', target_id=assetId,
                                  priority=rule.severity, status='pending', assigned_to_role=template.role)
      - Publish: activities.created.v1
  ↓ Ack message
```

### 4.8 Real-Time Broadcaster

```
Worker 6: Consume telemetry.normalized.v1, events.*, activities.*
  ↓ Determine affected organization (orgId)
  ↓ Socket.IO: Emit to room `org:{orgId}`
      - Event: 'telemetry:new' → { deviceId, metrics, timestamp }
      - Event: 'device:status' → { deviceId, status: 'online', lastSeen }
      - Event: 'event:created' → { eventId, type, entityId, severity }
      - Event: 'activity:created' → { activityId, name, priority }
  ↓ Ack message
```

### 4.9 UI Updates

```
React Frontend (WebSocket client)
  ↓ On mount: socket.emit('subscribe', { orgId: currentOrg })
  ↓ Listen: socket.on('telemetry:new', updateChart)
  ↓ Listen: socket.on('device:status', updateDeviceListRow)
  ↓ Listen: socket.on('event:created', showAlarmNotification)
  ↓ Chart auto-updates with new data point
  ↓ Device list shows "Online" badge (green)
  ↓ Toast notification: "⚠️ Asset XYZ health critical!"
```

**End-to-End Latency Target**: <2 seconds from device publish to UI update

---

## 5. Device Onboarding & Authentication

### 5.1 Onboarding Flow (Control Plane)

```
1. Admin creates device in UI:
   POST /api/v1/devices
   { "name": "Sensor-A", "deviceTypeId": "...", "serialNumber": "SN123" }

2. Backend generates X.509 certificate:
   - Private CA for the organization
   - CN = deviceId (UUID)
   - Valid for 1 year (configurable)
   - Stores in device_certificates table

3. API returns:
   { "deviceId": "abc-123", "certificate": "-----BEGIN CERT-----...", "privateKey": "-----BEGIN KEY-----..." }

4. Admin downloads cert bundle (or device fetches via secure link)

5. Device configured with:
   - mqtt_broker: emqx.argusiq.com:8883
   - client_cert: /path/to/device.crt
   - client_key: /path/to/device.key
   - ca_cert: /path/to/ca.crt
```

### 5.2 MQTT Connection (Data Plane)

```
Device connects to EMQX:
  - TLS handshake: presents client cert
  - EMQX validates:
      1. Cert signed by trusted CA
      2. Cert not expired
      3. CN matches allowed devices (via webhook to API or local ACL)
  - On success: Connection established
  - On failure: Connection refused (logs in EMQX + system_events)

Device publishes:
  - Topic: v1/telemetry/{orgId}/{deviceId}
  - QoS 1 (at least once delivery)
  - Payload: JSON with timestamp and metrics

Bridge subscribes:
  - Bridge runs as MQTT client (separate process)
  - Subscribes to: $share/bridge-group/v1/telemetry/#
  - Bridge does NOT validate TLS certificates (already done by EMQX)
  - Bridge validates business logic:
      1. deviceId exists in database
      2. orgId matches device's organization
      3. Payload schema is valid (Zod validation)
      4. Device is not in decommissioned state
```

**Important: Separation of Concerns**
- **EMQX responsibility**: TLS/mTLS certificate validation (authentication layer)
- **Bridge responsibility**: Business logic validation (authorization + data quality layer)

### 5.3 Certificate Lifecycle

| State | Action | Trigger |
|-------|--------|---------|
| **Pending** | Admin creates device | Manual |
| **Active** | Cert generated | Auto |
| **Expiring** | Email alert 30 days before | Cron job |
| **Expired** | Device disconnected | EMQX validation |
| **Revoked** | Device decomissioned | Manual revoke |
| **Renewed** | New cert generated | Manual/auto |

**Database Schema**:
```sql
CREATE TABLE device_certificates (
  id UUID PRIMARY KEY,
  device_id UUID REFERENCES devices(id),
  certificate TEXT NOT NULL, -- PEM format
  serial_number TEXT UNIQUE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Scalability Analysis (30K msg/sec)

### 6.1 Throughput Calculations

**Assumptions**:
- 30,000 messages/second sustained
- Average payload: 500 bytes (JSON with 10 metrics)
- Operating hours: 24/7
- Peak factor: 3x (90K msg/sec during peak)

**Data Volume**:
- **Ingestion**: 30K msg/sec × 500 bytes = 15 MB/sec = 54 GB/hour = 1.3 TB/day
- **Raw storage** (90 days): 117 TB (compressed: ~12 TB with 10:1 ratio)
- **Processed storage** (1 year): 475 TB (compressed: ~47 TB)

### 6.2 Component Scaling

#### EMQX Broker
- **Capacity**: 2M connections, 2M msg/sec per node
- **Deployment**: 2 nodes (active-active) behind load balancer
- **Usage**: 30K / 2M = 1.5% capacity (safe)
- **Resources**: 4 CPU, 8GB RAM per node

#### NATS JetStream
- **Capacity**: 1M msg/sec per 3-node cluster
- **Deployment**: 3 nodes (R3 replication)
- **Usage**: 30K / 1M = 3% capacity (safe)
- **Resources**: 4 CPU, 8GB RAM per node
- **Disk**: 1TB NVMe per node (10 hour buffer at peak)

#### Worker Scaling
- **Normalization**: 10K msg/sec per worker → 3 workers (+ 1 standby)
- **TSDB Writer**: 5K msg/sec per worker → 6 workers (+ 2 standby)
- **Asset Processor**: 10K msg/sec per worker → 3 workers (+ 1 standby)
- **Event Engine**: 30K msg/sec (post-filtering: ~1K events/sec) → 2 workers
- **Activity Creator**: 1K events/sec → 1 worker
- **Real-time Broadcaster**: 30K msg/sec → 2 workers (batching)

**Total Workers**: ~20 processes (can run on 4-6 servers)

#### PostgreSQL + TimescaleDB
- **Write load**:
  - telemetry_raw: 30K inserts/sec
  - telemetry_history: 300K inserts/sec (10 metrics × 30K devices)
  - Total: ~330K writes/sec
- **Requirement**:
  - High-end Postgres (32 CPU, 128GB RAM)
  - NVMe SSD RAID 10 (10K+ IOPS)
  - Connection pooling (PgBouncer: 1000 connections → 50 DB connections)
- **Optimization**:
  - Batch inserts (1000 rows per transaction)
  - TimescaleDB compression (async, doesn't block writes)
  - Partitioning by time (15-minute chunks)

#### Redis Cache
- **Hit rate target**: 95% for device-asset links
- **Usage**:
  - 100K devices × 1KB metadata = 100 MB
  - 500K device-asset links × 500 bytes = 250 MB
  - Total: ~500 MB working set
- **Deployment**: Single node (16GB RAM) with AOF persistence

### 6.3 Horizontal Scaling Strategy

**Phase 1** (Current - 30K/sec):
- Single EMQX node
- 3-node NATS cluster
- Workers on 2 servers (Docker Compose)
- Single Postgres server
- Single Redis server

**Phase 2** (100K/sec):
- 2 EMQX nodes (load balanced)
- 3-node NATS cluster (same, but tuned)
- Workers on 6 servers (Kubernetes)
- Postgres primary + 2 read replicas (for queries)
- Redis primary + replica (for failover)

**Phase 3** (1M/sec):
- 5 EMQX nodes
- 5-node NATS cluster
- Workers on 20 servers (K8s autoscaling)
- Postgres sharding by organization (Citus extension)
- Redis cluster (3 primaries + 3 replicas)

**Phase 4** (10M/sec):
- Migrate to dedicated TSDB (QuestDB or InfluxDB)
- Kafka replaces NATS (more mature at extreme scale)
- Multi-region deployment

---

## 7. Database Schema Additions

### 7.1 New Tables

```sql
-- Device certificates for mTLS authentication
CREATE TABLE device_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  certificate TEXT NOT NULL, -- PEM format
  serial_number TEXT UNIQUE NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_device_certs_device ON device_certificates(device_id);
CREATE INDEX idx_device_certs_serial ON device_certificates(serial_number);
CREATE INDEX idx_device_certs_expiry ON device_certificates(valid_until) WHERE revoked_at IS NULL;

-- Immutable raw telemetry (replay source of truth)
CREATE TABLE telemetry_raw (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  device_id UUID NOT NULL,
  payload JSONB NOT NULL, -- Original MQTT payload
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingestion_source TEXT DEFAULT 'mqtt' -- 'mqtt' | 'http' | 'simulator'
);

CREATE INDEX idx_telemetry_raw_device_time ON telemetry_raw(device_id, received_at);
CREATE INDEX idx_telemetry_raw_org_time ON telemetry_raw(organization_id, received_at);

-- Retention: 90 days (partitioned by day, drop old partitions)
-- Estimated size: 1.3 TB/day × 90 days = 117 TB (compressed: ~12 TB)

-- Threshold rules for event detection
CREATE TABLE threshold_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL, -- 'device' | 'asset' | 'space'
  entity_id UUID, -- NULL = applies to all entities of type
  metric_key TEXT NOT NULL, -- e.g., 'temperature', 'health_score'
  condition JSONB NOT NULL, -- { "operator": ">", "value": 80, "duration_seconds": 300 }
  severity TEXT NOT NULL, -- 'low' | 'medium' | 'high' | 'critical'
  action JSONB NOT NULL, -- { "type": "create_activity", "template_id": "uuid" } or { "type": "webhook", "url": "..." }
  is_active BOOLEAN DEFAULT true,
  cooldown_seconds INTEGER DEFAULT 300, -- Debounce: Don't trigger again for 5 minutes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threshold_rules_org ON threshold_rules(organization_id);
CREATE INDEX idx_threshold_rules_entity ON threshold_rules(entity_type, entity_id);
CREATE INDEX idx_threshold_rules_active ON threshold_rules(is_active) WHERE is_active = true;

-- Activity templates for automated work order creation
CREATE TABLE activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  trigger_event_type TEXT, -- 'THRESHOLD_BREACH' | 'DEVICE_OFFLINE' | 'MANUAL'
  default_priority TEXT DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
  default_assigned_role TEXT, -- 'technician' | 'engineer' | 'manager'
  default_due_hours INTEGER, -- Create activity with due date = now + X hours
  checklist JSONB, -- [ { "item": "Check pressure gauge", "required": true }, ... ]
  custom_attributes JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_templates_org ON activity_templates(organization_id);
CREATE INDEX idx_activity_templates_type ON activity_templates(activity_type_id);
CREATE INDEX idx_activity_templates_trigger ON activity_templates(trigger_event_type);

-- Asset profiles (pre-configured asset templates)
CREATE TABLE asset_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  asset_type_id UUID NOT NULL REFERENCES asset_types(id) ON DELETE RESTRICT,
  default_attributes JSONB DEFAULT '{}',
  default_health_thresholds JSONB, -- { "critical": 30, "warning": 60, "good": 80 }
  telemetry_mappings JSONB, -- { "device.voltage": "asset.power_input", ... }
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_asset_profiles_org ON asset_profiles(organization_id);
CREATE INDEX idx_asset_profiles_type ON asset_profiles(asset_type_id);

-- Protocol converters (data transformation rules)
CREATE TABLE protocol_converters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_protocol TEXT NOT NULL, -- 'modbus' | 'opcua' | 'bacnet' | 'raw'
  target_schema JSONB NOT NULL, -- Zod schema or JSON Schema
  transformation_rules JSONB NOT NULL, -- Mapping rules, formulas
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_protocol_converters_org ON protocol_converters(organization_id);
```

### 7.2 Modify Existing Tables

```sql
-- Add last connectivity timestamp to devices (denormalized for UI performance)
ALTER TABLE devices
  ADD COLUMN last_connectivity_change TIMESTAMPTZ,
  ADD COLUMN connectivity_status TEXT DEFAULT 'unknown' CHECK (connectivity_status IN ('online', 'offline', 'unknown')),
  ADD COLUMN linked_assets_count INTEGER DEFAULT 0; -- Cached count for list view

-- Add health score computation metadata to assets
ALTER TABLE assets
  ADD COLUMN health_score_updated_at TIMESTAMPTZ,
  ADD COLUMN health_score_computed_by TEXT; -- Which processor version computed this

-- Convert telemetry_history to TimescaleDB hypertable (production only)
-- Run after data migration:
-- SELECT create_hypertable('telemetry_history', 'timestamp', chunk_time_interval => INTERVAL '15 minutes');
-- SELECT add_compression_policy('telemetry_history', INTERVAL '7 days');
-- SELECT add_retention_policy('telemetry_history', INTERVAL '1 year');

-- Add indexes for hot queries
CREATE INDEX idx_telemetry_history_device_metric_time
  ON telemetry_history(entity_id, metric_key, timestamp DESC)
  WHERE entity_type = 'Device';

CREATE INDEX idx_telemetry_history_asset_metric_time
  ON telemetry_history(entity_id, metric_key, timestamp DESC)
  WHERE entity_type = 'Asset';

-- Add GIN index for JSONB searches (if not already present)
CREATE INDEX idx_devices_custom_attrs ON devices USING GIN (custom_attributes);
CREATE INDEX idx_assets_custom_attrs ON assets USING GIN (custom_attributes);
```

### 7.3 Device-Asset Links (Use Existing entity_edges)

**Recommendation**: Use existing `entity_edges` table with enhancements:

```sql
-- Add port column to entity_edges metadata for RTU support
-- metadata JSONB will contain:
-- {
--   "port": 1,  -- Optional: for multi-port devices (RTU)
--   "role": "primary",  -- 'primary' | 'backup' | 'secondary'
--   "metrics_mapping": { "device.temp_1": "asset.temperature" }
-- }

-- Query pattern for device-asset links:
SELECT
  ee.source_entity_id AS device_id,
  ee.target_entity_id AS asset_id,
  ee.metadata->>'port' AS port,
  ee.metadata->>'role' AS role,
  ee.valid_from,
  ee.valid_until
FROM entity_edges ee
WHERE ee.relationship_type = 'MONITORED_BY'
  AND ee.source_entity_type = 'Device'
  AND ee.target_entity_type = 'Asset'
  AND ee.tenant_id = :orgId
  AND (ee.valid_from IS NULL OR ee.valid_from <= NOW())
  AND (ee.valid_until IS NULL OR ee.valid_until > NOW());
```

---

## 8. API Design

### 8.1 Device Onboarding APIs

```typescript
// Create device and generate certificate
POST /api/v1/devices
Request:
{
  "name": "Sensor-A",
  "deviceTypeId": "uuid",
  "serialNumber": "SN-001",
  "certificateValidityDays": 365
}
Response:
{
  "device": { "id": "uuid", "name": "Sensor-A", ... },
  "certificate": {
    "id": "uuid",
    "certificate": "-----BEGIN CERTIFICATE-----...",
    "privateKey": "-----BEGIN PRIVATE KEY-----...",
    "validUntil": "2027-01-28T00:00:00Z",
    "downloadUrl": "/api/v1/devices/uuid/certificate/download"
  }
}

// Download certificate bundle (one-time secure link)
GET /api/v1/devices/:id/certificate/download?token=...
Response: application/zip (device.crt, device.key, ca.crt, config.json)

// Revoke certificate (decomission device)
POST /api/v1/devices/:id/certificate/revoke
Request: { "reason": "Device replaced" }
Response: { "success": true, "revokedAt": "2026-01-28T12:00:00Z" }

// Renew certificate (before expiry)
POST /api/v1/devices/:id/certificate/renew
Request: { "validityDays": 365 }
Response: { "certificate": {...}, "downloadUrl": "..." }
```

### 8.2 Device-Asset Link APIs

```typescript
// Link device to asset (with optional port for RTU)
POST /api/v1/devices/:deviceId/assets/:assetId/link
Request:
{
  "port": 1,  // Optional: for RTU devices
  "role": "primary",  // 'primary' | 'backup'
  "validFrom": "2026-01-28T00:00:00Z",  // Optional: defaults to now
  "validUntil": null,  // Optional: null = indefinite
  "metricsMapping": {
    "device.temp_1": "asset.temperature",
    "device.voltage": "asset.power_input"
  }
}
Response:
{
  "link": {
    "id": "uuid",
    "deviceId": "uuid",
    "assetId": "uuid",
    "port": 1,
    "role": "primary",
    "validFrom": "2026-01-28T00:00:00Z",
    "validUntil": null
  }
}

// Unlink device from asset
DELETE /api/v1/devices/:deviceId/assets/:assetId/unlink
Response: { "success": true }

// List assets linked to device
GET /api/v1/devices/:deviceId/assets
Response:
{
  "assets": [
    { "id": "uuid", "name": "Pump A", "port": 1, "role": "primary", "validFrom": "...", "validUntil": null }
  ]
}

// List devices monitoring an asset
GET /api/v1/assets/:assetId/devices
Response:
{
  "devices": [
    { "id": "uuid", "name": "Sensor-A", "port": null, "role": "primary", "status": "online", "lastSeen": "..." }
  ]
}
```

### 8.3 Telemetry Query APIs

```typescript
// Query device telemetry (historical)
GET /api/v1/telemetry/device/:deviceId
Query params:
  - metricKey: string (optional) - Filter by specific metric
  - startTime: ISO8601 timestamp (default: 24h ago)
  - endTime: ISO8601 timestamp (default: now)
  - aggregation: 'none' | '1m' | '5m' | '1h' (default: none)
  - limit: number (default: 1000, max: 10000)
Response:
{
  "deviceId": "uuid",
  "metricKey": "temperature",
  "data": [
    { "timestamp": "2026-01-28T10:00:00Z", "value": 25.5 },
    { "timestamp": "2026-01-28T10:01:00Z", "value": 25.7 }
  ],
  "aggregation": "none",
  "count": 120
}

// Query asset telemetry (aggregated from linked devices)
GET /api/v1/telemetry/asset/:assetId
Query params: (same as device)
Response:
{
  "assetId": "uuid",
  "metricKey": "power_consumption",
  "data": [
    { "timestamp": "2026-01-28T10:00:00Z", "value": 120.5, "sourceDevices": ["dev1", "dev2"] }
  ]
}

// Get latest telemetry (real-time snapshot)
GET /api/v1/telemetry/device/:deviceId/latest
Response:
{
  "deviceId": "uuid",
  "metrics": {
    "temperature": { "value": 25.5, "timestamp": "2026-01-28T12:34:56Z", "quality": "good" },
    "pressure": { "value": 101.3, "timestamp": "2026-01-28T12:34:56Z", "quality": "good" }
  },
  "lastSeen": "2026-01-28T12:34:56Z",
  "status": "online"
}

// Replay historical data (admin only)
POST /api/v1/telemetry/replay
Request:
{
  "deviceId": "uuid",  // Optional: specific device or all
  "startTime": "2026-01-27T00:00:00Z",
  "endTime": "2026-01-28T00:00:00Z",
  "targetStream": "telemetry.raw.v1"  // Republish to stream for reprocessing
}
Response:
{
  "jobId": "uuid",
  "status": "queued",
  "estimatedMessages": 120000,
  "estimatedDuration": "5 minutes"
}

// Check replay job status
GET /api/v1/telemetry/replay/:jobId
Response:
{
  "jobId": "uuid",
  "status": "processing",  // 'queued' | 'processing' | 'completed' | 'failed'
  "progress": 45000,
  "total": 120000,
  "startedAt": "2026-01-28T12:00:00Z",
  "completedAt": null
}
```

### 8.4 Threshold Rules APIs

```typescript
// List threshold rules
GET /api/v1/rules
Query params:
  - entityType: 'device' | 'asset'
  - entityId: uuid (optional)
  - isActive: boolean
Response:
{
  "rules": [
    {
      "id": "uuid",
      "name": "High Temperature Alert",
      "entityType": "asset",
      "entityId": "uuid",
      "metricKey": "temperature",
      "condition": { "operator": ">", "value": 80, "durationSeconds": 300 },
      "severity": "high",
      "action": { "type": "create_activity", "templateId": "uuid" },
      "isActive": true
    }
  ]
}

// Create threshold rule
POST /api/v1/rules
Request:
{
  "name": "Critical Health Score",
  "entityType": "asset",
  "entityId": null,  // Apply to all assets
  "metricKey": "health_score",
  "condition": {
    "operator": "<",
    "value": 30,
    "durationSeconds": 600  // Must be below 30 for 10 minutes
  },
  "severity": "critical",
  "action": {
    "type": "create_activity",
    "templateId": "uuid"
  },
  "cooldownSeconds": 1800  // Don't trigger again for 30 minutes
}
Response: { "rule": {...} }

// Update rule
PUT /api/v1/rules/:id
Request: (partial update)
{
  "isActive": false,
  "condition": { "operator": "<", "value": 25 }
}
Response: { "rule": {...} }

// Delete rule
DELETE /api/v1/rules/:id
Response: { "success": true }
```

### 8.5 Activity Template APIs

```typescript
// List activity templates
GET /api/v1/activity-templates
Query params:
  - triggerEventType: string
  - activityTypeId: uuid
Response:
{
  "templates": [
    {
      "id": "uuid",
      "name": "Emergency Maintenance",
      "description": "Triggered when asset health critical",
      "activityTypeId": "uuid",
      "triggerEventType": "THRESHOLD_BREACH",
      "defaultPriority": "critical",
      "defaultAssignedRole": "technician",
      "defaultDueHours": 2,
      "checklist": [
        { "item": "Check system pressure", "required": true },
        { "item": "Inspect for leaks", "required": true }
      ]
    }
  ]
}

// Create template
POST /api/v1/activity-templates
Request: (same structure as response)
Response: { "template": {...} }

// Create activity from template
POST /api/v1/activities/from-template/:templateId
Request:
{
  "targetId": "uuid",  // Asset or device ID
  "overrides": {
    "priority": "high",  // Override default
    "assignedToUserId": "uuid"
  }
}
Response: { "activity": {...} }
```

### 8.6 WebSocket Events (Real-Time)

```typescript
// Client connects and subscribes
socket.on('connect', () => {
  socket.emit('subscribe', { organizationId: 'uuid' });
});

// Server pushes updates
socket.on('telemetry:new', (data) => {
  // { deviceId, metrics: { temp: 25.5 }, timestamp }
});

socket.on('device:status', (data) => {
  // { deviceId, status: 'online', lastSeen }
});

socket.on('device:connected', (data) => {
  // { deviceId, connectedAt }
});

socket.on('device:disconnected', (data) => {
  // { deviceId, disconnectedAt, reason: 'timeout' }
});

socket.on('event:created', (data) => {
  // { eventId, type: 'THRESHOLD_BREACH', entityId, severity, payload }
});

socket.on('activity:created', (data) => {
  // { activityId, name, priority, assignedTo, dueAt }
});

socket.on('asset:healthscore', (data) => {
  // { assetId, healthScore, previousScore, timestamp }
});
```

---

## 9. Device Simulator Requirements

### 9.1 Simulator Features

**Must Have**:
1. **Multi-Device Simulation**
   - Spawn N virtual devices (configurable: 10, 100, 1000, 10000)
   - Each device has unique certificate (pre-generated or on-the-fly)
   - Configurable publish rate per device (1/sec, 10/sec, 100/sec)

2. **Telemetry Patterns**
   - Sine wave (simulates temperature oscillation)
   - Random walk (simulates sensor drift)
   - Stepped (simulates on/off states)
   - Threshold breach scenarios (for testing alarms)

3. **Network Behaviors**
   - Intermittent disconnects (simulate poor connectivity)
   - Latency injection (simulate slow networks)
   - Message drops (simulate packet loss)
   - Burst mode (simulate queued messages on reconnect)

4. **Certificate Management**
   - Load device certs from file or API
   - Support cert rotation during simulation
   - Test cert expiry/revocation scenarios

5. **Metrics**
   - Messages sent/sec
   - Messages failed
   - Average latency
   - Connection uptime

**Nice to Have**:
6. **UI Dashboard** (web interface)
   - Start/stop devices
   - Real-time metrics chart
   - Per-device configuration
   - Scenario templates (10 devices, 1000 devices, stress test)

7. **Scenario Files** (YAML/JSON)
   ```yaml
   devices:
     - count: 100
       deviceType: temperature_sensor
       publishRateHz: 1
       metrics:
         temperature: { type: sine, min: 20, max: 30, period: 60 }
         humidity: { type: random_walk, start: 50, step: 2 }
     - count: 10
       deviceType: pressure_sensor
       publishRateHz: 10
       metrics:
         pressure: { type: constant, value: 101.3 }
   ```

8. **Replay Mode**
   - Load historical data from CSV/JSON
   - Replay at original rate or accelerated

### 9.2 Simulator Architecture

```mermaid
graph TB
    subgraph Simulator["Device Simulator (Node.js)"]
        direction TB

        subgraph CLI["CLI Interface"]
            CLI1["./simulator start --devices 1000 --rate 10"]
            CLI2["./simulator load-scenario scenarios/stress-test.yml"]
            CLI3["./simulator stop"]
        end

        subgraph Dashboard["Web Dashboard (Express + Socket.IO)"]
            DASH1["http://localhost:3001"]
            DASH2["Real-time metrics"]
            DASH3["Device control panel"]
        end

        subgraph DevMgr["Device Manager"]
            DM1["Spawn worker threads for device groups"]
            DM2["Each thread handles 100 devices"]
            DM3["Load balancing across threads"]
        end

        subgraph MQTTPool["MQTT Client Pool (mqtt.js)"]
            MP1["Persistent connections (reuse)"]
            MP2["Auto-reconnect with backoff"]
            MP3["TLS with client certs"]
        end

        subgraph Metrics["Metrics Collector (Prometheus format)"]
            MET1["Expose on :9090/metrics"]
        end
    end

    EMQX["MQTT Broker (EMQX)"]

    Simulator --> EMQX

    style Simulator fill:#e3f2fd
    style CLI fill:#fff3e0
    style Dashboard fill:#f3e5f5
    style DevMgr fill:#e8f5e9
    style MQTTPool fill:#fce4ec
    style Metrics fill:#fff9c4
    style EMQX fill:#ffebee
```

### 9.3 Simulator API

```typescript
// Start simulation
POST /simulator/start
Request:
{
  "devices": 1000,
  "publishRateHz": 1,
  "scenario": "temperature_sensors"
}
Response: { "simulationId": "uuid", "status": "running" }

// Stop simulation
POST /simulator/stop
Response: { "status": "stopped", "messagesSent": 120000 }

// Get metrics
GET /simulator/metrics
Response:
{
  "devicesRunning": 1000,
  "messagesPerSecond": 980,
  "messagesSent": 5400000,
  "messagesFailed": 20,
  "avgLatencyMs": 45,
  "connectionsActive": 1000,
  "connectionsFailed": 5
}

// Get device details
GET /simulator/devices/:deviceId
Response:
{
  "deviceId": "sim-001",
  "status": "connected",
  "messagesSent": 5400,
  "lastPublishAt": "2026-01-28T12:34:56Z",
  "currentMetrics": { "temperature": 25.5, "humidity": 60 }
}
```

---

## 10. Deployment Architecture

### 10.1 Development Environment (docker-compose)

```yaml
# docker-compose.yml
version: '3.9'

services:
  # PostgreSQL with TimescaleDB
  postgres:
    image: timescale/timescaledb-ha:pg16
    environment:
      POSTGRES_DB: argusiq
      POSTGRES_USER: argusiq
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    command: postgres -c shared_preload_libraries=timescaledb

  # Redis (cache + pub/sub)
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # NATS JetStream (3-node cluster)
  nats-1:
    image: nats:2.10-alpine
    command: -js -sd /data -cluster nats://0.0.0.0:6222 -routes nats://nats-2:6222,nats://nats-3:6222
    volumes:
      - nats1_data:/data
    ports:
      - "4222:4222"  # Client
      - "8222:8222"  # HTTP monitoring

  nats-2:
    image: nats:2.10-alpine
    command: -js -sd /data -cluster nats://0.0.0.0:6222 -routes nats://nats-1:6222,nats://nats-3:6222
    volumes:
      - nats2_data:/data

  nats-3:
    image: nats:2.10-alpine
    command: -js -sd /data -cluster nats://0.0.0.0:6222 -routes nats://nats-1:6222,nats://nats-2:6222
    volumes:
      - nats3_data:/data

  # EMQX MQTT Broker
  emqx:
    image: emqx/emqx:5.5
    environment:
      EMQX_NAME: argusiq
      EMQX_HOST: emqx
      EMQX_LISTENER__SSL__EXTERNAL__CACERTFILE: /certs/ca.crt
      EMQX_LISTENER__SSL__EXTERNAL__VERIFY: verify_peer
      EMQX_LISTENER__SSL__EXTERNAL__FAIL_IF_NO_PEER_CERT: true
    volumes:
      - emqx_data:/opt/emqx/data
      - ./certs:/certs
    ports:
      - "1883:1883"   # MQTT
      - "8883:8883"   # MQTT/SSL
      - "18083:18083" # Dashboard
    depends_on:
      - nats-1

  # API Server (Fastify)
  api:
    build:
      context: ./packages/api
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://argusiq:${DB_PASSWORD}@postgres:5432/argusiq
      REDIS_URL: redis://redis:6379
      NATS_URL: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: development
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
      - nats-1

  # Telemetry Workers (6 services)
  worker-normalize:
    build:
      context: ./packages/api
      dockerfile: Dockerfile.worker
    command: npm run worker:normalize
    environment:
      DATABASE_URL: postgresql://argusiq:${DB_PASSWORD}@postgres:5432/argusiq
      REDIS_URL: redis://redis:6379
      NATS_URL: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
    depends_on:
      - postgres
      - redis
      - nats-1
    deploy:
      replicas: 3  # Scale to 3 instances

  worker-tsdb:
    build:
      context: ./packages/api
      dockerfile: Dockerfile.worker
    command: npm run worker:tsdb
    environment:
      DATABASE_URL: postgresql://argusiq:${DB_PASSWORD}@postgres:5432/argusiq
      NATS_URL: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
    depends_on:
      - postgres
      - nats-1
    deploy:
      replicas: 6  # Scale to 6 instances

  worker-asset:
    build:
      context: ./packages/api
      dockerfile: Dockerfile.worker
    command: npm run worker:asset
    environment:
      DATABASE_URL: postgresql://argusiq:${DB_PASSWORD}@postgres:5432/argusiq
      REDIS_URL: redis://redis:6379
      NATS_URL: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
    depends_on:
      - postgres
      - redis
      - nats-1
    deploy:
      replicas: 3  # Scale to 3 instances

  worker-events:
    build:
      context: ./packages/api
      dockerfile: Dockerfile.worker
    command: npm run worker:events
    environment:
      DATABASE_URL: postgresql://argusiq:${DB_PASSWORD}@postgres:5432/argusiq
      NATS_URL: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
    depends_on:
      - postgres
      - nats-1
    deploy:
      replicas: 2  # Scale to 2 instances

  worker-activities:
    build:
      context: ./packages/api
      dockerfile: Dockerfile.worker
    command: npm run worker:activities
    environment:
      DATABASE_URL: postgresql://argusiq:${DB_PASSWORD}@postgres:5432/argusiq
      NATS_URL: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
    depends_on:
      - postgres
      - nats-1
    deploy:
      replicas: 1

  worker-realtime:
    build:
      context: ./packages/api
      dockerfile: Dockerfile.worker
    command: npm run worker:realtime
    environment:
      REDIS_URL: redis://redis:6379
      NATS_URL: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
    depends_on:
      - redis
      - nats-1
    deploy:
      replicas: 2  # Scale to 2 instances

  # Device Simulator
  simulator:
    build:
      context: ./packages/simulator
      dockerfile: Dockerfile
    environment:
      MQTT_BROKER: mqtt://emqx:1883
      API_URL: http://api:3000
    ports:
      - "3001:3001"  # Web dashboard
    depends_on:
      - emqx
      - api

  # Web Frontend (React)
  web:
    build:
      context: ./packages/web
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_WS_URL: ws://localhost:3000
    ports:
      - "5173:5173"
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
  nats1_data:
  nats2_data:
  nats3_data:
  emqx_data:
```

### 10.2 Production Environment (Kubernetes)

**Cluster Requirements**:
- 3 control plane nodes (HA)
- 6 worker nodes (16 CPU, 64GB RAM each)
- NVMe SSD storage (Persistent Volumes)

**Namespaces**:
- `argusiq-platform` - API, workers, web
- `argusiq-data` - Databases, message bus
- `argusiq-monitoring` - Prometheus, Grafana

**Key Services**:
- **API Server**: 3 replicas (HPA: 3-10 based on CPU)
- **Workers**: Per service (see docker-compose replicas)
- **EMQX**: 2 nodes (StatefulSet)
- **NATS**: 3 nodes (StatefulSet with R3 replication)
- **PostgreSQL**: Managed service (AWS RDS, Azure DB) or Patroni cluster
- **Redis**: Managed service (ElastiCache, Azure Cache) or Redis Sentinel

**Ingress**:
- `api.argusiq.com` → API service (HTTPS)
- `mqtt.argusiq.com` → EMQX (MQTT/TLS)
- `ws.argusiq.com` → WebSocket service (WSS)

---

## 11. Phased Implementation Plan

### Phase 1: Foundation (Weeks 1-3) - MVP Telemetry

**Goal**: End-to-end data flow from simulator to UI

#### Week 1: Infrastructure Setup
- [ ] Set up EMQX broker in docker-compose
- [ ] Set up NATS JetStream cluster (3 nodes)
- [ ] Create MQTT Bridge service (subscribes to EMQX, publishes to NATS)
- [ ] Create database migrations for new tables
- [ ] Set up Redis cache layer
- [ ] Generate CA certificate for device certs

#### Week 2: Backend Services
- [ ] Implement device onboarding API (CRUD + cert generation)
- [ ] Implement device-asset link API (uses entity_edges)
- [ ] Implement MQTT Bridge service (subscribes to EMQX with shared subscriptions, publishes to NATS)
- [ ] Build normalization worker (NATS consumer)
- [ ] Build TSDB writer worker
- [ ] Build real-time broadcaster worker
- [ ] Add WebSocket support to Fastify API

#### Week 3: Device Simulator
- [ ] Build simulator CLI (Node.js)
- [ ] Implement multi-device spawning
- [ ] Add telemetry pattern generators (sine, random walk)
- [ ] Certificate loading and MQTT connections
- [ ] Simulator web dashboard (optional)
- [ ] Create 3 test scenarios (10 devices, 100 devices, 1000 devices)

**Deliverable**: Can onboard devices, simulator sends telemetry, data appears in DB, UI shows "Online" status

---

### Phase 2: Asset Integration (Weeks 4-5)

**Goal**: Device telemetry flows to assets

#### Week 4: Asset Processing
- [ ] Build asset telemetry worker
  - Query device-asset links from cache
  - Apply metric transformations
  - Compute health scores
  - Write to telemetry_history (entity_type='Asset')
- [ ] Implement device-asset link caching strategy
- [ ] Add telemetry query APIs (device + asset)
- [ ] Build telemetry replay API (admin)

#### Week 5: Composite Assets
- [ ] Implement hierarchical asset rollups (parent-child aggregation)
- [ ] Add RTU port support to device-asset links
- [ ] Update asset processor to handle port-based routing
- [ ] Add derived metrics engine (formulas in asset_types)

**Deliverable**: Assets show telemetry from multiple devices, health scores computed, composite assets work

---

### Phase 3: Event-Driven Automation (Weeks 6-7)

**Goal**: Telemetry triggers activities

#### Week 6: Threshold Rules
- [ ] Build threshold rules CRUD API
- [ ] Build event engine worker
  - Evaluate rules against asset telemetry
  - Create system_events on breach
  - Respect cooldown periods
- [ ] Add DLQ handling (dead letter queue for failed messages)

#### Week 7: Activity Automation
- [ ] Build activity templates CRUD API
- [ ] Build activity creator worker
  - Match events to templates
  - Auto-create activities
  - Assign to users/roles
- [ ] Add activity notification system (email, push)

**Deliverable**: Can configure rules, rules trigger activities, activities appear in UI

---

### Phase 4: UI Implementation (Weeks 8-10)

**Goal**: Complete IoT Hub and Asset Hub UI

#### Week 8: IoT Hub
- [ ] Add IoT Hub navigation section
- [ ] Build Devices list page
  - Data grid with filters (status, type, search)
  - Connectivity indicator (online/offline)
  - Last seen timestamp
- [ ] Build Device detail page
  - Overview tab (basic info, network details)
  - Telemetry tab (real-time charts with WebSocket)
  - Linked Assets tab (table with link/unlink actions)
  - Configuration tab (custom attributes editor)
- [ ] Implement WebSocket client (Socket.IO)
  - Subscribe to organization room
  - Update device status in real-time
  - Update telemetry charts live

#### Week 9: Asset Hub
- [ ] Add Asset Hub navigation section
- [ ] Build Assets list page
  - Data grid with filters (status, type, hierarchy)
  - Health score indicator
  - Linked devices count
- [ ] Build Asset detail page
  - Overview tab (basic info, parent/children tree)
  - IoT Devices tab (list of monitoring devices, telemetry preview)
  - Telemetry tab (aggregated metrics from all devices)
  - Location tab (map with geolocation)
  - Maintenance tab (activities list, create activity)
  - Alarms tab (events related to this asset)

#### Week 10: Management Pages
- [ ] Build Device Types management page (CRUD)
- [ ] Build Asset Types management page (CRUD)
- [ ] Build Asset Profiles page (CRUD + create asset from profile)
- [ ] Build Protocol Converters page (CRUD)
- [ ] Build Global Triggers (threshold rules) page (CRUD with condition builder)
- [ ] Build IoT Alarms page (events dashboard with ack/dismiss)

**Deliverable**: Complete IoT Hub and Asset Hub matching mock app

---

### Phase 5: Polish & Optimization (Weeks 11-12)

**Goal**: Production-ready

#### Week 11: Performance & Reliability
- [ ] Optimize database queries (indexes, query plans)
- [ ] Implement TimescaleDB compression and retention policies
- [ ] Add circuit breakers to workers (fail gracefully)
- [ ] Implement graceful shutdown for workers
- [ ] Add health check endpoints (/health, /ready)
- [ ] Load testing with simulator (30K msg/sec sustained)
- [ ] Fix performance bottlenecks

#### Week 12: Monitoring & Documentation
- [ ] Add Prometheus metrics to all services
- [ ] Build Grafana dashboards (throughput, latency, errors)
- [ ] Set up alerts (DLQ size, worker lag, DB connections)
- [ ] Write API documentation (OpenAPI/Swagger)
- [ ] Write deployment guide (docker-compose, K8s)
- [ ] Write runbook (troubleshooting, scaling, recovery)
- [ ] Create user guide (device onboarding, rule creation)

**Deliverable**: Production deployment ready, documented, monitored

---

## 12. Risk Analysis & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **NATS throughput insufficient at 30K/sec** | High | Low | Load test early (Week 3), have Kafka migration plan ready |
| **PostgreSQL write bottleneck** | High | Medium | Use PgBouncer connection pooling, batch inserts (1000 rows/txn), TimescaleDB tuning |
| **Workers crash on bad data** | Medium | Medium | Robust schema validation (Zod), DLQ for failed messages, health checks |
| **Certificate management complexity** | Medium | Low | Use existing PKI libraries (node-forge, openssl), automate cert generation |
| **WebSocket scalability (10K concurrent clients)** | Medium | Medium | Use Redis pub/sub adapter (Socket.IO), horizontal scaling |
| **Device simulator doesn't generate realistic data** | Low | Medium | Work with domain expert to model realistic telemetry patterns |
| **Data loss during deployment** | Critical | Low | Immutable telemetry_raw table, NATS persistence, blue/green deployments |
| **EMQX mTLS configuration issues** | Medium | Medium | Thorough testing in Week 1, document setup steps, provide cert generator script |
| **Late discovery of requirements** | High | High | Frequent demos (every 2 weeks), iterative development, phased rollout |

---

## 13. Success Criteria

### Phase 1 Success (Week 3)
- [ ] 1000 simulated devices connect via MQTT with mTLS
- [ ] Telemetry flows: EMQX → NATS → Postgres
- [ ] Zero message loss at 10K msg/sec for 1 hour
- [ ] Device status updates in UI within 5 seconds of disconnect

### Phase 2 Success (Week 5)
- [ ] Device-asset links working (1 device → 3 assets)
- [ ] RTU with 4 ports working (1 device → 4 assets via ports)
- [ ] Asset telemetry computed from device data
- [ ] Health scores update within 10 seconds of telemetry

### Phase 3 Success (Week 7)
- [ ] Create threshold rule in UI
- [ ] Rule triggers event within 30 seconds of breach
- [ ] Event creates activity automatically
- [ ] Activity appears in activities list with correct priority

### Phase 4 Success (Week 10)
- [ ] All mock app pages replicated
- [ ] Real-time telemetry charts update without refresh
- [ ] Can drill down: Device → Telemetry → Linked Assets → Asset Detail
- [ ] Can onboard device, link to asset, see data flow end-to-end (5 min setup)

### Phase 5 Success (Week 12)
- [ ] 30K msg/sec sustained for 8 hours (stress test)
- [ ] End-to-end latency <2 seconds (P95)
- [ ] Zero data loss during worker restart
- [ ] Prometheus dashboards showing all metrics
- [ ] Documentation complete (API, deployment, user guide)

---

## 14. Next Steps (This Session)

Since this is a planning-only session, we should:

1. **Review & Refine**
   - Review this architecture document
   - Identify any missing pieces
   - Validate technology choices
   - Confirm phasing approach

2. **Answer Outstanding Questions**
   - Is NATS JetStream acceptable (vs Kafka)?
   - Is EMQX acceptable (vs Mosquitto)?
   - Is 12-week timeline reasonable?
   - Any specific requirements we missed?

3. **Prioritize Features**
   - Which Phase 4 features are must-have vs nice-to-have?
   - Can we cut scope to accelerate delivery?

4. **Prepare for Implementation**
   - Create detailed task breakdown for Week 1
   - Identify any blockers (infrastructure, access, licenses)
   - Set up project tracking (Jira, GitHub Projects, etc.)

---

## Appendices

### A. Technology Alternatives Considered

| Category | Chosen | Alternatives | Reason |
|----------|--------|--------------|--------|
| Message Bus | NATS | Kafka, RabbitMQ, Redis | Throughput, latency, ops simplicity |
| MQTT Broker | EMQX | Mosquitto, VerneMQ, HiveMQ | Dashboard, bridging, scale |
| TSDB | TimescaleDB | InfluxDB, QuestDB | Postgres integration, no new infra |
| Real-Time | Socket.IO | SSE, Raw WebSocket | Fallbacks, rooms, Redis adapter |
| Workers | Custom | BullMQ, Celery | Direct NATS integration, less deps |

### B. Glossary

- **mTLS**: Mutual TLS - both client and server present certificates
- **TSDB**: Time-Series Database
- **DLQ**: Dead Letter Queue - holding area for failed messages
- **R3**: Replication factor 3 (NATS terminology)
- **RTU**: Remote Terminal Unit - multi-port device
- **Hypertable**: TimescaleDB's partitioned table for time-series data
- **Consumer Group**: NATS JetStream's load balancing mechanism

### C. References

- IoT Architecture vNext: `C:\source\vx-dionysus-req\documentation\architecture\IoT_Asset_Centric_Architecture_vNext.md`
- Phase 7 Implementation: `C:\source\argusiq-lite\docs\PHASE-2-IMPLEMENTATION.md`
- Mock App Navigation: `C:\source\paas\src\lib\navigation-data.ts`

---

**Document Status**: Draft for Review
**Next Update**: After user feedback and refinement
