# IoT Architecture Gap Analysis & Implementation Plan

**Date:** 2026-01-28
**Project:** ArgusIQ Lite - Phase 7.1 IoT & Asset Hub
**Architecture Reference:** `C:\source\vx-dionysus-req\documentation\architecture\IoT_Asset_Centric_Architecture_vNext.md`

---

## Executive Summary

The architecture document describes a **production-grade, event-driven IoT platform** with separation of device vs asset telemetry, while the current implementation has **basic CRUD APIs** for devices and assets with a simpler schema model. This document identifies critical gaps and provides a phased implementation plan.

---

## Current State Analysis

### ✅ What's Implemented

#### 1. **Database Schema**
- **5 Base Types** with dedicated tables:
  - `devices` - IoT devices with network info, geolocation, firmware
  - `assets` - Physical/logical assets with health scores, hierarchical support
  - `spaces` - Physical locations
  - `persons` - Workers with geolocation tracking
  - `activities` - Work items with 4-category model
- **Type Management**: `device_types`, `asset_types`, `activity_types`, `space_types`, `person_types`
- **Telemetry Storage**: `telemetry_history` table (basic time-series)
- **Event System**: `system_events` table with processing state
- **Relationship Graph**: `entity_edges` for typed relationships (MONITORED_BY, CONTROLLED_BY, etc.)
- **Dual Schema Approach**:
  - Phase 7 tables: `devices`, `assets`, `activities` (specific columns)
  - Meta-model tables: `entities`, `entity_edges` (generic graph model)

#### 2. **API Layer**
- **CRUD Routes** for all 5 base types:
  - `/api/v1/devices` - Full CRUD + filtering by status, type, search
  - `/api/v1/assets` - Full CRUD + hierarchy queries, nearby assets
  - `/api/v1/spaces`, `/api/v1/persons`, `/api/v1/activities`
  - `/api/v1/types` - Type management for all base types
- **Organization-scoped**: All queries filtered by `organizationId` from JWT
- **Pagination, search, filtering** on all list endpoints

#### 3. **Architecture Foundations**
- **Multi-tenancy**: Organization-scoped data with RLS context
- **Authentication**: JWT with organization context
- **Audit logging**: Via `audit.service.ts`
- **PostGIS enabled**: Geolocation support with geometry columns
- **Soft deletes**: `deletedAt` column pattern

### ❌ What's Missing (Critical Gaps)

#### **1. Data Plane - Telemetry Pipeline**

| Component | Required | Status | Gap |
|-----------|----------|--------|-----|
| Edge Ingest | MQTT/CoAP/HTTP endpoints | ❌ | No ingestion layer |
| Event Bus | Kafka/NATS/Redis Streams | ❌ | No message queue |
| Raw Store | Immutable append-only storage | ❌ | No raw data preservation |
| Normalize/Validate | Schema validation, transformation | ❌ | No processing pipeline |
| Asset Processor | Device→Asset telemetry mapping | ❌ | No transformation logic |
| Event Engine | Threshold detection, rule evaluation | ❌ | No event processing |
| DLQ | Dead letter queue for failed messages | ❌ | No error handling |
| Hot TSDB | High-performance time-series queries | ⚠️ | Basic Postgres table only |

**Impact**: Cannot ingest real-time telemetry from devices. No data processing pipeline.

#### **2. Device-Asset Linkage**

| Feature | Required | Status | Gap |
|---------|----------|--------|-----|
| Device-Asset Links | Time-bound relationships | ⚠️ | Can use `entity_edges` with `validFrom`/`validUntil` but no API |
| RTU Port Mapping | One device, multiple assets via ports | ❌ | No port concept in schema |
| Link History | Preserve history across device swaps | ⚠️ | Schema supports it, no business logic |
| Asset Link Cache | Fast lookup for telemetry routing | ❌ | No caching layer |

**Impact**: Cannot map device telemetry to assets. No RTU/multi-port device support.

#### **3. Telemetry Versioning & Replay**

