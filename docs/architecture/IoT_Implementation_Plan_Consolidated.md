# IoT Platform Implementation Plan - Consolidated

## Executive Summary

This document consolidates the implementation plans from multiple architecture documents into a single, actionable timeline. It reconciles the differences between the full production architecture (12 weeks) and the MVP approach (8 weeks), providing a recommended path forward.

---

## Implementation Approaches Available

### Approach A: Full Production Architecture (12 Weeks)
**Source**: [IoT_Platform_Architecture_Design.md](./IoT_Platform_Architecture_Design.md)

**Stack**:
- MQTT Broker: EMQX with mTLS
- Message Bus: NATS JetStream (3-node cluster)
- TSDB: TimescaleDB
- Real-Time: WebSocket (Socket.IO)
- Cache: Redis

**Pros**:
- Production-ready from day one
- Handles 30K msg/sec
- Industry-standard MQTT protocol
- Horizontal scalability built-in

**Cons**:
- Longer timeline (12 weeks)
- More infrastructure complexity
- Higher learning curve

---

### Approach B: MVP with Redis Streams (8 Weeks)
**Source**: [IoT_Architecture_Gap_Analysis.md](./IoT_Architecture_Gap_Analysis.md)

**Stack**:
- Telemetry Ingestion: HTTP REST API
- Message Bus: Redis Streams
- TSDB: PostgreSQL (regular tables first)
- Real-Time: Polling initially
- Cache: Redis (already used for message bus)

**Pros**:
- Faster to market (8 weeks)
- Simpler stack (fewer moving parts)
- Lower infrastructure overhead
- Easier to debug

**Cons**:
- HTTP not industry standard for IoT
- Redis Streams limited to ~10K msg/sec
- Migration required for production scale

---

## Recommended Approach: Hybrid Path (10 Weeks)

**Rationale**: Start with MVP speed, but use production components where possible to minimize future migration effort.

### Hybrid Stack Decision Matrix

| Component | Week 1-4 (MVP) | Week 5-10 (Production) | Migration Required? |
|-----------|----------------|------------------------|---------------------|
| **Telemetry Ingestion** | HTTP REST API | EMQX MQTT with mTLS | ✅ Yes - Add MQTT bridge |
| **Message Bus** | Redis Streams | NATS JetStream | ✅ Yes - Change worker consumers |
| **Database** | PostgreSQL tables | TimescaleDB hypertables | ✅ Yes - Convert tables |
| **Workers** | Node.js consumers | Same (reuse code) | ❌ No - Just change message source |
| **Real-Time UI** | WebSocket (Socket.IO) | Same | ❌ No - Keep from start |
| **Cache** | Redis | Same | ❌ No - Keep from start |
| **Device Auth** | API keys | mTLS certificates | ✅ Yes - Add cert generation |

**Key Insight**: Use production-ready components that don't add complexity (WebSocket, Redis cache), defer complex ones (MQTT/mTLS, NATS).

---

## Consolidated 10-Week Timeline

### Phase 1: Foundation & MVP (Weeks 1-4)

#### Week 1: Infrastructure & Data Model
**Goal**: Set up infrastructure and database schema

**Tasks**:
- [ ] **Database Migrations**
  - Add new columns to `devices` table (device_role, parent_device_id, logical_identifier)
  - Add new columns to `assets` table (health_score_updated_at, health_score_computed_by)
  - Add new columns to `asset_types` table (metric_definitions, transformation_engine, health_algorithm, threshold_rules, event_rules, aggregation_rules, validation_rules)
  - Create `telemetry_history` table (if not exists)
  - Create `threshold_rules` table
  - Create `telemetry_chunks` table (for gateway chunking)
  - Create `telemetry_transactions` table (for atomic processing)
  - Add indices for performance

- [ ] **Infrastructure Setup**
  - Add Redis to docker-compose (if not already present)
  - Configure Redis Streams (telemetry.raw, telemetry.normalized, telemetry.asset, events)
  - Set up Redis cache with TTL policies
  - Configure WebSocket server (Socket.IO with Redis adapter)

- [ ] **API Foundation**
  - Set up worker infrastructure (service runners)
  - Add Zod schemas for telemetry validation
  - Create base classes for workers (consumer, error handling, metrics)

