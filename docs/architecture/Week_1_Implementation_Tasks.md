# Week 1: Infrastructure Setup - Detailed Task Breakdown

## Overview

**Timeline**: Week 1 of 12-week implementation plan
**Goal**: Set up infrastructure foundations for MQTT-first IoT platform with HTTP secondary support
**Team**: Backend Engineer (primary), DevOps Engineer (support)

---

## Task Summary

| Task ID | Task | Priority | Est. Hours | Dependencies |
|---------|------|----------|------------|--------------|
| W1-T1 | Database Schema Migrations | P0 | 8h | None |
| W1-T2 | EMQX MQTT Broker Setup | P0 | 6h | None |
| W1-T3 | NATS JetStream Setup | P0 | 8h | None |
| W1-T4 | Redis Setup & Configuration | P0 | 4h | None |
| W1-T5 | MQTT→NATS Bridge Service | P0 | 10h | W1-T2, W1-T3 |
| W1-T6 | Certificate Infrastructure (mTLS) | P0 | 8h | W1-T2 |
| W1-T7 | HTTP Ingestion Endpoint (Secondary) | P1 | 6h | W1-T3 |
| W1-T8 | Infrastructure Testing & Validation | P0 | 6h | All above |

**Total Estimated Hours**: 56 hours (~7 days for 1 engineer)

---

## Detailed Task Breakdown

### W1-T1: Database Schema Migrations

**Priority**: P0 (Blocking)
**Estimated Time**: 8 hours
**Owner**: Backend Engineer
**Dependencies**: None

#### Subtasks

##### 1.1 Create Migration Files (2h)

Create Drizzle migration files for new tables and columns.

**Files to create**:
```
packages/api/src/db/migrations/XXXX_iot_foundation.sql
packages/api/src/db/migrations/XXXX_iot_foundation.ts (if using Drizzle kit)
```

**Schema changes**:

```sql
-- 1. Extend devices table
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_role TEXT DEFAULT 'endpoint'
    CHECK (device_role IN ('endpoint', 'gateway', 'gateway_chunked', 'rtu_multiport')),
  ADD COLUMN IF NOT EXISTS parent_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS logical_identifier TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS network_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS protocol TEXT DEFAULT 'mqtt';

CREATE INDEX IF NOT EXISTS idx_devices_role ON devices(device_role);
CREATE INDEX IF NOT EXISTS idx_devices_parent ON devices(parent_device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at);

-- 2. Extend assets table
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS health_score_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_score_computed_by TEXT,
  ADD COLUMN IF NOT EXISTS last_telemetry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_assets_health_updated ON assets(health_score_updated_at);
CREATE INDEX IF NOT EXISTS idx_assets_last_telemetry ON assets(last_telemetry_at);

-- 3. Extend asset_types table for telemetry configuration
ALTER TABLE asset_types
  ADD COLUMN IF NOT EXISTS metric_definitions JSONB,
  ADD COLUMN IF NOT EXISTS transformation_engine JSONB,
  ADD COLUMN IF NOT EXISTS health_algorithm JSONB,
  ADD COLUMN IF NOT EXISTS threshold_rules JSONB,
  ADD COLUMN IF NOT EXISTS event_rules JSONB,
  ADD COLUMN IF NOT EXISTS aggregation_rules JSONB,
  ADD COLUMN IF NOT EXISTS validation_rules JSONB,
  ADD COLUMN IF NOT EXISTS telemetry_config_version TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS telemetry_config_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS telemetry_config_updated_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_asset_types_config_version
  ON asset_types(telemetry_config_version, telemetry_config_updated_at);

-- 4. Extend device_types table for processing configuration
ALTER TABLE device_types
  ADD COLUMN IF NOT EXISTS processing_mode TEXT DEFAULT 'endpoint'
    CHECK (processing_mode IN ('endpoint', 'gateway', 'gateway_chunked', 'rtu_multiport')),
  ADD COLUMN IF NOT EXISTS protocol_adapter TEXT DEFAULT 'json',
  ADD COLUMN IF NOT EXISTS message_schema JSONB,
  ADD COLUMN IF NOT EXISTS extraction_rules JSONB,
  ADD COLUMN IF NOT EXISTS demux_strategy JSONB,
  ADD COLUMN IF NOT EXISTS chunking_config JSONB,
  ADD COLUMN IF NOT EXISTS transformation_rules JSONB;

-- 5. Create telemetry_history table (if not exists)
CREATE TABLE IF NOT EXISTS telemetry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Entity reference (Device or Asset)
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('Device', 'Asset')),

  -- Metric data
  metric_key TEXT NOT NULL,
  value NUMERIC,
  value_text TEXT,
  value_json JSONB,
  unit TEXT,

  -- Quality
  quality TEXT DEFAULT 'good' CHECK (quality IN ('good', 'uncertain', 'bad')),

  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source tracking
  source_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  source_message_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_entity ON telemetry_history(entity_id, entity_type, timestamp DESC);
CREATE INDEX idx_telemetry_tenant ON telemetry_history(tenant_id, timestamp DESC);
CREATE INDEX idx_telemetry_metric_key ON telemetry_history(metric_key);
CREATE INDEX idx_telemetry_timestamp ON telemetry_history(timestamp DESC);
CREATE INDEX idx_telemetry_quality ON telemetry_history(quality) WHERE quality != 'good';

-- GIN index for metadata JSONB
CREATE INDEX idx_telemetry_metadata ON telemetry_history USING GIN(metadata);

-- 6. Create telemetry_raw table (immutable, append-only)
CREATE TABLE IF NOT EXISTS telemetry_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  -- Raw payload
  payload JSONB NOT NULL,
  payload_size_bytes INTEGER,

  -- Message metadata
  correlation_id TEXT,
  sequence_number INTEGER,
  total_chunks INTEGER,

  -- Timestamps
  device_timestamp TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source tracking
  ingestion_source TEXT DEFAULT 'mqtt' CHECK (ingestion_source IN ('mqtt', 'http', 'bridge')),
  mqtt_topic TEXT,
  client_id TEXT,

  -- Immutability constraint
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No updates or deletes allowed on telemetry_raw
CREATE INDEX idx_telemetry_raw_device ON telemetry_raw(device_id, received_at DESC);
CREATE INDEX idx_telemetry_raw_tenant ON telemetry_raw(tenant_id, received_at DESC);
CREATE INDEX idx_telemetry_raw_correlation ON telemetry_raw(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- 7. Create telemetry_chunks table (for chunked messages)
CREATE TABLE IF NOT EXISTS telemetry_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  correlation_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,

  chunk_payload JSONB NOT NULL,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),

  UNIQUE(correlation_id, sequence_number)
);

CREATE INDEX idx_telemetry_chunks_correlation ON telemetry_chunks(correlation_id);
CREATE INDEX idx_telemetry_chunks_expires ON telemetry_chunks(expires_at);

-- 8. Create telemetry_transactions table (for atomic processing)
CREATE TABLE IF NOT EXISTS telemetry_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  correlation_id TEXT UNIQUE NOT NULL,
  gateway_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  total_logical_devices INTEGER NOT NULL,
  processed_devices INTEGER DEFAULT 0,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  error_message TEXT,

  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_telemetry_tx_correlation ON telemetry_transactions(correlation_id);
CREATE INDEX idx_telemetry_tx_status ON telemetry_transactions(status);

-- 9. Create threshold_rules table
CREATE TABLE IF NOT EXISTS threshold_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Scope
  asset_type_id UUID REFERENCES asset_types(id) ON DELETE CASCADE,
  specific_asset_ids UUID[], -- If null, applies to all assets of type

  -- Rule definition
  metric_key TEXT NOT NULL,
  condition JSONB NOT NULL, -- JSONata expression

  -- Thresholds
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,

  -- Behavior
  hysteresis NUMERIC DEFAULT 0,
  debounce_seconds INTEGER DEFAULT 60,
  cooldown_seconds INTEGER DEFAULT 300,

  -- Event generation
  event_type TEXT NOT NULL,
  event_severity TEXT NOT NULL CHECK (event_severity IN ('info', 'warning', 'critical')),
  event_priority INTEGER DEFAULT 3,
  message_template TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_threshold_rules_tenant ON threshold_rules(tenant_id);
CREATE INDEX idx_threshold_rules_asset_type ON threshold_rules(asset_type_id);
CREATE INDEX idx_threshold_rules_active ON threshold_rules(is_active) WHERE is_active = true;

-- 10. Add indices to entity_edges for device-asset links
CREATE INDEX IF NOT EXISTS idx_entity_edges_device_asset
  ON entity_edges(source_entity_id, target_entity_id)
  WHERE source_entity_type = 'Device' AND target_entity_type = 'Asset';

CREATE INDEX IF NOT EXISTS idx_entity_edges_relationship
  ON entity_edges(relationship_type, valid_from, valid_until);
```