| Feature | Required | Status | Gap |
|---------|----------|--------|-----|
| Versioned Streams | `telemetry.raw.v1`, `telemetry.norm.v1` | ❌ | Single table, no versioning |
| Immutable Raw Store | Source of truth for replay | ❌ | `telemetry_history` is mutable |
| Replay Capability | Reprocess historical data | ❌ | No replay mechanism |
| Schema Registry | Track telemetry schemas | ❌ | No schema management |

**Impact**: Cannot safely deploy new processors. Cannot recover from processing bugs.

#### **4. Event → Activity Flow**

| Feature | Required | Status | Gap |
|---------|----------|--------|-----|
| Event-driven Activities | Auto-create work orders from events | ❌ | No event→activity logic |
| Rule Engine | Threshold rules, conditions | ❌ | No rules engine |
| Activity Templates | Pre-configured work order templates | ❌ | No templates |
| CMMS Integration | Link activities to maintenance | ⚠️ | Activities table exists, no workflow |

**Impact**: Manual activity creation only. No automation from telemetry events.

#### **5. Composite Asset Telemetry**

| Feature | Required | Status | Gap |
|---------|----------|--------|-----|
| Hierarchical Rollups | Parent asset aggregates child metrics | ❌ | No aggregation logic |
| Derived Metrics | Business metrics from device data | ❌ | No transformation layer |
| Asset Health Scores | Computed from telemetry | ⚠️ | `health_score` column exists, no calculation |

**Impact**: Assets don't have computed business metrics. No composite views.

#### **6. Control Plane**

| Feature | Required | Status | Gap |
|---------|----------|--------|-----|
| Feature Flags | Rollout control for processors | ❌ | No feature flag system |
| Schema Registry | Validate incoming telemetry | ❌ | No schema validation |
| Asset Profiles | Pre-configured asset templates | ❌ | No profiles yet |
| Blue/Green Deploy | Safe processor deployments | ❌ | No deployment strategy |

**Impact**: Risky deployments. No gradual rollouts.

---

## Architecture Decisions Required

### **Decision 1: Event Bus Technology**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Redis Streams** | Simple, already might use Redis for cache | Lower throughput, single node | ⭐ Phase 1 (MVP) |
| **NATS/JetStream** | Lightweight, built-in persistence | Less ecosystem | ⭐ Phase 2 (Scale) |
| **Kafka** | Industry standard, massive scale | Complex setup, overkill | Phase 3 (Enterprise) |

**Recommendation**: Start with **Redis Streams** for MVP, design abstraction layer for future migration.

### **Decision 2: Time-Series Database**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **TimescaleDB** | Postgres extension, easy migration | Postgres overhead | ⭐ Phase 1 (use existing) |
| **InfluxDB** | Purpose-built for TSDB | New infrastructure | Phase 2 |
| **QuestDB** | Fastest ingestion | Newer, less mature | Consider later |

**Recommendation**: Use **TimescaleDB hypertable** (convert `telemetry_history`), defer dedicated TSDB.

### **Decision 3: Schema Approach**

Current codebase has **dual schemas**:
- **Phase 7 tables** (`devices`, `assets`, etc.) - Specific columns, better performance
- **Meta-model tables** (`entities`, `entity_edges`) - Generic graph, more flexible

**Recommendation**:
- **Use Phase 7 tables** for Device/Asset CRUD and UI display
- **Use entity_edges** for device-asset links with temporal validity
- **Hybrid approach**: Best of both worlds

### **Decision 4: Device-Asset Links**

Two approaches:
1. **Direct Foreign Key**: Add `device_id` to `assets` table (simple, no history)
2. **Entity Edges**: Use `entity_edges` with `MONITORED_BY` relationship (flexible, time-bound)

**Recommendation**: **Entity Edges** for:
- Time-bound links (`validFrom`, `validUntil`)
- RTU port mapping via `metadata` JSONB
- Device replacement history preservation

---

## Phased Implementation Plan

### **Phase 1: Foundation (Weeks 1-2)** - MVP Telemetry

**Goal**: Ingest and display device telemetry in UI