**Deliverable**: Database ready, Redis configured, worker framework in place

---

#### Week 2: Telemetry Ingestion & Workers
**Goal**: Build telemetry pipeline (HTTP → Workers → DB)

**Tasks**:
- [ ] **Telemetry Ingestion API**
  - `POST /api/v1/telemetry/ingest` - Accept device telemetry via HTTP
  - Request format: `{ deviceId, metrics: {...}, timestamp, metadata: {...} }`
  - Publish to Redis Stream `telemetry.raw`
  - Return 200 OK with messageId

- [ ] **Device-Asset Link API**
  - `POST /api/v1/devices/:deviceId/assets/:assetId/link` - Create link
  - `DELETE /api/v1/devices/:deviceId/assets/:assetId/unlink` - Remove link
  - `GET /api/v1/devices/:deviceId/assets` - List linked assets
  - `GET /api/v1/assets/:assetId/devices` - List linked devices
  - Backend uses `entity_edges` with relationship_type = 'MONITORED_BY'
  - Metadata JSONB includes: metrics_mapping, port (for RTU), role

- [ ] **Normalization Worker**
  - Service: `packages/api/src/workers/normalization-worker.ts`
  - Consume from `telemetry.raw` stream
  - Validate schema with Zod
  - Normalize timestamp formats
  - Publish to `telemetry.normalized` stream
  - On error: Publish to DLQ stream

- [ ] **TSDB Writer Worker**
  - Service: `packages/api/src/workers/tsdb-writer.ts`
  - Consume from `telemetry.normalized` stream
  - Batch write to `telemetry_history` table (1000 rows per transaction)
  - Update device `last_seen_at` timestamp
  - Track metrics (write latency, batch size)

**Deliverable**: Can ingest telemetry via HTTP, data flows through workers to database

---

#### Week 3: Asset Processing & Real-Time Updates
**Goal**: Transform device telemetry to asset telemetry, enable real-time UI

**Tasks**:
- [ ] **Asset Telemetry Worker**
  - Service: `packages/api/src/workers/asset-telemetry-worker.ts`
  - Consume from `telemetry.normalized` stream
  - Query device-asset links from Redis cache (cache-first strategy)
  - Load asset type profile from Redis cache
  - Apply metric transformations (device → asset metrics)
  - Compute derived metrics using JSONata
  - Compute health score using configured algorithm
  - Write to `telemetry_history` (entity_type = 'Asset')
  - Update `assets.health_score` column
  - Publish to `telemetry.asset` stream

- [ ] **Real-Time Broadcaster Worker**
  - Service: `packages/api/src/workers/realtime-broadcaster.ts`
  - Consume from `telemetry.asset` stream
  - Transform to UI-friendly format
  - Publish to Socket.IO rooms (by organization, by asset)
  - Include: assetId, metrics, healthScore, timestamp

- [ ] **WebSocket Integration**
  - Add Socket.IO to Fastify API
  - Implement authentication middleware (verify JWT)
  - Create room management (join org room, join asset room)
  - Client-side: React hook for WebSocket connection
  - Auto-reconnect with exponential backoff

- [ ] **Telemetry Query API**
  - `GET /api/v1/telemetry/device/:deviceId` - Device telemetry history
  - `GET /api/v1/telemetry/asset/:assetId` - Asset telemetry history
  - Query params: `metricKey`, `startTime`, `endTime`, `limit`, `aggregation`
  - Support time-based aggregation (5min, 1hour, 1day)

**Deliverable**: Device telemetry transforms to asset telemetry, real-time updates in UI

---

#### Week 4: Event Engine & Activity Automation
**Goal**: Rules trigger events, events create activities

**Tasks**:
- [ ] **Threshold Rules API**
  - `POST /api/v1/threshold-rules` - Create rule
  - `GET /api/v1/threshold-rules` - List rules (filter by asset type, organization)
  - `PATCH /api/v1/threshold-rules/:id` - Update rule
  - `DELETE /api/v1/threshold-rules/:id` - Delete rule
  - Schema: condition (JSONata), event_type, severity, cooldown_seconds

- [ ] **Event Engine Worker**
  - Service: `packages/api/src/workers/event-engine-worker.ts`
  - Consume from `telemetry.asset` stream
  - Query active threshold rules for asset's type
  - Evaluate conditions using JSONata
  - Check cooldown period (Redis TTL keys)
  - On breach: Create row in `system_events` table
  - Publish to `events` stream