**Acceptance Criteria**:
- [ ] All migration files created
- [ ] Migration runs successfully on development database
- [ ] All indices created
- [ ] No breaking changes to existing tables
- [ ] Migration is reversible (down migration written)

---

##### 1.2 Update Drizzle Schema Files (3h)

Update TypeScript schema files to match new database structure.

**Files to update**:
- `packages/api/src/db/schema/devices.ts`
- `packages/api/src/db/schema/assets.ts`
- `packages/api/src/db/schema/asset-types.ts`
- `packages/api/src/db/schema/device-types.ts`

**Files to create**:
- `packages/api/src/db/schema/telemetry-history.ts`
- `packages/api/src/db/schema/telemetry-raw.ts`
- `packages/api/src/db/schema/telemetry-chunks.ts`
- `packages/api/src/db/schema/telemetry-transactions.ts`
- `packages/api/src/db/schema/threshold-rules.ts`

**Example** (telemetry-history.ts):
```typescript
import { pgTable, uuid, text, numeric, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { devices } from './devices.js';

export const entityTypeEnum = pgEnum('entity_type_enum', ['Device', 'Asset']);
export const qualityEnum = pgEnum('quality_enum', ['good', 'uncertain', 'bad']);

export const telemetryHistory = pgTable(
  'telemetry_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

    entityId: uuid('entity_id').notNull(),
    entityType: entityTypeEnum('entity_type').notNull(),

    metricKey: text('metric_key').notNull(),
    value: numeric('value'),
    valueText: text('value_text'),
    valueJson: jsonb('value_json'),
    unit: text('unit'),

    quality: qualityEnum('quality').default('good'),

    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),

    sourceDeviceId: uuid('source_device_id').references(() => devices.id, { onDelete: 'set null' }),
    sourceMessageId: text('source_message_id'),

    metadata: jsonb('metadata').default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_telemetry_entity').on(table.entityId, table.entityType, table.timestamp),
    index('idx_telemetry_tenant').on(table.tenantId, table.timestamp),
    index('idx_telemetry_metric_key').on(table.metricKey),
    index('idx_telemetry_timestamp').on(table.timestamp),
  ]
);

export type TelemetryHistory = typeof telemetryHistory.$inferSelect;
export type NewTelemetryHistory = typeof telemetryHistory.$inferInsert;
```

**Acceptance Criteria**:
- [ ] All schema files updated
- [ ] TypeScript types generated correctly
- [ ] No TypeScript errors
- [ ] Drizzle kit can generate migrations from schema

---

##### 1.3 Run Migrations & Verify (2h)

**Steps**:
1. Run migrations on local development database
2. Verify all tables created
3. Verify all columns exist with correct types
4. Verify all indices created
5. Test rollback (down migration)
6. Document migration process

**Commands**:
```bash
# Generate migration
pnpm db:generate

# Run migration
pnpm db:migrate

# Verify
psql -d argusiq -c "\dt" # List tables
psql -d argusiq -c "\d telemetry_history" # Describe table
psql -d argusiq -c "\di" # List indices

# Rollback test
pnpm db:rollback
pnpm db:migrate # Re-apply
```

**Acceptance Criteria**:
- [ ] Migrations run successfully
- [ ] All tables exist with correct schema
- [ ] All indices created
- [ ] Rollback works without errors
- [ ] Migration documented in README

---

##### 1.4 Seed Development Data (1h)

Create seed script for development/testing.

**File**: `packages/api/src/db/seeds/iot-foundation.ts`

**Seed data**:
- 2 device types (Temperature Sensor, RTU Gateway)
- 2 asset types (HVAC Unit, Pump) with basic telemetry config
- 5 devices (3 sensors, 2 gateways)
- 10 assets
- 15 device-asset links via entity_edges
- 2 threshold rules

**Acceptance Criteria**:
- [ ] Seed script created
- [ ] Seed runs successfully
- [ ] Can query seeded data
- [ ] Seed is idempotent (can run multiple times)

---

### W1-T2: EMQX MQTT Broker Setup