#### Week 1: Telemetry Ingestion
1. **HTTP Telemetry Endpoint**
   - `POST /api/v1/telemetry/ingest` - Simple HTTP endpoint
   - Accept JSON: `{ deviceId, metrics: { temp: 25.5, pressure: 101.3 }, timestamp }`
   - Write directly to `telemetry_history` table
   - Return 200 OK

2. **Device-Asset Links API**
   - `POST /api/v1/devices/:deviceId/assets/:assetId/link` - Create link
   - `DELETE /api/v1/devices/:deviceId/assets/:assetId/unlink` - Remove link
   - `GET /api/v1/devices/:deviceId/assets` - List linked assets
   - `GET /api/v1/assets/:assetId/devices` - List linked devices
   - Backend: Create `entity_edges` rows with `relationshipType = 'MONITORED_BY'`

3. **Telemetry Query API**
   - `GET /api/v1/telemetry/device/:deviceId` - Device telemetry history
   - `GET /api/v1/telemetry/asset/:assetId` - Asset telemetry (from linked devices)
   - Query params: `metricKey`, `startTime`, `endTime`, `limit`

#### Week 2: UI Components
4. **IoT Hub - Devices Page**
   - Device list with connectivity status (last_seen_at)
   - Filters: status, type, search
   - Device detail page with tabs:
     - Overview: Basic info, network details
     - Telemetry: Charts for latest metrics
     - Linked Assets: Table of connected assets
     - Configuration: Custom attributes editor

5. **Asset Hub - Assets Page**
   - Asset list with health scores
   - Filters: status, type, hierarchy
   - Asset detail page with tabs:
     - Overview: Basic info, parent/children
     - IoT Devices: List of monitoring devices
     - Telemetry: Aggregated metrics from devices
     - Location: Map view with geolocation

6. **Navigation Structure**
   - Add "IoT Hub" and "Asset Hub" to sidebar
   - Nested menu items per mock app structure

**Deliverable**: Can ingest telemetry via HTTP, link devices to assets, view device/asset telemetry in UI.

---

### **Phase 2: Event Bus & Processing (Weeks 3-4)** - Production Pipeline

**Goal**: Add message queue and async processing

#### Week 3: Message Infrastructure
1. **Redis Streams Setup**
   - Add Redis to docker-compose (if not already present)
   - Streams: `telemetry:raw`, `telemetry:normalized`, `events`
   - Consumer groups for processors

2. **Telemetry Processor Service**
   - New service: `packages/api/src/workers/telemetry-processor.ts`
   - Consume from `telemetry:raw` stream
   - Validate schema, normalize data
   - Write to `telemetry_history` table
   - Publish to `telemetry:normalized` stream
   - On error: Publish to `telemetry:dlq` stream

3. **Asset Telemetry Processor**
   - New service: `packages/api/src/workers/asset-processor.ts`
   - Consume from `telemetry:normalized` stream
   - Query device-asset links from cache
   - Map device metrics to asset metrics
   - Compute derived metrics (health score)
   - Update `assets.health_score` column
   - Publish `telemetry:asset` events

#### Week 4: Event Engine
4. **Event Processor Service**
   - New service: `packages/api/src/workers/event-processor.ts`
   - Consume from `telemetry:asset` stream
   - Evaluate threshold rules (stored in new `threshold_rules` table)
   - On breach: Create `system_events` row
   - Trigger activity creation

5. **Activity Automation**
   - New service: `packages/api/src/workers/activity-creator.ts`
   - Consume from `events` stream
   - Match event type to activity templates
   - Auto-create activities in `activities` table
   - Assign to users/roles based on rules

**Deliverable**: Async telemetry processing pipeline with event-driven activity creation.

---

### **Phase 3: Advanced Features (Weeks 5-6)** - Production-Ready

#### Week 5: RTU & Composite Assets
1. **RTU Port Support**
   - Add `port` field to device-asset links metadata
   - Telemetry format: `{ deviceId, port: 1, metrics: {...} }`
   - Asset processor routes by port number

2. **Composite Asset Rollups**
   - New worker: `packages/api/src/workers/rollup-processor.ts`
   - Query asset hierarchy (parent-child)
   - Aggregate child metrics to parent
   - Compute composite health scores