- [ ] **Activity Creator Worker**
  - Service: `packages/api/src/workers/activity-creator-worker.ts`
  - Consume from `events` stream
  - Match event type to activity templates
  - Auto-create activity in `activities` table
  - Assign to users/roles based on template rules
  - Set priority based on event severity

- [ ] **DLQ Monitoring**
  - Create DLQ consumer that logs errors
  - Add Prometheus metrics for DLQ size
  - Alert when DLQ > 100 messages

**Deliverable**: Rules evaluate telemetry, events trigger activities automatically

---

### Phase 2: UI Implementation (Weeks 5-7)

#### Week 5: IoT Hub Pages
**Goal**: Complete IoT Hub section matching mock app

**Tasks**:
- [ ] **Navigation Structure**
  - Add "IoT Hub" section to sidebar
  - Sub-items: Devices, Device Types, Gateways, Protocol Converters, Alarms

- [ ] **Devices List Page** (`/org/iot-hub/devices`)
  - Data grid with filters (status, type, search)
  - Columns: Name, Type, Status (online/offline), Last Seen, Linked Assets, Actions
  - Status indicator with WebSocket real-time updates
  - Bulk actions: Link to asset, delete

- [ ] **Device Detail Page** (`/org/iot-hub/devices/:id`)
  - **Overview Tab**: Basic info, network details, metadata
  - **Telemetry Tab**: Real-time charts (line/area charts with ApexCharts or Recharts)
  - **Linked Assets Tab**: Table of linked assets with link/unlink actions
  - **Configuration Tab**: Custom attributes editor (JSON or form)
  - **Activity Log Tab**: History of changes (from audit log)

- [ ] **Device Types Management** (`/org/iot-hub/types`)
  - List of device types
  - CRUD operations
  - Fields: Name, description, icon, protocol, processing_mode

**Deliverable**: IoT Hub UI complete, can view devices and telemetry in real-time

---

#### Week 6: Asset Hub Pages
**Goal**: Complete Asset Hub section matching mock app

**Tasks**:
- [ ] **Navigation Structure**
  - Add "Asset Hub" section to sidebar
  - Sub-items: Assets, Asset Types, Asset Profiles, Groups, Templates, Triggers, Alarms

- [ ] **Assets List Page** (`/org/asset-hub/assets`)
  - Data grid with filters (status, type, hierarchy, search)
  - Columns: Name, Type, Status, Health Score (with color), Linked Devices, Location, Actions
  - Health score badge with color coding (red <40, yellow 40-70, green >70)

- [ ] **Asset Detail Page** (`/org/asset-hub/assets/:id`)
  - **Overview Tab**: Basic info, parent/children tree view
  - **IoT Dashboard Tab**: Widget-based dashboard showing key metrics
  - **IoT Telemetry Tab**: Historical data table with filters (time range, metric keys, devices)
  - **IoT Devices Tab**: List of monitoring devices with link/unlink actions
  - **Location Tab**: Map view (if geolocation), space assignment, floor plan placement
  - **Maintenance Tab**: Maintenance logs, schedule maintenance, activities list
  - **Documents Tab**: Attached files (manuals, warranties, photos)
  - **Alarms Tab**: Event history for this asset
  - **Audit Tab**: Change history

- [ ] **Asset Types Management** (`/org/asset-hub/types`)
  - Hierarchical tree view (3 levels max)
  - CRUD operations with parent selection
  - Fields: Name, description, icon, color, custom fields
  - **NEW: Telemetry Config tab** (see Week 7)

- [ ] **Asset Profiles Management** (`/org/asset-hub/profiles`)
  - List of profiles
  - CRUD operations
  - Fields: Device mode, location mode, telemetry settings, alarm settings
  - Usage count per profile

**Deliverable**: Asset Hub UI complete, can view assets with telemetry from devices

---

#### Week 7: Asset Type Telemetry Configuration UI
**Goal**: Add configuration UI for asset processing rules