**Priority**: P0 (Blocking)
**Estimated Time**: 6 hours
**Owner**: DevOps Engineer + Backend Engineer
**Dependencies**: None

#### Subtasks

##### 2.1 Add EMQX to docker-compose (2h)

**File**: `docker-compose.yml`

```yaml
services:
  emqx:
    image: emqx/emqx:5.5.0
    container_name: argusiq-emqx
    ports:
      - "1883:1883"      # MQTT
      - "8883:8883"      # MQTT over SSL
      - "8083:8083"      # WebSocket
      - "8084:8084"      # WebSocket over SSL
      - "18083:18083"    # Dashboard
    environment:
      EMQX_NAME: argusiq-emqx
      EMQX_HOST: 127.0.0.1

      # Authentication
      EMQX_ALLOW_ANONYMOUS: "false"

      # Listeners
      EMQX_LISTENER__TCP__EXTERNAL: 1883
      EMQX_LISTENER__SSL__EXTERNAL: 8883

      # Dashboard
      EMQX_DASHBOARD__DEFAULT_USERNAME: admin
      EMQX_DASHBOARD__DEFAULT_PASSWORD: ${EMQX_ADMIN_PASSWORD:-admin123}

      # Logging
      EMQX_LOG__CONSOLE__LEVEL: info

    volumes:
      - emqx_data:/opt/emqx/data
      - emqx_log:/opt/emqx/log
      - ./certs:/opt/emqx/etc/certs:ro  # mTLS certificates

    networks:
      - argusiq-network

    healthcheck:
      test: ["CMD", "emqx", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  emqx_data:
  emqx_log:
```

**Acceptance Criteria**:
- [ ] EMQX service added to docker-compose
- [ ] Service starts successfully (`docker-compose up emqx`)
- [ ] Dashboard accessible at http://localhost:18083
- [ ] Can login with admin credentials
- [ ] Health check passes

---

##### 2.2 Configure EMQX Authentication (2h)

Configure EMQX to use mTLS for device authentication.

**Configuration file**: Create `emqx/etc/emqx.conf` mounted as volume

```hocon
listeners.ssl.default {
  bind = "0.0.0.0:8883"
  max_connections = 10000

  ssl_options {
    cacertfile = "/opt/emqx/etc/certs/ca.crt"
    certfile = "/opt/emqx/etc/certs/server.crt"
    keyfile = "/opt/emqx/etc/certs/server.key"
    verify = verify_peer
    fail_if_no_peer_cert = true
  }
}

authentication = [
  {
    mechanism = x509
    enable = true
  }
]
```

**Steps**:
1. Create EMQX configuration file
2. Configure mTLS listener on port 8883
3. Set up authentication mechanism
4. Restart EMQX
5. Test connection with test certificate

**Acceptance Criteria**:
- [ ] EMQX configured for mTLS
- [ ] Anonymous connections rejected
- [ ] Valid client certificates accepted
- [ ] Invalid/missing certificates rejected

---

##### 2.3 Configure EMQX Bridge to NATS (2h)

Configure EMQX to forward messages to NATS (will implement bridge in W1-T5).

**Configuration**: Via EMQX Dashboard or config file

```hocon
bridges {
  webhook {
    nats_bridge {
      enable = true
      url = "http://mqtt-nats-bridge:3000/ingest"
      method = post
      headers {
        content-type = "application/json"
      }
      body = "${payload}"
    }
  }
}

rules {
  rule_forward_telemetry {
    sql = "SELECT * FROM '#'"  # All topics
    actions = ["webhook:nats_bridge"]
  }
}
```

**Note**: This uses webhook bridge initially. Will be replaced with custom bridge service.

**Acceptance Criteria**:
- [ ] Bridge configuration created
- [ ] Rule created to forward all messages
- [ ] Configuration validated in dashboard
- [ ] Ready for bridge service implementation

---

### W1-T3: NATS JetStream Setup

**Priority**: P0 (Blocking)
**Estimated Time**: 8 hours
**Owner**: DevOps Engineer + Backend Engineer
**Dependencies**: None

#### Subtasks

##### 3.1 Add NATS to docker-compose (2h)

**File**: `docker-compose.yml`

```yaml
services:
  nats-1:
    image: nats:2.10-alpine
    container_name: argusiq-nats-1
    command:
      - "--cluster_name=argusiq-cluster"
      - "--cluster=nats://0.0.0.0:6222"
      - "--routes=nats://nats-2:6222,nats://nats-3:6222"
      - "--http_port=8222"
      - "--js"
      - "--sd=/data"
    ports:
      - "4222:4222"   # Client connections
      - "6222:6222"   # Cluster routes
      - "8222:8222"   # HTTP monitoring
    volumes:
      - nats_1_data:/data
    networks:
      - argusiq-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8222/healthz"]
      interval: 10s
      timeout: 5s
      retries: 5

  nats-2:
    image: nats:2.10-alpine
    container_name: argusiq-nats-2
    command:
      - "--cluster_name=argusiq-cluster"
      - "--cluster=nats://0.0.0.0:6222"
      - "--routes=nats://nats-1:6222,nats://nats-3:6222"
      - "--http_port=8222"
      - "--js"
      - "--sd=/data"
    ports:
      - "4223:4222"
      - "8223:8222"
    volumes:
      - nats_2_data:/data
    networks:
      - argusiq-network

  nats-3:
    image: nats:2.10-alpine
    container_name: argusiq-nats-3
    command:
      - "--cluster_name=argusiq-cluster"
      - "--cluster=nats://0.0.0.0:6222"
      - "--routes=nats://nats-1:6222,nats://nats-2:6222"
      - "--http_port=8222"
      - "--js"
      - "--sd=/data"
    ports:
      - "4224:4222"
      - "8224:8222"
    volumes:
      - nats_3_data:/data
    networks:
      - argusiq-network

volumes:
  nats_1_data:
  nats_2_data:
  nats_3_data:
```

**Acceptance Criteria**:
- [ ] All 3 NATS nodes start successfully
- [ ] Cluster forms correctly
- [ ] Can access monitoring at http://localhost:8222
- [ ] Health checks pass on all nodes

---

##### 3.2 Create NATS Streams (3h)

Create JetStream streams for telemetry pipeline.

**Script**: `packages/api/src/scripts/setup-nats-streams.ts`