3. **Derived Metrics Engine**
   - Define transformations in `asset_types.telemetrySchema`
   - Example: Convert device voltage to asset power consumption
   - Apply formulas during asset processing

#### Week 6: Reliability & Observability
4. **DLQ & Replay**
   - DLQ UI: View failed messages
   - Replay API: `POST /api/v1/telemetry/replay` with date range
   - Republish raw messages to stream

5. **Immutable Raw Store**
   - New table: `telemetry_raw` (append-only, no updates/deletes)
   - Migrate `telemetry_history` to hypertable
   - Retention policies: Raw (90 days), Processed (1 year), Aggregates (forever)

6. **Monitoring & Metrics**
   - Prometheus metrics for all processors
   - Dashboards: Throughput, latency, errors
   - Alerts on DLQ size, processing lag

**Deliverable**: Production-ready with RTU support, composite assets, replay capability.

---

### **Phase 4: UI Completion (Weeks 7-8)** - Full Feature Set

1. **Protocol Converters Management**
   - UI for managing data transformations
   - List of converters (Modbus→JSON, OPC-UA→JSON, etc.)

2. **Global Triggers**
   - UI for threshold rules
   - Condition builder: IF `asset.temperature > 80` THEN create activity

3. **Alarms Page**
   - Real-time alarm dashboard
   - Acknowledge/dismiss alarms
   - Alarm history

4. **Usage Analytics**
   - Telemetry ingestion stats
   - Device connectivity uptime
   - Top talkers, bandwidth usage

5. **Asset Templates**
   - Pre-configured asset definitions
   - Clone from template

6. **Asset Groups**
   - Dynamic groups (filter-based)
   - Static groups (manual selection)
   - Group-level operations

**Deliverable**: Complete IoT Hub and Asset Hub UI matching mock app.

---

## Database Schema Changes Required

### New Tables

```sql
-- Device-Asset links (if not using entity_edges)
CREATE TABLE device_asset_links (
  id UUID PRIMARY KEY,
  device_id UUID REFERENCES devices(id),
  asset_id UUID REFERENCES assets(id),
  port INTEGER, -- For RTU devices
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  metadata JSONB, -- { role: 'primary', metrics_mapping: {...} }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Threshold rules
CREATE TABLE threshold_rules (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  entity_type TEXT, -- 'asset' | 'device'
  entity_id UUID, -- NULL for global rules
  condition JSONB NOT NULL, -- { metric: 'temp', operator: '>', value: 80 }
  severity TEXT, -- 'low' | 'medium' | 'high' | 'critical'
  action JSONB, -- { type: 'create_activity', template_id: '...' }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity templates
CREATE TABLE activity_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  activity_type_id UUID REFERENCES activity_types(id),
  default_priority TEXT,
  default_assigned_role TEXT,
  checklist JSONB, -- [ { item: 'Check pressure', required: true } ]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable raw telemetry
CREATE TABLE telemetry_raw (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL,
  payload JSONB NOT NULL, -- Original message
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingestion_source TEXT -- 'http' | 'mqtt' | 'coap'
);

-- Asset profiles (pre-configured templates)
CREATE TABLE asset_profiles (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  asset_type_id UUID REFERENCES asset_types(id),
  default_attributes JSONB,
  default_health_thresholds JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modifications to Existing Tables

```sql
-- Add processing metadata to telemetry_history
ALTER TABLE telemetry_history
  ADD COLUMN source_device_id UUID,
  ADD COLUMN derived_from_raw_id BIGINT, -- Links to telemetry_raw
  ADD COLUMN processor_version TEXT; -- Track which processor version created this

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('telemetry_history', 'timestamp');

-- Add link count to devices for quick UI display
ALTER TABLE devices
  ADD COLUMN linked_assets_count INTEGER DEFAULT 0;