**Tasks**:
- [ ] **Asset Type Telemetry Configuration API**
  - `GET /api/v1/asset-types/:id/telemetry-config` - Get configuration
  - `PATCH /api/v1/asset-types/:id/telemetry-config` - Update configuration
  - `POST /api/v1/asset-types/:id/telemetry-config/test` - Test with sample data
  - `GET /api/v1/asset-types/:id/telemetry-config/versions` - Version history

- [ ] **Telemetry Config Tab** (in Asset Type detail page)

  **A. Metric Definitions Section**
  - Form to add/edit metrics
  - Fields: key, display_name, unit, data_type, precision, range
  - Mark metrics as "derived" with formula

  **B. Transformation Engine Section**
  - Device → Asset metric mappings (source → target)
  - JSONPath expressions for complex extractions
  - Derived metric formulas using JSONata
  - Visual formula builder (drag-drop operators)

  **C. Health Algorithm Designer**
  - Select algorithm type (weighted_deductions, score_based, etc.)
  - Add rules: metric, condition, deduction/score
  - Visual preview with test data
  - Real-time health score calculation

  **D. Threshold Configuration**
  - Visual sliders for warning/critical thresholds
  - Hysteresis and debounce settings
  - Message templates with variable interpolation

  **E. Event Rules Editor**
  - Condition builder (IF metric > value THEN...)
  - Event type, severity, priority
  - Actions: notifications, activity creation
  - Cooldown period configuration

  **F. Test Panel**
  - Input device telemetry JSON
  - Run test button
  - Display results: transformed metrics, health score, threshold violations, events generated
  - Show step-by-step processing log

- [ ] **Configuration Version Control**
  - Save configuration changes with version number
  - View version history (table with timestamp, user, changes)
  - Rollback to previous version

- [ ] **Hot Reload Mechanism**
  - On save: Invalidate Redis cache for asset type profile
  - Publish invalidation message to Redis pub/sub channel
  - Workers listen and reload configuration

**Deliverable**: Can configure asset telemetry processing without code changes

---

### Phase 3: Advanced Features (Weeks 8-9)

#### Week 8: Gateway & Complex Telemetry
**Goal**: Support Location Hubs, BLE Gateways, RTU multi-port

**Tasks**:
- [ ] **Demultiplexer Worker**
  - Service: `packages/api/src/workers/demultiplexer-worker.ts`
  - Consume from `telemetry.raw` stream
  - Check device role (endpoint, gateway, gateway_chunked, rtu_multiport)
  - For gateways: Split message into logical devices
  - For chunked: Reassemble chunks using correlation_id
  - For RTU: Route by port number
  - Publish individual messages to `telemetry.logical_devices` stream

- [ ] **Chunk Reassembly**
  - Store chunks in `telemetry_chunks` table
  - Match by correlation_id
  - Wait for all chunks (sequence_number, total_chunks)
  - Timeout after 60 seconds (incomplete chunks → DLQ)
  - Merge chunks and process as complete message

- [ ] **Transaction Coordinator**
  - Track logical device processing in `telemetry_transactions` table
  - Ensure all related assets updated atomically
  - UI shows "Updating..." during batch processing
  - Only show results when all assets processed

- [ ] **Gateway Management UI**
  - List of gateway devices
  - Virtual devices table (child devices)
  - Hierarchy visualization (gateway → logical devices → assets)

**Deliverable**: Location Hubs, BLE Gateways, RTU devices work correctly

---

#### Week 9: Dynamic Device Management
**Goal**: Add new device types via configuration, no deployment

**Tasks**:
- [ ] **Device Type Profiles**
  - Add columns to `device_types` table: processing_mode, message_schema, extraction_rules, demux_strategy, chunking_config, transformation_rules
  - Device Type Profiles API (CRUD)

- [ ] **Device Type Configuration UI**
  - Add "Processing Config" tab to Device Type detail page
  - Processing mode selector (endpoint, gateway, gateway_chunked, rtu_multiport)
  - Message schema editor (JSON Schema or Zod schema)
  - Extraction rules (JSONPath expressions)
  - Demultiplexing strategy (for gateways)
  - Test panel for device payload

- [ ] **Configuration-Driven Workers**
  - Update Demultiplexer Worker to use device type profile
  - Update Normalization Worker to use extraction rules
  - Cache device type profiles in Redis