```typescript
import { connect, JetStreamManager } from 'nats';

async function setupStreams() {
  const nc = await connect({
    servers: ['nats://localhost:4222', 'nats://localhost:4223', 'nats://localhost:4224'],
  });

  const jsm: JetStreamManager = await nc.jetstreamManager();

  // 1. Raw telemetry stream (from MQTT bridge)
  await jsm.streams.add({
    name: 'TELEMETRY_RAW_V1',
    subjects: ['telemetry.raw.v1.>'],
    retention: 'limits',
    max_age: 60 * 60 * 24 * 7 * 1_000_000_000, // 7 days in nanoseconds
    max_bytes: 10 * 1024 * 1024 * 1024, // 10GB
    storage: 'file',
    num_replicas: 3,
    duplicate_window: 2 * 60 * 1_000_000_000, // 2 minutes
  });

  // 2. Logical devices stream (after demux)
  await jsm.streams.add({
    name: 'TELEMETRY_LOGICAL_DEVICES_V1',
    subjects: ['telemetry.logical_devices.v1.>'],
    retention: 'limits',
    max_age: 60 * 60 * 24 * 1_000_000_000, // 1 day
    max_bytes: 5 * 1024 * 1024 * 1024, // 5GB
    storage: 'file',
    num_replicas: 3,
  });

  // 3. Normalized telemetry stream
  await jsm.streams.add({
    name: 'TELEMETRY_NORMALIZED_V1',
    subjects: ['telemetry.normalized.v1.>'],
    retention: 'limits',
    max_age: 60 * 60 * 24 * 1_000_000_000, // 1 day
    max_bytes: 5 * 1024 * 1024 * 1024, // 5GB
    storage: 'file',
    num_replicas: 3,
  });

  // 4. Asset telemetry stream
  await jsm.streams.add({
    name: 'TELEMETRY_ASSET_V1',
    subjects: ['telemetry.asset.v1.>'],
    retention: 'limits',
    max_age: 60 * 60 * 24 * 1_000_000_000, // 1 day
    max_bytes: 5 * 1024 * 1024 * 1024, // 5GB
    storage: 'file',
    num_replicas: 3,
  });

  // 5. Events stream
  await jsm.streams.add({
    name: 'EVENTS_V1',
    subjects: ['events.v1.>'],
    retention: 'limits',
    max_age: 60 * 60 * 24 * 30 * 1_000_000_000, // 30 days
    max_bytes: 2 * 1024 * 1024 * 1024, // 2GB
    storage: 'file',
    num_replicas: 3,
  });

  // 6. Dead Letter Queue
  await jsm.streams.add({
    name: 'TELEMETRY_DLQ',
    subjects: ['telemetry.dlq.>'],
    retention: 'limits',
    max_age: 60 * 60 * 24 * 30 * 1_000_000_000, // 30 days
    max_bytes: 1 * 1024 * 1024 * 1024, // 1GB
    storage: 'file',
    num_replicas: 3,
  });

  console.log('All streams created successfully');
  await nc.close();
}

setupStreams().catch(console.error);
```

**Acceptance Criteria**:
- [ ] Script created and runs successfully
- [ ] All 6 streams created
- [ ] Streams have correct configuration (replicas, retention, size limits)
- [ ] Can publish and consume test messages

---

##### 3.3 Create NATS Consumers (2h)

Create durable consumer groups for workers.

**Script**: `packages/api/src/scripts/setup-nats-consumers.ts`

```typescript
async function setupConsumers() {
  const nc = await connect({ servers: ['nats://localhost:4222'] });
  const jsm = await nc.jetstreamManager();

  // Consumer for Demultiplexer Worker
  await jsm.consumers.add('TELEMETRY_RAW_V1', {
    durable_name: 'demux-processor-group',
    ack_policy: 'explicit',
    max_deliver: 3,
    ack_wait: 30 * 1_000_000_000, // 30 seconds
    deliver_policy: 'all',
  });

  // Consumer for Normalization Worker
  await jsm.consumers.add('TELEMETRY_LOGICAL_DEVICES_V1', {
    durable_name: 'normalization-processor-group',
    ack_policy: 'explicit',
    max_deliver: 3,
    ack_wait: 30 * 1_000_000_000,
    deliver_policy: 'all',
  });

  // Consumer for TSDB Writer
  await jsm.consumers.add('TELEMETRY_NORMALIZED_V1', {
    durable_name: 'tsdb-writer-group',
    ack_policy: 'explicit',
    max_deliver: 3,
    ack_wait: 60 * 1_000_000_000, // 60 seconds for batch writes
    deliver_policy: 'all',
  });

  // Consumer for Asset Processor
  await jsm.consumers.add('TELEMETRY_NORMALIZED_V1', {
    durable_name: 'asset-processor-group',
    ack_policy: 'explicit',
    max_deliver: 3,
    ack_wait: 30 * 1_000_000_000,
    deliver_policy: 'all',
  });

  // Consumer for Real-Time Broadcaster
  await jsm.consumers.add('TELEMETRY_ASSET_V1', {
    durable_name: 'realtime-broadcaster-group',
    ack_policy: 'explicit',
    max_deliver: 3,
    ack_wait: 10 * 1_000_000_000, // 10 seconds (fast path)
    deliver_policy: 'all',
  });

  // Consumer for Event Engine
  await jsm.consumers.add('TELEMETRY_ASSET_V1', {
    durable_name: 'event-engine-group',
    ack_policy: 'explicit',
    max_deliver: 3,
    ack_wait: 30 * 1_000_000_000,
    deliver_policy: 'all',
  });

  console.log('All consumers created successfully');
  await nc.close();
}
```

**Acceptance Criteria**:
- [ ] Consumer groups created for all workers
- [ ] Correct ack policy and retry settings
- [ ] Can consume messages from each consumer group

---

##### 3.4 Test NATS Setup (1h)

Create test script to verify NATS cluster and streams.

**Acceptance Criteria**:
- [ ] Can publish messages to all streams
- [ ] Can consume messages from all consumer groups
- [ ] Messages replicated across 3 nodes
- [ ] Failover works (stop one node, messages still flow)

---

### W1-T4: Redis Setup & Configuration

**Priority**: P0 (Blocking)
**Estimated Time**: 4 hours
**Owner**: DevOps Engineer
**Dependencies**: None

#### Subtasks

##### 4.1 Add Redis to docker-compose (1h)

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: argusiq-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - argusiq-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

**Acceptance Criteria**:
- [ ] Redis starts successfully
- [ ] Can connect via `redis-cli`
- [ ] Persistence configured (AOF)
- [ ] Memory limit set

---

##### 4.2 Configure Redis Cache Strategy (2h)

Create Redis configuration module.