```

---

## API Routes Required

### Telemetry Ingestion
- `POST /api/v1/telemetry/ingest` - Ingest device telemetry
- `GET /api/v1/telemetry/device/:deviceId` - Query device telemetry
- `GET /api/v1/telemetry/asset/:assetId` - Query asset telemetry
- `POST /api/v1/telemetry/replay` - Replay historical data

### Device-Asset Links
- `POST /api/v1/devices/:deviceId/assets/:assetId/link`
- `DELETE /api/v1/devices/:deviceId/assets/:assetId/unlink`
- `GET /api/v1/devices/:deviceId/assets`
- `GET /api/v1/assets/:assetId/devices`

### Threshold Rules
- `GET /api/v1/rules` - List threshold rules
- `POST /api/v1/rules` - Create rule
- `PUT /api/v1/rules/:id` - Update rule
- `DELETE /api/v1/rules/:id` - Delete rule

### Activity Templates
- `GET /api/v1/activity-templates` - List templates
- `POST /api/v1/activity-templates` - Create template
- `POST /api/v1/activities/from-template/:templateId` - Create activity from template

### Asset Profiles
- `GET /api/v1/asset-profiles` - List profiles
- `POST /api/v1/asset-profiles` - Create profile
- `POST /api/v1/assets/from-profile/:profileId` - Create asset from profile

---

## Technology Stack Additions

### Backend
- **Redis** (if not present) - Message broker, cache
- **TimescaleDB extension** - Hypertable for telemetry
- **Bull or BullMQ** - Job queue for workers (optional, can use native Redis streams)
- **ioredis** - Redis client
- **Zod schemas** - Telemetry validation

### Frontend
- **Recharts or Apache ECharts** - Telemetry charting
- **React Query** - Real-time data fetching
- **Socket.IO or Server-Sent Events** - Real-time telemetry updates
- **Leaflet or Mapbox** - Map visualization for geolocation

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Redis not available | Pipeline blocked | Low | Fall back to HTTP sync writes initially |
| Schema migration conflicts | Data loss | Medium | Test migrations on staging, backup before deploy |
| Performance at scale | Slow queries | High | Add TimescaleDB, proper indexing, caching |
| Dual schema confusion | Developer errors | Medium | Clear documentation, repository abstractions |
| Device auth/security | Unauthorized access | High | Implement device tokens, mTLS for MQTT |

---

## Success Criteria

### Phase 1 (MVP)
- [ ] Can ingest telemetry via HTTP POST
- [ ] Devices display "Online" status based on `last_seen_at`
- [ ] Can link devices to assets via UI
- [ ] Asset detail page shows telemetry from linked devices
- [ ] 3 charts: Temperature, Pressure, Connectivity

### Phase 2 (Production)
- [ ] Telemetry processed asynchronously via Redis
- [ ] DLQ captures failed messages
- [ ] Events auto-create activities
- [ ] Health scores computed from telemetry
- [ ] <5 second latency from device to UI

### Phase 3 (Advanced)
- [ ] RTU devices with port mapping working
- [ ] Composite assets show rolled-up metrics
- [ ] Replay capability tested with 1M records
- [ ] 99.9% uptime for telemetry pipeline

### Phase 4 (Complete)
- [ ] All mock app features replicated
- [ ] <10 TODOs remaining in codebase
- [ ] Test coverage >70% for new code
- [ ] Documentation complete

---

## Open Questions for User

1. **Telemetry Ingestion Protocol**: Do you need MQTT support now, or is HTTP enough for MVP?
2. **Real-Time Updates**: Should device status update in UI without refresh (WebSocket/SSE)?
3. **Device Authentication**: How do devices authenticate? API keys, JWT, mTLS?
4. **Telemetry Volume**: Expected messages per second? (affects DB choice)
5. **Redis Infrastructure**: Is Redis already in your stack? If not, can we add it?
6. **Mock Device Simulator**: Do you need a simulator for testing, or do you have real devices?

---

## Recommended Starting Point

**Start with Phase 1, Week 1, Task 1**:

1. Create HTTP telemetry ingest endpoint
2. Simple writes to `telemetry_history` table
3. Get something working end-to-end quickly
4. Iterate from there

This allows you to:
- See telemetry in UI immediately
- Validate the data model
- Build incrementally without big-bang infrastructure changes
- Defer complexity (Redis, workers) until proven necessary

---

**Next Steps**: Review this analysis, answer open questions, and I'll proceed with implementation.