- [ ] **Hot Reload for Device Types**
  - Invalidate cache on device type profile update
  - Publish invalidation message
  - Workers reload configuration

**Deliverable**: Can add new device types without code changes

---

### Phase 4: Production Readiness (Week 10)

#### Week 10: Performance, Monitoring, Documentation
**Goal**: Production-ready deployment

**Tasks**:
- [ ] **Performance Optimization**
  - Optimize database queries (EXPLAIN ANALYZE, add indices)
  - Batch database writes (current: 1000 rows per transaction, tune if needed)
  - Connection pooling (PgBouncer configuration)
  - Redis connection pooling

- [ ] **TimescaleDB Migration**
  - Convert `telemetry_history` to hypertable
  - Set up compression policy (7 days → compress)
  - Set up retention policy (raw: 90 days, processed: 1 year, aggregates: forever)
  - Test migration on copy of production data

- [ ] **Monitoring & Observability**
  - Add Prometheus metrics to all workers
    - Messages processed per second
    - Processing latency (P50, P95, P99)
    - Error rate
    - DLQ size
    - Cache hit rate
  - Create Grafana dashboards
    - System overview (throughput, latency, errors)
    - Worker health (per-worker metrics)
    - Database performance (queries per second, connection pool)
  - Set up alerts
    - DLQ size > 100
    - Worker lag > 5 seconds
    - Error rate > 1%
    - Database connection pool exhausted

- [ ] **Load Testing**
  - Build device simulator
  - Test scenarios: 100 devices, 1000 devices, 5000 devices
  - Sustained load: 10K msg/sec for 4 hours
  - Spike test: Burst to 20K msg/sec for 5 minutes
  - Identify bottlenecks, optimize

- [ ] **Documentation**
  - API documentation (OpenAPI/Swagger)
  - Deployment guide (docker-compose, environment variables)
  - User guide (device onboarding, linking devices to assets, creating rules)
  - Troubleshooting guide (common issues, log locations, debugging steps)
  - Architecture overview (with diagrams)

**Deliverable**: Production deployment ready, load tested, documented, monitored

---

## Migration to Full Production (Optional: Weeks 11-12)

If scale requirements exceed Redis Streams capacity (>10K msg/sec sustained), migrate to MQTT + NATS.

### Week 11: MQTT Infrastructure
- [ ] Set up EMQX cluster (3 nodes)
- [ ] Configure mTLS (CA certificate, client cert generation)
- [ ] Build certificate management API
- [ ] Device cert generation UI
- [ ] MQTT→NATS bridge service
- [ ] Update device onboarding to include cert provisioning

### Week 12: NATS Migration
- [ ] Set up NATS JetStream cluster (3 nodes)
- [ ] Create streams: telemetry.raw.v1, telemetry.normalized.v1, telemetry.asset.v1
- [ ] Update workers to consume from NATS instead of Redis Streams
- [ ] Parallel run: HTTP + MQTT ingestion
- [ ] Gradual device migration from HTTP to MQTT
- [ ] Decommission HTTP ingestion endpoint

**Deliverable**: 30K msg/sec capacity, industry-standard MQTT protocol

---

## Success Criteria by Phase

### Phase 1 Success (Week 4)
- [ ] Can ingest telemetry via HTTP POST
- [ ] Telemetry flows through all workers to database
- [ ] Can link devices to assets
- [ ] Asset health scores computed automatically
- [ ] Rules trigger events, events create activities
- [ ] Zero message loss at 1K msg/sec for 1 hour

### Phase 2 Success (Week 7)
- [ ] IoT Hub UI matches mock app
- [ ] Asset Hub UI matches mock app
- [ ] Real-time telemetry updates without page refresh
- [ ] Can configure asset type telemetry processing in UI
- [ ] Configuration changes take effect immediately (hot reload)
- [ ] Can test configuration before saving

### Phase 3 Success (Week 9)
- [ ] Location Hub with 50 virtual devices works
- [ ] BLE Gateway with 2000 beacons (67 chunks) works
- [ ] RTU with 4 ports controlling 4 assets works
- [ ] All updates appear atomically in UI
- [ ] Can add new device type via UI configuration
- [ ] New device type processes telemetry without code changes