**File**: `packages/api/src/lib/cache/redis-client.ts`

```typescript
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

// Cache key patterns
export const CacheKeys = {
  deviceAssetLinks: (deviceId: string) => `device_asset_links:${deviceId}`,
  assetProfile: (assetTypeId: string) => `asset_profile:${assetTypeId}`,
  deviceProfile: (deviceTypeId: string) => `device_profile:${deviceTypeId}`,
  thresholdRules: (assetTypeId: string) => `threshold_rules:${assetTypeId}`,
  cooldown: (ruleId: string, assetId: string) => `cooldown:${ruleId}:${assetId}`,
};

// Cache TTLs (seconds)
export const CacheTTL = {
  deviceAssetLinks: 300, // 5 minutes
  assetProfile: 300, // 5 minutes
  deviceProfile: 300, // 5 minutes
  thresholdRules: 300, // 5 minutes
  cooldown: (seconds: number) => seconds, // Dynamic based on rule
};

// Invalidation channel
export const CACHE_INVALIDATION_CHANNEL = 'cache:invalidate';
```

**Acceptance Criteria**:
- [ ] Redis client configured
- [ ] Cache key patterns defined
- [ ] TTL strategy documented
- [ ] Invalidation channel defined

---

##### 4.3 Set Up Redis Pub/Sub (1h)

Configure pub/sub for cache invalidation.

**File**: `packages/api/src/lib/cache/cache-invalidation.ts`

```typescript
import { redis } from './redis-client.js';
import { CACHE_INVALIDATION_CHANNEL } from './redis-client.js';

export interface CacheInvalidationMessage {
  type: 'device_profile' | 'asset_profile' | 'threshold_rules' | 'device_asset_links';
  id: string;
}

export async function publishInvalidation(message: CacheInvalidationMessage) {
  await redis.publish(CACHE_INVALIDATION_CHANNEL, JSON.stringify(message));
}

export async function subscribeToInvalidations(callback: (message: CacheInvalidationMessage) => void) {
  const subscriber = redis.duplicate();

  await subscriber.subscribe(CACHE_INVALIDATION_CHANNEL);

  subscriber.on('message', (channel, message) => {
    if (channel === CACHE_INVALIDATION_CHANNEL) {
      const parsed = JSON.parse(message) as CacheInvalidationMessage;
      callback(parsed);
    }
  });

  return subscriber;
}
```

**Acceptance Criteria**:
- [ ] Pub/sub client configured
- [ ] Invalidation message format defined
- [ ] Can publish and receive messages

---

### W1-T5: MQTT→NATS Bridge Service

**Priority**: P0 (Blocking)
**Estimated Time**: 10 hours
**Owner**: Backend Engineer
**Dependencies**: W1-T2 (EMQX), W1-T3 (NATS)

#### Subtasks

##### 5.1 Create Bridge Service Structure (2h)

**Directory**: `packages/api/src/services/mqtt-nats-bridge/`

```
mqtt-nats-bridge/
├── index.ts           # Service entry point
├── server.ts          # Fastify HTTP server
├── bridge.ts          # Core bridge logic
├── message-parser.ts  # Parse MQTT messages
├── config.ts          # Configuration
└── types.ts           # TypeScript types
```

**File**: `packages/api/src/services/mqtt-nats-bridge/index.ts`

```typescript
import { startBridgeServer } from './server.js';
import { logger } from '../../lib/logger.js';

async function main() {
  logger.info('Starting MQTT→NATS Bridge Service');

  try {
    await startBridgeServer();
    logger.info('Bridge service started successfully');
  } catch (error) {
    logger.error('Failed to start bridge service', { error });
    process.exit(1);
  }
}

main();
```

**Acceptance Criteria**:
- [ ] Service directory structure created
- [ ] Entry point defined
- [ ] Basic logging configured

---

##### 5.2 Implement HTTP Webhook Receiver (3h)

Receive webhooks from EMQX.

**File**: `packages/api/src/services/mqtt-nats-bridge/server.ts`

```typescript
import Fastify from 'fastify';
import { processMqttMessage } from './bridge.js';
import { logger } from '../../lib/logger.js';

export async function startBridgeServer() {
  const server = Fastify({ logger: true });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', service: 'mqtt-nats-bridge' };
  });

  // EMQX webhook endpoint
  server.post('/ingest', async (request, reply) => {
    try {
      const {
        topic,
        payload,
        clientid,
        username,
        timestamp,
      } = request.body as {
        topic: string;
        payload: string; // Base64 encoded
        clientid: string;
        username: string;
        timestamp: number;
      };

      // Decode payload
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
      const parsedPayload = JSON.parse(decodedPayload);

      // Process message
      await processMqttMessage({
        topic,
        payload: parsedPayload,
        clientId: clientid,
        username,
        receivedAt: new Date(timestamp),
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to process MQTT message', { error });
      reply.code(500);
      return { success: false, error: (error as Error).message };
    }
  });

  const port = parseInt(process.env.BRIDGE_PORT || '3001');
  await server.listen({ port, host: '0.0.0.0' });
  logger.info(`Bridge server listening on port ${port}`);

  return server;
}
```

**Acceptance Criteria**:
- [ ] HTTP server created
- [ ] Webhook endpoint implemented
- [ ] Health check endpoint works
- [ ] Payload decoding works
- [ ] Error handling in place

---

##### 5.3 Implement NATS Publisher (3h)

Publish messages to NATS JetStream.

**File**: `packages/api/src/services/mqtt-nats-bridge/bridge.ts`