### Phase 4 Success (Week 10)
- [ ] 10K msg/sec sustained for 4 hours
- [ ] End-to-end latency <5 seconds (P95)
- [ ] Zero data loss during worker restart
- [ ] Prometheus metrics exposed, Grafana dashboards working
- [ ] Documentation complete (API, deployment, user guide, troubleshooting)
- [ ] Load test report with performance benchmarks

---

## Risk Analysis & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Redis Streams throughput insufficient at 10K/sec** | High | Medium | Load test early (Week 4), have migration plan to NATS ready |
| **PostgreSQL write bottleneck** | High | Medium | Batch inserts (1000 rows), PgBouncer pooling, TimescaleDB optimization |
| **Workers crash on bad data** | Medium | Medium | Schema validation with Zod, DLQ for failed messages, health checks |
| **WebSocket scalability (5K concurrent clients)** | Medium | Low | Use Redis pub/sub adapter (Socket.IO), horizontal scaling |
| **Asset health algorithm too slow** | Medium | Medium | Optimize algorithm, compute asynchronously, cache results |
| **UI configuration too complex for users** | Medium | High | User testing early, simplify forms, add tooltips, provide templates |
| **Cache invalidation issues** | Medium | Medium | Use Redis pub/sub for invalidation, test hot reload thoroughly |
| **Late discovery of gateway device formats** | High | Medium | Gather device specs early, prototype parsing, test with real data |
| **Data loss during deployment** | Critical | Low | Immutable telemetry_raw table, message queue persistence, blue/green deploy |

---

## Resource Requirements

### Infrastructure
- **Development**:
  - PostgreSQL 16 with TimescaleDB extension (8GB RAM, 100GB disk)
  - Redis 7 (4GB RAM, 20GB disk)
  - Docker Compose environment

- **Production** (for 10K msg/sec):
  - PostgreSQL 16 with TimescaleDB (16GB RAM, 500GB SSD)
  - Redis 7 (8GB RAM, 50GB disk)
  - 3-5 worker pods (2 CPU, 4GB RAM each)
  - API server (4 CPU, 8GB RAM)

### Team
- 1 Backend Engineer (API + Workers)
- 1 Frontend Engineer (UI)
- 0.5 DevOps Engineer (Infrastructure, monitoring)
- 0.5 QA Engineer (Testing, load testing)

---

## Dependencies & Blockers

### External Dependencies
- Mock app structure (completed ✅)
- Existing entity_edges table (completed ✅)
- Existing activities table (completed ✅)
- Redis availability (check docker-compose)
- TimescaleDB extension (check PostgreSQL version)

### Technical Blockers
- None identified at this time

### Open Questions
1. Is 10-week timeline acceptable? (vs 8-week MVP or 12-week production)
2. Should we start with HTTP or go straight to MQTT? (Recommendation: HTTP first)
3. What device types need to be supported initially? (Helps prioritize gateway work)
4. What telemetry volume is expected in first 3 months? (10 devices? 100? 1000?)
5. Are there real device data samples available for testing?

---

## Next Steps

1. **Review & Approve** this consolidated plan
2. **Answer open questions** (timeline, device types, volume expectations)
3. **Create Week 1 task breakdown** (Jira/Linear/GitHub Issues)
4. **Set up project tracking** (board, milestones, sprint planning)
5. **Prepare development environment** (docker-compose, database, tooling)
6. **Begin Phase 1, Week 1** implementation

---

## Document References

- [IoT_Platform_Architecture_Design.md](./IoT_Platform_Architecture_Design.md) - Full production architecture (12 weeks)
- [IoT_Architecture_Gap_Analysis.md](./IoT_Architecture_Gap_Analysis.md) - MVP approach (8 weeks)
- [Gateway_Complex_Telemetry_Architecture.md](./Gateway_Complex_Telemetry_Architecture.md) - Gateway device details
- [Dynamic_Device_Management_Architecture.md](./Dynamic_Device_Management_Architecture.md) - Configuration-driven processing
- [Asset_Type_Profile_Architecture.md](./Asset_Type_Profile_Architecture.md) - Asset processing configuration
- [Asset_Telemetry_Worker_Detailed.md](./Asset_Telemetry_Worker_Detailed.md) - Worker implementation details
- [Architecture_Mock_UI_Alignment.md](./Architecture_Mock_UI_Alignment.md) - UI alignment analysis