```typescript
import { connect, JetStreamClient, StringCodec } from 'nats';
import { logger } from '../../lib/logger.js';
import { db } from '../../db/index.js';
import { telemetryRaw } from '../../db/schema/telemetry-raw.js';

let natsConnection: any;
let jetStream: JetStreamClient;
const sc = StringCodec();

export async function initializeNatsConnection() {
  natsConnection = await connect({
    servers: [
      'nats://nats-1:4222',
      'nats://nats-2:4222',
      'nats://nats-3:4222',
    ],
    reconnect: true,
    maxReconnectAttempts: -1, // Infinite reconnects
  });

  jetStream = natsConnection.jetstream();
  logger.info('Connected to NATS JetStream');
}

export async function processMqttMessage(message: {
  topic: string;
  payload: any;
  clientId: string;
  username: string;
  receivedAt: Date;
}) {
  const { topic, payload, clientId, receivedAt } = message;

  // Extract device ID from topic (format: devices/{deviceId}/telemetry)
  const deviceIdMatch = topic.match(/devices\/([^\/]+)\/telemetry/);
  if (!deviceIdMatch) {
    logger.warn('Invalid topic format', { topic });
    return;
  }
  const deviceId = deviceIdMatch[1];

  try {
    // 1. Write to telemetry_raw table (immutable record)
    await db.insert(telemetryRaw).values({
      deviceId,
      payload: payload as any,
      ingestionSource: 'mqtt',
      mqttTopic: topic,
      clientId,
      deviceTimestamp: payload.timestamp ? new Date(payload.timestamp) : null,
      receivedAt,
    });

    // 2. Publish to NATS
    const natsSubject = `telemetry.raw.v1.${deviceId}`;
    const message = {
      deviceId,
      payload,
      topic,
      clientId,
      receivedAt: receivedAt.toISOString(),
    };

    await jetStream.publish(natsSubject, sc.encode(JSON.stringify(message)));

    logger.debug('Message published to NATS', { deviceId, subject: natsSubject });
  } catch (error) {
    logger.error('Failed to process MQTT message', { error, deviceId });
    throw error;
  }
}
```

**Acceptance Criteria**:
- [ ] NATS connection established
- [ ] Messages published to correct stream
- [ ] Device ID extracted from topic
- [ ] Raw telemetry written to database
- [ ] Error handling and retry logic

---

##### 5.4 Add Dockerfile & docker-compose Entry (1h)

**File**: `packages/api/Dockerfile.bridge`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

CMD ["node", "dist/services/mqtt-nats-bridge/index.js"]
```

**File**: Add to `docker-compose.yml`

```yaml
services:
  mqtt-nats-bridge:
    build:
      context: ./packages/api
      dockerfile: Dockerfile.bridge
    container_name: argusiq-mqtt-bridge
    environment:
      NODE_ENV: production
      BRIDGE_PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: redis
      NATS_URLS: nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
    ports:
      - "3001:3000"
    depends_on:
      - postgres
      - redis
      - nats-1
      - nats-2
      - nats-3
      - emqx
    networks:
      - argusiq-network
    restart: unless-stopped
```

**Acceptance Criteria**:
- [ ] Dockerfile created
- [ ] docker-compose entry added
- [ ] Service builds successfully
- [ ] Service starts and connects to NATS

---

##### 5.5 Test End-to-End (1h)

Test complete MQTT→NATS flow.

**Test Steps**:
1. Start all services (`docker-compose up`)
2. Publish MQTT message using mosquitto_pub
3. Verify message appears in telemetry_raw table
4. Verify message published to NATS stream
5. Consume message from NATS to verify

**Test Command**:
```bash
# Publish test message
mosquitto_pub \
  -h localhost \
  -p 8883 \
  --cafile certs/ca.crt \
  --cert certs/client.crt \
  --key certs/client.key \
  -t "devices/test-device-123/telemetry" \
  -m '{"temperature": 25.5, "humidity": 60, "timestamp": "2026-01-28T12:00:00Z"}'

# Verify in database
psql -d argusiq -c "SELECT * FROM telemetry_raw WHERE device_id = 'test-device-123'"

# Verify in NATS
nats stream view TELEMETRY_RAW_V1
```

**Acceptance Criteria**:
- [ ] MQTT message received by EMQX
- [ ] Message forwarded to bridge service
- [ ] Message written to telemetry_raw table
- [ ] Message published to NATS stream
- [ ] Can consume message from NATS

---

### W1-T6: Certificate Infrastructure (mTLS)

**Priority**: P0 (Blocking)
**Estimated Time**: 8 hours
**Owner**: Backend Engineer + DevOps Engineer
**Dependencies**: W1-T2 (EMQX)

#### Subtasks

##### 6.1 Create Certificate Generation Script (3h)

**File**: `scripts/generate-certs.sh`

```bash
#!/bin/bash

# Certificate generation for MQTT mTLS
# Creates CA, server cert, and client certs

set -e

CERTS_DIR="./certs"
mkdir -p "$CERTS_DIR"

echo "Generating CA certificate..."

# 1. Generate CA private key
openssl genrsa -out "$CERTS_DIR/ca.key" 4096

# 2. Generate CA certificate (10 year validity)
openssl req -new -x509 -days 3650 \
  -key "$CERTS_DIR/ca.key" \
  -out "$CERTS_DIR/ca.crt" \
  -subj "/C=US/ST=State/L=City/O=ArgusIQ/OU=IoT/CN=ArgusIQ CA"

echo "Generating server certificate..."

# 3. Generate server private key
openssl genrsa -out "$CERTS_DIR/server.key" 2048

# 4. Generate server CSR
openssl req -new \
  -key "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.csr" \
  -subj "/C=US/ST=State/L=City/O=ArgusIQ/OU=IoT/CN=localhost"

# 5. Sign server certificate with CA
openssl x509 -req -days 365 \
  -in "$CERTS_DIR/server.csr" \
  -CA "$CERTS_DIR/ca.crt" \
  -CAkey "$CERTS_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERTS_DIR/server.crt"

echo "Generating client certificate..."

# 6. Generate client private key
openssl genrsa -out "$CERTS_DIR/client.key" 2048

# 7. Generate client CSR
openssl req -new \
  -key "$CERTS_DIR/client.key" \
  -out "$CERTS_DIR/client.csr" \
  -subj "/C=US/ST=State/L=City/O=ArgusIQ/OU=IoT/CN=test-device-123"

# 8. Sign client certificate with CA
openssl x509 -req -days 365 \
  -in "$CERTS_DIR/client.csr" \
  -CA "$CERTS_DIR/ca.crt" \
  -CAkey "$CERTS_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERTS_DIR/client.crt"

# Clean up CSR files
rm "$CERTS_DIR"/*.csr
rm "$CERTS_DIR"/*.srl

# Set permissions
chmod 600 "$CERTS_DIR"/*.key
chmod 644 "$CERTS_DIR"/*.crt

echo "Certificates generated successfully in $CERTS_DIR/"
echo "CA Certificate: $CERTS_DIR/ca.crt"
echo "Server Certificate: $CERTS_DIR/server.crt"
echo "Server Key: $CERTS_DIR/server.key"
echo "Client Certificate: $CERTS_DIR/client.crt"
echo "Client Key: $CERTS_DIR/client.key"
```

**Acceptance Criteria**:
- [ ] Script generates CA certificate
- [ ] Script generates server certificate
- [ ] Script generates test client certificate
- [ ] Certificates valid for 1 year
- [ ] Script is idempotent

---

##### 6.2 Implement Certificate Generation API (4h)

API for programmatic device certificate generation.

**File**: `packages/api/src/routes/devices/certificates.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { forge } from 'node-forge';
import { db } from '../../db/index.js';
import { devices } from '../../db/schema/devices.js';
import { eq } from 'drizzle-orm';

const GenerateCertSchema = z.object({
  deviceId: z.string().uuid(),
  validityDays: z.number().min(1).max(365).default(365),
});

export async function certificateRoutes(fastify: FastifyInstance) {
  // Generate client certificate for device
  fastify.post('/devices/:deviceId/certificate', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const body = GenerateCertSchema.parse(request.body);

    // Check device exists
    const device = await db.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });

    if (!device) {
      reply.code(404);
      return { error: 'Device not found' };
    }

    // Load CA certificate and key
    const caCert = forge.pki.certificateFromPem(
      fs.readFileSync('./certs/ca.crt', 'utf8')
    );
    const caKey = forge.pki.privateKeyFromPem(
      fs.readFileSync('./certs/ca.key', 'utf8')
    );

    // Generate device key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(
      cert.validity.notBefore.getDate() + body.validityDays
    );

    const attrs = [
      { name: 'commonName', value: deviceId },
      { name: 'countryName', value: 'US' },
      { shortName: 'ST', value: 'State' },
      { name: 'localityName', value: 'City' },
      { name: 'organizationName', value: 'ArgusIQ' },
      { shortName: 'OU', value: 'IoT Devices' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(caCert.subject.attributes);

    // Sign certificate with CA
    cert.sign(caKey, forge.md.sha256.create());

    // Convert to PEM format
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // Store certificate metadata in device record
    await db.update(devices)
      .set({
        networkMetadata: {
          ...device.networkMetadata,
          certificateIssued: true,
          certificateIssuedAt: new Date().toISOString(),
          certificateExpiresAt: cert.validity.notAfter.toISOString(),
        },
      })
      .where(eq(devices.id, deviceId));

    return {
      certificate: certPem,
      privateKey: keyPem,
      caCertificate: fs.readFileSync('./certs/ca.crt', 'utf8'),
      expiresAt: cert.validity.notAfter,
    };
  });

  // Revoke certificate
  fastify.delete('/devices/:deviceId/certificate', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };

    // Update device to mark certificate as revoked
    await db.update(devices)
      .set({
        networkMetadata: {
          certificateRevoked: true,
          certificateRevokedAt: new Date().toISOString(),
        },
      })
      .where(eq(devices.id, deviceId));

    return { success: true };
  });
}
```

**Acceptance Criteria**:
- [ ] API can generate client certificates
- [ ] Certificates signed by CA
- [ ] Certificate expiry tracked in database
- [ ] Can revoke certificates
- [ ] Returns PEM-formatted certificate and key

---

##### 6.3 Test Certificate Authentication (1h)

Test MQTT connection with generated certificates.

**Test Steps**:
1. Generate test certificate via API
2. Connect to EMQX with certificate
3. Publish test message
4. Verify connection successful
5. Test with invalid certificate (should fail)
6. Test with revoked certificate (should fail)

**Acceptance Criteria**:
- [ ] Valid certificates accepted by EMQX
- [ ] Invalid certificates rejected
- [ ] Can connect and publish with generated cert

---

### W1-T7: HTTP Ingestion Endpoint (Secondary)

**Priority**: P1 (Important but not blocking)
**Estimated Time**: 6 hours
**Owner**: Backend Engineer
**Dependencies**: W1-T3 (NATS)

#### Subtasks

##### 7.1 Create HTTP Telemetry Endpoint (3h)

**File**: `packages/api/src/routes/telemetry/ingest.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { connect, StringCodec } from 'nats';
import { db } from '../../db/index.js';
import { telemetryRaw } from '../../db/schema/telemetry-raw.js';
import { logger } from '../../lib/logger.js';

const TelemetryIngestSchema = z.object({
  deviceId: z.string().uuid(),
  metrics: z.record(z.union([z.number(), z.string(), z.boolean()])),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function telemetryIngestRoutes(fastify: FastifyInstance) {
  // Initialize NATS connection
  const nc = await connect({
    servers: ['nats://nats-1:4222', 'nats://nats-2:4222', 'nats://nats-3:4222'],
  });
  const jetStream = nc.jetstream();
  const sc = StringCodec();

  fastify.post('/telemetry/ingest', {
    schema: {
      body: TelemetryIngestSchema,
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof TelemetryIngestSchema>;
    const { deviceId, metrics, timestamp, metadata } = body;

    try {
      // 1. Write to telemetry_raw table
      await db.insert(telemetryRaw).values({
        deviceId,
        payload: { metrics, metadata },
        ingestionSource: 'http',
        deviceTimestamp: timestamp ? new Date(timestamp) : null,
        receivedAt: new Date(),
      });

      // 2. Publish to NATS
      const natsSubject = `telemetry.raw.v1.${deviceId}`;
      const message = {
        deviceId,
        payload: { metrics, metadata },
        receivedAt: new Date().toISOString(),
      };

      await jetStream.publish(natsSubject, sc.encode(JSON.stringify(message)));

      logger.debug('HTTP telemetry ingested', { deviceId });

      return {
        success: true,
        messageId: message.messageId,
      };
    } catch (error) {
      logger.error('Failed to ingest HTTP telemetry', { error, deviceId });
      reply.code(500);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
```

**Acceptance Criteria**:
- [ ] Endpoint accepts telemetry via POST
- [ ] Validates request body with Zod
- [ ] Writes to telemetry_raw table
- [ ] Publishes to NATS stream
- [ ] Returns success/error response

---

##### 7.2 Add Authentication to HTTP Endpoint (2h)

Add API key authentication for HTTP telemetry.

**File**: `packages/api/src/routes/telemetry/ingest.ts` (update)

```typescript
fastify.post('/telemetry/ingest', {
  preHandler: async (request, reply) => {
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      reply.code(401);
      throw new Error('Missing API key');
    }

    // Verify API key belongs to device
    const device = await db.query.devices.findFirst({
      where: and(
        eq(devices.apiKey, apiKey),
        eq(devices.id, request.body.deviceId)
      ),
    });

    if (!device) {
      reply.code(403);
      throw new Error('Invalid API key');
    }

    request.device = device;
  },
}, async (request, reply) => {
  // ... rest of handler
});
```

**Acceptance Criteria**:
- [ ] Requires X-API-Key header
- [ ] Validates API key against device
- [ ] Rejects requests with invalid/missing key
- [ ] Allows valid API keys

---

##### 7.3 Test HTTP Ingestion (1h)

**Test Steps**:
1. Generate API key for test device
2. Send HTTP POST with telemetry
3. Verify message in telemetry_raw table
4. Verify message in NATS stream
5. Test error cases (missing key, invalid key)

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/v1/telemetry/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: device-api-key-123" \
  -d '{
    "deviceId": "test-device-123",
    "metrics": {
      "temperature": 25.5,
      "humidity": 60
    },
    "timestamp": "2026-01-28T12:00:00Z"
  }'
```

**Acceptance Criteria**:
- [ ] HTTP POST succeeds with valid API key
- [ ] Message appears in database
- [ ] Message published to NATS
- [ ] Invalid API key rejected

---

### W1-T8: Infrastructure Testing & Validation

**Priority**: P0 (Blocking)
**Estimated Time**: 6 hours
**Owner**: Backend Engineer + DevOps Engineer
**Dependencies**: All above tasks

#### Subtasks

##### 8.1 Integration Test Suite (3h)

Create automated tests for infrastructure.

**File**: `packages/api/tests/integration/week1-infrastructure.test.ts`

```typescript
describe('Week 1 Infrastructure', () => {
  describe('Database Migrations', () => {
    test('All tables exist', async () => {
      // Query information_schema
      // Verify all tables created
    });

    test('All indices exist', async () => {
      // Verify indices created
    });
  });

  describe('EMQX MQTT Broker', () => {
    test('EMQX is running', async () => {
      // Health check on port 18083
    });

    test('Can connect with valid certificate', async () => {
      // MQTT connect with test cert
    });

    test('Cannot connect without certificate', async () => {
      // Should reject
    });
  });

  describe('NATS JetStream', () => {
    test('All streams created', async () => {
      // List streams via JSM
    });

    test('Can publish to stream', async () => {
      // Publish test message
    });

    test('Can consume from stream', async () => {
      // Consume test message
    });
  });

  describe('MQTT→NATS Bridge', () => {
    test('Bridge service is running', async () => {
      // Health check
    });

    test('End-to-end MQTT to NATS', async () => {
      // Publish MQTT → verify in NATS
    });
  });

  describe('HTTP Ingestion', () => {
    test('Can ingest via HTTP', async () => {
      // POST to /telemetry/ingest
    });

    test('Message appears in NATS', async () => {
      // Verify published
    });
  });
});
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Tests can run in CI/CD
- [ ] Tests cover all critical paths

---

##### 8.2 Performance Baseline Test (2h)

Measure baseline performance.

**Test**: Publish 10,000 messages and measure:
- Ingestion rate (msg/sec)
- End-to-end latency (MQTT → NATS)
- Database write performance
- Memory usage
- CPU usage

**Tool**: Use `k6` or custom Node.js script

**Acceptance Criteria**:
- [ ] Can handle 1000 msg/sec
- [ ] P95 latency < 100ms
- [ ] No message loss
- [ ] Results documented

---

##### 8.3 Documentation & Runbook (1h)

**Files to create**:
- `docs/deployment/week1-setup-guide.md` - How to set up infrastructure
- `docs/deployment/week1-troubleshooting.md` - Common issues and solutions
- `docs/deployment/week1-runbook.md` - Operations guide

**Content**:
- How to start services
- How to verify services are healthy
- How to test end-to-end flow
- How to view logs
- How to debug issues
- Port mappings
- Environment variables

**Acceptance Criteria**:
- [ ] Setup guide complete
- [ ] Troubleshooting guide complete
- [ ] Runbook complete
- [ ] Another engineer can follow guides

---

## Week 1 Success Criteria

### Must Have (P0)
- [ ] All database migrations applied successfully
- [ ] EMQX broker running with mTLS authentication
- [ ] NATS JetStream cluster (3 nodes) running
- [ ] All NATS streams and consumers created
- [ ] Redis running with cache configuration
- [ ] MQTT→NATS bridge service operational
- [ ] Certificate generation working (script + API)
- [ ] HTTP ingestion endpoint functional
- [ ] Can publish MQTT message with certificate → appears in NATS stream
- [ ] Can POST HTTP telemetry → appears in NATS stream
- [ ] Integration tests pass
- [ ] Infrastructure documented

### Nice to Have (P1)
- [ ] Performance baseline documented (1000 msg/sec)
- [ ] Grafana dashboards for monitoring (basic)
- [ ] Certificate revocation working
- [ ] Load test completed

---

## Daily Standup Questions

**Monday**: "What's our database migration strategy?"
**Tuesday**: "Are EMQX and NATS talking to each other?"
**Wednesday**: "Can we send a message end-to-end?"
**Thursday**: "Are certificates working correctly?"
**Friday**: "Can we pass all integration tests?"

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Certificate generation complexity | Use node-forge library, test early |
| NATS cluster formation issues | Test with single node first, then scale to 3 |
| EMQX bridge configuration | Use webhook initially, optimize later |
| Database migration failures | Test migrations on copy of production data |
| Integration issues between services | Test each integration separately |

---

## Next Steps After Week 1

**Week 2 Focus**: Build workers (Normalization, TSDB Writer, Asset Processor)
- Consume from NATS streams
- Process telemetry
- Write to database
- Publish to downstream streams

---

## Environment Variables Needed

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/argusiq

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# NATS
NATS_URLS=nats://localhost:4222,nats://localhost:4223,nats://localhost:4224

# EMQX
EMQX_ADMIN_PASSWORD=admin123

# Bridge Service
BRIDGE_PORT=3001

# API
API_PORT=3000
JWT_SECRET=your-secret-key
```

---

## Commands Quick Reference

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Run database migrations
pnpm db:migrate

# Set up NATS streams
pnpm run setup:nats-streams

# Generate certificates
./scripts/generate-certs.sh

# Run integration tests
pnpm test:integration

# Test MQTT connection
mosquitto_pub -h localhost -p 8883 \
  --cafile certs/ca.crt \
  --cert certs/client.crt \
  --key certs/client.key \
  -t "devices/test-123/telemetry" \
  -m '{"temp": 25.5}'

# Test HTTP ingestion
curl -X POST http://localhost:3000/api/v1/telemetry/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{"deviceId": "test-123", "metrics": {"temp": 25.5}}'
```
