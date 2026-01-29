# Week 2 Implementation Plan: Telemetry Processing Pipeline

**Dates**: 2026-01-29 to 2026-02-04
**Focus**: Core Telemetry Processing Workers
**Total Estimated**: 64 hours (8 days × 8 hours)

---

## 📋 Overview

Week 2 builds the core telemetry processing pipeline that consumes messages from NATS JetStream (populated by the IoT Bridge in Week 1) and processes them into queryable telemetry in PostgreSQL.

**Architecture Flow**:
```
NATS TELEMETRY Stream (Week 1 ✅)
  ↓
Raw Telemetry Dispatcher (W2-T1)
  ↓ Routes by device type
[Endpoint Worker (W2-T3) | Gateway Worker (W2-T4) | Chunked Gateway Worker (W2-T5)]
  ↓ Processes & transforms
telemetry_raw → telemetry_history
  ↓
Asset Telemetry Worker (W2-T6)
  ↓ Computes health scores
Updates asset.health_score
```

---

## ✅ Prerequisites (Week 1 Complete)

- [x] Database schema with telemetry tables
- [x] EMQX MQTT broker operational
- [x] NATS JetStream with TELEMETRY stream
- [x] IoT Bridge publishing to NATS
- [x] Sample device/asset types seeded
- [x] End-to-end flow validated

---

## 🎯 Week 2 Goals

### Primary Goals (Critical Path):
1. ✅ **Telemetry Processing Pipeline Operational**
   - Raw messages routed by device type
   - Endpoint devices processed to telemetry_history
   - Gateway devices demultiplexed
   - Asset health scores computed

2. ✅ **Device Type Profile Caching**
   - Redis cache for processing configs (95% hit rate)
   - Cache invalidation on profile updates
   - Hot reload capability

3. ✅ **Testing & Validation**
   - End-to-end: MQTT → Bridge → Workers → Database
   - Performance: 100 msg/sec baseline
   - Health score computation accuracy

### Secondary Goals (Deferred from Week 1):
4. ⚠️ **Certificate Infrastructure** (mTLS)
   - EMQX SSL configuration
   - Device certificate generation
   - Can be done in parallel with workers

5. ⚠️ **HTTP Ingestion Endpoint**
   - Secondary protocol support
   - Can be done in parallel with workers

---

## 📝 Task Breakdown

### W2-T1: Raw Telemetry Dispatcher Worker (10h) - P0

**Priority**: P0 (Blocking - Routes all messages)
**Estimated**: 10 hours
**Dependencies**: Week 1 complete

#### Overview
Consumes raw telemetry from NATS TELEMETRY stream, looks up device type, and routes to appropriate processing stream based on `processing_mode`.

#### Subtasks

##### 1.1 Create Worker Package Structure (2h)
**Directory**: `packages/workers-telemetry/`

```
workers-telemetry/
├── src/
│   ├── dispatchers/
│   │   └── raw-telemetry-dispatcher.ts
│   ├── workers/
│   │   ├── endpoint-device-worker.ts
│   │   ├── gateway-device-worker.ts
│   │   ├── chunked-gateway-worker.ts
│   │   └── asset-telemetry-worker.ts
│   ├── services/
│   │   ├── device-profile-cache.ts
│   │   └── telemetry-processor.ts
│   ├── lib/
│   │   ├── nats-client.ts
│   │   ├── database.ts
│   │   ├── redis-client.ts
│   │   └── logger.ts
│   ├── types/
│   │   └── telemetry.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**Deliverables**:
- Package structure with TypeScript configuration
- Shared utilities (NATS, DB, Redis clients)
- Logger setup (Pino)
- Environment configuration (Zod)

##### 1.2 Implement Device Lookup Logic (3h)

**Database Query**:
```typescript
// Look up device and its type profile
const device = await db
  .select({
    id: devices.id,
    tenantId: devices.tenantId,
    deviceTypeId: devices.deviceTypeId,
    processingMode: deviceTypes.processingMode,
    protocolAdapter: deviceTypes.protocolAdapter,
    messageSchema: deviceTypes.messageSchema,
    extractionRules: deviceTypes.extractionRules,
  })
  .from(devices)
  .innerJoin(deviceTypes, eq(devices.deviceTypeId, deviceTypes.id))
  .where(eq(devices.id, deviceId))
  .limit(1);
```

**Error Handling**:
- Device not found → Log warning, write to telemetry_raw with error flag
- Invalid device type → Same as above
- Tenant mismatch → Security violation, log alert

**Deliverables**:
- Device lookup function with caching
- Error handling for missing devices
- Telemetry raw table population for audit trail

##### 1.3 Implement Message Routing (3h)

**Routing Logic**:
```typescript
switch (processingMode) {
  case 'endpoint':
    await publishToStream('TELEMETRY_ENDPOINT', deviceId, message);
    break;
  case 'gateway':
    await publishToStream('TELEMETRY_GATEWAY', deviceId, message);
    break;
  case 'gateway_chunked':
    await publishToStream('TELEMETRY_GATEWAY_CHUNKED', deviceId, message);
    break;
  case 'rtu_multiport':
    await publishToStream('TELEMETRY_RTU', deviceId, message);
    break;
  default:
    logger.error({ processingMode }, 'Unknown processing mode');
}
```

**NATS Stream Creation**:
- TELEMETRY_ENDPOINT (subject: `telemetry.endpoint.*`)
- TELEMETRY_GATEWAY (subject: `telemetry.gateway.*`)
- TELEMETRY_GATEWAY_CHUNKED (subject: `telemetry.gateway_chunked.*`)
- TELEMETRY_RTU (subject: `telemetry.rtu.*`)

**Deliverables**:
- Stream auto-creation logic
- Message routing by processing mode
- Metrics: routed, failed, unknown device

##### 1.4 Testing & Integration (2h)

**Tests**:
- Unit: Device lookup, routing logic
- Integration: NATS → Dispatcher → Routed streams
- Error cases: Unknown device, invalid processing mode

**Deliverables**:
- Test suite (Vitest)
- Integration test with NATS
- Performance test (1000 msg/sec routing)

---

### W2-T2: Device Type Profile Cache Worker (6h) - P0

**Priority**: P0 (Performance critical)
**Estimated**: 6 hours
**Dependencies**: W2-T1 device lookup

#### Overview
Maintains Redis cache of device type profiles to avoid database lookups on every message. Listens to cache invalidation events for hot reload.

#### Subtasks

##### 2.1 Implement Redis Cache Service (3h)

**Cache Key Structure**:
```
device:profile:{deviceId} → { deviceTypeId, processingMode, ... }
device-type:profile:{deviceTypeId} → { processingMode, messageSchema, extractionRules, ... }
```

**Cache TTL**: 1 hour (configurable)

**Functions**:
```typescript
async function getDeviceProfile(deviceId: string): Promise<DeviceProfile | null>
async function cacheDeviceProfile(deviceId: string, profile: DeviceProfile): Promise<void>
async function invalidateDeviceProfile(deviceId: string): Promise<void>
async function getDeviceTypeProfile(deviceTypeId: string): Promise<DeviceTypeProfile | null>
async function cacheDeviceTypeProfile(typeId: string, profile: DeviceTypeProfile): Promise<void>
```

**Deliverables**:
- Redis cache service implementation
- Cache hit/miss metrics
- TTL management

##### 2.2 Implement Cache Invalidation (2h)

**Redis Pub/Sub Channels**:
```
cache:invalidate:device:{deviceId}
cache:invalidate:device-type:{deviceTypeId}
cache:invalidate:all
```

**Invalidation Triggers**:
- Device updated (change device type, protocol, etc.)
- Device type updated (change processing mode, schema, etc.)
- Manual invalidation (admin action)

**Deliverables**:
- Pub/sub listener for cache invalidation
- Hot reload capability (no worker restart needed)
- API endpoint for manual invalidation

##### 2.3 Performance Testing (1h)

**Targets**:
- 95% cache hit rate under normal load
- < 1ms cache lookup latency (Redis)
- < 50ms database fallback latency

**Deliverables**:
- Performance benchmarks
- Cache hit rate monitoring
- Load test results

---

### W2-T3: Endpoint Device Worker (8h) - P0

**Priority**: P0 (Most common device type)
**Estimated**: 8 hours
**Dependencies**: W2-T1 dispatcher routing

#### Overview
Processes simple endpoint devices (temperature sensors, etc.). Parses message, extracts metrics using JSONPath, validates against schema, writes to telemetry_history.

#### Subtasks

##### 3.1 Implement Message Parsing (3h)

**Parser**:
```typescript
function parseEndpointMessage(
  message: RawMessage,
  schema: MessageSchema,
  extractionRules: ExtractionRules
): ParsedTelemetry[]
```

**Extraction Rules** (JSONPath):
```json
{
  "temperature": {
    "path": "$.temp",
    "type": "numeric",
    "unit": "celsius"
  },
  "humidity": {
    "path": "$.humidity",
    "type": "numeric",
    "unit": "percent"
  }
}
```

**Deliverables**:
- JSONPath extraction engine
- Type conversion (numeric, text, boolean, json)
- Schema validation with Zod
- Error handling for invalid payloads

##### 3.2 Write to telemetry_history (2h)

**Batch Insert**:
```typescript
await db.insert(telemetryHistory).values(
  metrics.map(metric => ({
    tenantId,
    entityId: deviceId,
    entityType: 'device',
    metricKey: metric.key,
    value: metric.value,
    unit: metric.unit,
    quality: metric.quality,
    timestamp: metric.timestamp,
    receivedAt: message.receivedAt,
    sourceDeviceId: deviceId,
    sourceMessageId: message.messageId,
    metadata: metric.metadata,
  }))
);
```

**Deliverables**:
- Batch insert logic (100 records per batch)
- Transaction handling
- Duplicate detection (message ID deduplication)

##### 3.3 Testing & Validation (3h)

**Test Cases**:
- Simple payload (temp/humidity)
- Complex nested payload
- Invalid payload (schema mismatch)
- Missing required fields
- Type conversion errors

**Deliverables**:
- Unit tests (message parsing)
- Integration tests (NATS → Worker → Database)
- Performance test (100 msg/sec processing)

---

### W2-T4: Gateway Device Worker (10h) - P1

**Priority**: P1 (Common for location tracking)
**Estimated**: 10 hours
**Dependencies**: W2-T3 endpoint worker (reuses parsing logic)

#### Overview
Processes gateway devices that multiplex data from multiple child devices (e.g., BLE beacons). Demultiplexes single MQTT message into multiple telemetry records.

#### Subtasks

##### 4.1 Implement Demultiplexing Logic (4h)

**Gateway Message Format**:
```json
{
  "gatewayId": "location-hub-001",
  "timestamp": "2026-01-29T10:00:00Z",
  "devices": [
    { "beaconId": "beacon-001", "rssi": -65, "battery": 85 },
    { "beaconId": "beacon-002", "rssi": -72, "battery": 90 },
    // ... up to 50 beacons
  ]
}
```

**Demultiplexing**:
```typescript
function demultiplexGatewayMessage(
  gatewayMessage: RawMessage,
  extractionRules: ExtractionRules
): DemultiplexedMessage[] {
  const childDevicesPath = extractionRules.childDevicesPath; // "$.devices"
  const childDeviceIdPath = extractionRules.childDeviceIdPath; // "$.beaconId"

  // Extract array of child devices
  const childDevices = jsonPath.query(gatewayMessage.payload, childDevicesPath);

  // Create individual messages for each child
  return childDevices.map(childDevice => ({
    deviceId: jsonPath.query(childDevice, childDeviceIdPath)[0],
    timestamp: gatewayMessage.timestamp,
    payload: childDevice,
    sourceGatewayId: gatewayMessage.deviceId,
  }));
}
```

**Deliverables**:
- Demultiplexing engine with JSONPath
- Child device ID extraction
- Timestamp inheritance from gateway
- Metadata tracking (source gateway ID)

##### 4.2 Child Device Lookup (2h)

**Database Query**:
```typescript
// Lookup child device by logical_identifier (beacon ID)
const childDevice = await db
  .select()
  .from(devices)
  .where(
    and(
      eq(devices.logicalIdentifier, beaconId),
      eq(devices.parentDeviceId, gatewayId),
      eq(devices.tenantId, tenantId)
    )
  )
  .limit(1);
```

**Auto-creation** (Optional):
```typescript
if (!childDevice && autoCreateChildDevices) {
  // Create child device with default device type
  childDevice = await createChildDevice({
    logicalIdentifier: beaconId,
    parentDeviceId: gatewayId,
    deviceTypeId: defaultBeaconTypeId,
    tenantId,
  });
}
```

**Deliverables**:
- Child device lookup with caching
- Optional auto-creation of unknown child devices
- Parent-child relationship validation

##### 4.3 Process Child Messages (2h)

**Processing**:
- Reuse endpoint worker parsing logic
- Write telemetry_history for each child device
- Track source gateway in metadata

**Deliverables**:
- Integration with endpoint parser
- Batch insert for all child metrics
- Gateway attribution in metadata

##### 4.4 Testing (2h)

**Test Cases**:
- Gateway with 10 beacons
- Gateway with 50 beacons (max capacity)
- Missing child devices (auto-create vs reject)
- Invalid gateway message format

**Deliverables**:
- Unit tests (demultiplexing logic)
- Integration tests (gateway → child telemetry)
- Performance test (50 child devices per message)

---

### W2-T5: Chunked Gateway Worker (12h) - P2

**Priority**: P2 (Specialized use case)
**Estimated**: 12 hours
**Dependencies**: W2-T4 gateway worker

#### Overview
Processes gateway devices that send chunked messages (split large payloads across multiple MQTT messages). Reassembles chunks before demultiplexing.

#### Subtasks

##### 5.1 Implement Chunk Collection (4h)

**Chunk Message Format**:
```json
{
  "correlationId": "msg-12345",
  "seq": 1,
  "total": 67,
  "timestamp": "2026-01-29T10:00:00Z",
  "data": { ... chunk 1 of 67 ... }
}
```

**Storage**: Use `telemetry_chunks` table (TTL: 60 seconds)

**Logic**:
```typescript
async function collectChunk(chunk: ChunkMessage): Promise<ReassembledMessage | null> {
  // Store chunk in telemetry_chunks
  await db.insert(telemetryChunks).values({
    tenantId,
    deviceId: chunk.deviceId,
    correlationId: chunk.correlationId,
    seq: chunk.seq,
    total: chunk.total,
    chunkData: chunk.data,
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + 60000), // 60s TTL
  });

  // Check if all chunks received
  const receivedChunks = await db
    .select()
    .from(telemetryChunks)
    .where(
      and(
        eq(telemetryChunks.correlationId, chunk.correlationId),
        eq(telemetryChunks.deviceId, chunk.deviceId)
      )
    );

  if (receivedChunks.length === chunk.total) {
    // Reassemble message
    return reassembleChunks(receivedChunks);
  }

  return null; // Waiting for more chunks
}
```

**Deliverables**:
- Chunk storage in telemetry_chunks table
- Chunk collection tracking (seq/total)
- TTL-based cleanup (PostgreSQL cron job or worker)

##### 5.2 Implement Chunk Reassembly (4h)

**Reassembly Logic**:
```typescript
function reassembleChunks(chunks: TelemetryChunk[]): ReassembledMessage {
  // Sort by sequence number
  const sortedChunks = chunks.sort((a, b) => a.seq - b.seq);

  // Validate sequence numbers (1, 2, 3, ..., total)
  for (let i = 0; i < sortedChunks.length; i++) {
    if (sortedChunks[i].seq !== i + 1) {
      throw new Error(`Missing chunk ${i + 1}`);
    }
  }

  // Concatenate chunk data
  const reassembledData = sortedChunks.reduce((acc, chunk) => {
    return { ...acc, ...chunk.chunkData };
  }, {});

  return {
    deviceId: chunks[0].deviceId,
    correlationId: chunks[0].correlationId,
    timestamp: chunks[0].timestamp,
    payload: reassembledData,
    chunkCount: chunks.length,
  };
}
```

**Deliverables**:
- Chunk sorting and validation
- Data concatenation (merge objects)
- Error handling (missing chunks, out-of-order)

##### 5.3 Process Reassembled Message (2h)

**Processing**:
- Pass reassembled message to gateway worker (demultiplex)
- Store transaction in telemetry_transactions table
- Clean up chunks from telemetry_chunks

**Deliverables**:
- Integration with gateway worker
- Transaction tracking (correlation ID, chunk count, status)
- Chunk cleanup after successful processing

##### 5.4 Timeout Handling (2h)

**Timeout Logic**:
- Run periodic job (every 30 seconds)
- Find incomplete chunk groups > 60 seconds old
- Mark as failed in telemetry_transactions
- Clean up expired chunks

**Deliverables**:
- Timeout detection worker
- Failed transaction tracking
- Alerting for high failure rates

---

### W2-T6: Asset Telemetry Worker (10h) - P0

**Priority**: P0 (Business logic critical)
**Estimated**: 10 hours
**Dependencies**: W2-T3 endpoint worker writing telemetry_history

#### Overview
Consumes device telemetry from `telemetry_history`, aggregates by asset, computes asset health scores, and updates `assets` table.

#### Subtasks

##### 6.1 Implement Asset Metric Aggregation (4h)

**Query Latest Telemetry**:
```typescript
// Get latest telemetry for all devices assigned to an asset
const deviceTelemetry = await db
  .select({
    deviceId: telemetryHistory.entityId,
    metricKey: telemetryHistory.metricKey,
    value: telemetryHistory.value,
    timestamp: telemetryHistory.timestamp,
  })
  .from(telemetryHistory)
  .innerJoin(devices, eq(telemetryHistory.entityId, devices.id))
  .where(
    and(
      eq(devices.assignedAssetId, assetId),
      eq(telemetryHistory.entityType, 'device'),
      gt(telemetryHistory.timestamp, lastProcessedTimestamp)
    )
  )
  .orderBy(desc(telemetryHistory.timestamp));
```

**Aggregation**:
- Group by metric key
- Calculate: min, max, avg, latest, count
- Time window: last 15 minutes (configurable)

**Deliverables**:
- Metric aggregation engine
- Configurable time windows
- Support for multiple aggregation functions

##### 6.2 Implement Health Score Computation (4h)

**Health Algorithm** (from asset_types.health_algorithm):

**Weighted Average**:
```typescript
function computeWeightedHealth(
  metrics: AggregatedMetrics,
  weights: HealthWeights
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [metricKey, metricValue] of Object.entries(metrics)) {
    const weight = weights[metricKey] || 0;
    const normalizedValue = normalizeMetric(metricKey, metricValue);

    weightedSum += normalizedValue * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
}
```

**Threshold-based**:
```typescript
function computeThresholdHealth(
  metrics: AggregatedMetrics,
  thresholds: HealthThresholds
): number {
  let failedChecks = 0;
  let totalChecks = 0;

  for (const [metricKey, metricValue] of Object.entries(metrics)) {
    const threshold = thresholds[metricKey];
    if (!threshold) continue;

    totalChecks++;
    if (metricValue < threshold.min || metricValue > threshold.max) {
      failedChecks++;
    }
  }

  return totalChecks > 0 ? ((totalChecks - failedChecks) / totalChecks) * 100 : 100;
}
```

**Deliverables**:
- Health computation engine (pluggable algorithms)
- Support for weighted average and threshold-based
- Metric normalization functions

##### 6.3 Update Asset Health (2h)

**Database Update**:
```typescript
await db
  .update(assets)
  .set({
    healthScore: computedHealth,
    healthScoreUpdatedAt: new Date(),
    healthScoreComputedBy: 'asset-telemetry-worker',
    lastTelemetryAt: latestTelemetryTimestamp,
  })
  .where(eq(assets.id, assetId));
```

**Write Asset Telemetry History**:
```typescript
await db.insert(telemetryHistory).values({
  tenantId,
  entityId: assetId,
  entityType: 'asset',
  metricKey: 'health_score',
  value: computedHealth,
  unit: 'percent',
  quality: 'good',
  timestamp: new Date(),
  metadata: {
    deviceCount: deviceMetrics.length,
    algorithm: assetType.healthAlgorithm,
    metrics: aggregatedMetrics,
  },
});
```

**Deliverables**:
- Asset update logic
- Historical health score tracking
- Metadata for audit trail

---

### W2-T7: Certificate Infrastructure (mTLS) (8h) - P1

**Priority**: P1 (Deferred from Week 1)
**Estimated**: 8 hours
**Dependencies**: None (can run in parallel)

#### Subtasks

##### 7.1 Create Certificate Generation Script (3h)

**File**: `scripts/generate-certs.sh`

**Certificate Types**:
1. CA Certificate (self-signed, 10 years)
2. EMQX Server Certificate (signed by CA, 1 year)
3. Device Client Certificates (signed by CA, 1 year)

**Script**:
```bash
#!/bin/bash
set -e

CERTS_DIR="./certs"
mkdir -p "$CERTS_DIR"

# Generate CA
openssl genrsa -out "$CERTS_DIR/ca.key" 4096
openssl req -new -x509 -days 3650 \
  -key "$CERTS_DIR/ca.key" \
  -out "$CERTS_DIR/ca.crt" \
  -subj "/C=US/ST=State/L=City/O=ArgusIQ/OU=IoT/CN=ArgusIQ CA"

# Generate EMQX Server Certificate
openssl genrsa -out "$CERTS_DIR/server.key" 2048
openssl req -new \
  -key "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.csr" \
  -subj "/C=US/ST=State/L=City/O=ArgusIQ/OU=IoT/CN=localhost"
openssl x509 -req -days 365 \
  -in "$CERTS_DIR/server.csr" \
  -CA "$CERTS_DIR/ca.crt" \
  -CAkey "$CERTS_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERTS_DIR/server.crt"

# Generate Device Client Certificate
openssl genrsa -out "$CERTS_DIR/device-001.key" 2048
openssl req -new \
  -key "$CERTS_DIR/device-001.key" \
  -out "$CERTS_DIR/device-001.csr" \
  -subj "/C=US/ST=State/L=City/O=ArgusIQ/OU=IoT/CN=device-001"
openssl x509 -req -days 365 \
  -in "$CERTS_DIR/device-001.csr" \
  -CA "$CERTS_DIR/ca.crt" \
  -CAkey "$CERTS_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERTS_DIR/device-001.crt"

echo "✅ Certificates generated in $CERTS_DIR/"
```

**Deliverables**:
- Certificate generation script
- CA, server, and device certificates
- Documentation for certificate lifecycle

##### 7.2 Configure EMQX SSL Listener (3h)

**EMQX Configuration** (docker-compose.yml):
```yaml
emqx:
  image: emqx/emqx:5.8.3
  volumes:
    - ./certs:/opt/emqx/etc/certs:ro
    - ./iot/emqx/config/ssl.conf:/opt/emqx/etc/emqx.conf:ro
  environment:
    - EMQX_LISTENERS__SSL__DEFAULT__BIND=0.0.0.0:8883
    - EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__CACERTFILE=/opt/emqx/etc/certs/ca.crt
    - EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__CERTFILE=/opt/emqx/etc/certs/server.crt
    - EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__KEYFILE=/opt/emqx/etc/certs/server.key
    - EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__VERIFY=verify_peer
    - EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__FAIL_IF_NO_PEER_CERT=true
```

**Deliverables**:
- EMQX SSL configuration
- Docker volume mount for certificates
- Verification of client certificate requirement

##### 7.3 Testing (2h)

**Test Cases**:
- Connect with valid client certificate ✅
- Connect without certificate ❌
- Connect with expired certificate ❌
- Connect with invalid CA certificate ❌

**Test Command**:
```bash
mosquitto_pub \
  -h localhost \
  -p 8883 \
  --cafile certs/ca.crt \
  --cert certs/device-001.crt \
  --key certs/device-001.key \
  -t "devices/test-device-001/telemetry" \
  -m '{"temp":22.5}'
```

**Deliverables**:
- Test script for mTLS
- Documentation in IOT_BRIDGE_README.md
- Certificate renewal procedure

---

### W2-T8: HTTP Ingestion Endpoint (6h) - P2

**Priority**: P2 (Deferred from Week 1)
**Estimated**: 6 hours
**Dependencies**: W2-T1 (shares NATS publishing)

#### Subtasks

##### 8.1 Implement HTTP Endpoint (3h)

**Endpoint**: `POST /api/v1/telemetry`

**Authentication**: API Key in header
```
Authorization: Bearer <device-api-key>
```

**Request Body**:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-29T10:00:00Z",
  "metrics": {
    "temperature": 22.5,
    "humidity": 65.2
  }
}
```

**Implementation**:
```typescript
// packages/api/src/routes/telemetry/ingest.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { publishToNats } from '../../lib/nats-publisher';

export async function ingestTelemetry(
  req: FastifyRequest<{ Body: TelemetryIngestRequest }>,
  reply: FastifyReply
) {
  // 1. Authenticate device (API key)
  const device = await authenticateDevice(req.headers.authorization);
  if (!device) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  // 2. Validate payload
  const validatedPayload = telemetryIngestSchema.parse(req.body);

  // 3. Normalize to MQTT message format
  const normalizedMessage = {
    deviceId: validatedPayload.deviceId,
    timestamp: validatedPayload.timestamp || new Date().toISOString(),
    ...validatedPayload.metrics,
  };

  // 4. Publish to NATS (same as MQTT bridge)
  await publishToNats('telemetry.raw', device.id, normalizedMessage, {
    'ingestion-protocol': 'http',
    'device-id': device.id,
    'received-at': new Date().toISOString(),
  });

  return reply.code(202).send({ status: 'accepted' });
}
```

**Deliverables**:
- HTTP endpoint implementation
- Device authentication (API key lookup)
- Payload validation
- NATS publishing

##### 8.2 Rate Limiting (2h)

**Rate Limit**: 100 requests/minute per device

**Implementation** (Redis):
```typescript
async function checkRateLimit(deviceId: string): Promise<boolean> {
  const key = `ratelimit:telemetry:${deviceId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  return count <= 100;
}
```

**Deliverables**:
- Rate limiting middleware
- Redis-based token bucket
- 429 Too Many Requests response

##### 8.3 Testing (1h)

**Test Cases**:
- Valid request with API key
- Invalid API key
- Missing required fields
- Rate limit exceeded
- End-to-end: HTTP → NATS → Database

**Deliverables**:
- API tests (Vitest)
- Integration tests
- OpenAPI documentation

---

### W2-T9: Integration Testing & Performance (8h) - P0

**Priority**: P0 (Validation)
**Estimated**: 8 hours
**Dependencies**: All workers complete

#### Subtasks

##### 9.1 End-to-End Testing (4h)

**Test Flows**:
1. **Endpoint Device Flow**:
   - MQTT → Bridge → TELEMETRY → Dispatcher → TELEMETRY_ENDPOINT → Endpoint Worker → telemetry_history
   - Validate: Correct metric extraction, device ID, timestamp

2. **Gateway Device Flow**:
   - MQTT → Bridge → TELEMETRY → Dispatcher → TELEMETRY_GATEWAY → Gateway Worker → Demultiplex → telemetry_history (multiple rows)
   - Validate: Child device creation, parent attribution

3. **Chunked Gateway Flow**:
   - MQTT (67 chunks) → Bridge → TELEMETRY → Dispatcher → TELEMETRY_GATEWAY_CHUNKED → Chunked Worker → Reassemble → Gateway Worker → telemetry_history
   - Validate: Chunk collection, reassembly, demultiplexing

4. **Asset Health Flow**:
   - Device telemetry → Asset Worker → Asset health score updated
   - Validate: Health score computation, asset.health_score updated

**Deliverables**:
- Comprehensive E2E test suite
- Test fixtures (sample messages)
- Validation assertions

##### 9.2 Performance Testing (4h)

**Targets**:
- 100 msg/sec sustained throughput
- < 500ms p99 latency (MQTT → Database)
- < 50ms p99 cache lookup latency
- 95% cache hit rate
- Zero message loss under normal load

**Load Test**:
```bash
# Generate 1000 messages at 100 msg/sec
for i in {1..1000}; do
  mosquitto_pub -h localhost -p 1883 \
    -t "devices/device-$((i % 10))/telemetry" \
    -m "{\"temp\":$((20 + RANDOM % 10)),\"ts\":\"$(date -Iseconds)\"}"
  sleep 0.01 # 100 msg/sec
done
```

**Metrics to Collect**:
- NATS stream lag
- Worker processing rate (msg/sec)
- Database insert rate (rows/sec)
- Redis cache hit rate
- P50, P95, P99 latencies

**Deliverables**:
- Load testing scripts
- Performance benchmarks
- Grafana dashboards for monitoring

---

## 📊 Week 2 Summary

### Task Breakdown:
| Task | Priority | Hours | Dependencies |
|------|----------|-------|--------------|
| W2-T1: Raw Telemetry Dispatcher | P0 | 10h | Week 1 |
| W2-T2: Device Profile Cache | P0 | 6h | W2-T1 |
| W2-T3: Endpoint Worker | P0 | 8h | W2-T1 |
| W2-T4: Gateway Worker | P1 | 10h | W2-T3 |
| W2-T5: Chunked Gateway Worker | P2 | 12h | W2-T4 |
| W2-T6: Asset Telemetry Worker | P0 | 10h | W2-T3 |
| W2-T7: Certificate Infrastructure | P1 | 8h | None |
| W2-T8: HTTP Ingestion | P2 | 6h | W2-T1 |
| W2-T9: Testing & Performance | P0 | 8h | All |
| **Total** | | **78h** | |

### Critical Path (P0 tasks):
1. W2-T1: Dispatcher (10h)
2. W2-T2: Cache (6h)
3. W2-T3: Endpoint Worker (8h)
4. W2-T6: Asset Worker (10h)
5. W2-T9: Testing (8h)
**Total Critical: 42 hours**

### Parallel Track (P1/P2 tasks):
- W2-T4: Gateway Worker (10h)
- W2-T5: Chunked Gateway Worker (12h)
- W2-T7: Certificate Infrastructure (8h)
- W2-T8: HTTP Ingestion (6h)
**Total Parallel: 36 hours**

### Recommended Schedule:

**Days 1-2 (16h)**: Core Infrastructure
- W2-T1: Dispatcher (10h)
- W2-T2: Cache (6h)

**Days 3-4 (16h)**: Endpoint Processing
- W2-T3: Endpoint Worker (8h)
- W2-T6: Asset Worker (10h) - start in parallel

**Days 5-6 (16h)**: Gateway Processing
- W2-T4: Gateway Worker (10h)
- W2-T7: Certificate Infrastructure (8h) - parallel

**Days 7-8 (16h)**: Advanced & Testing
- W2-T5: Chunked Gateway Worker (12h)
- W2-T8: HTTP Ingestion (6h) - parallel
- W2-T9: Testing (8h)

**Total: 64 hours over 8 days**

---

## 🎯 Week 2 Success Criteria

- [ ] Raw telemetry dispatcher routing messages by device type
- [ ] Device profile caching operational (95% hit rate)
- [ ] Endpoint devices processed to telemetry_history
- [ ] Gateway devices demultiplexed successfully
- [ ] Chunked gateway messages reassembled
- [ ] Asset health scores computed and updated
- [ ] mTLS authentication configured (port 8883)
- [ ] HTTP ingestion endpoint functional
- [ ] End-to-end tests passing
- [ ] Performance: 100 msg/sec sustained throughput
- [ ] Performance: < 500ms p99 latency
- [ ] Cache: 95% hit rate
- [ ] Zero message loss under normal load

---

## 📚 Documentation Deliverables

1. **TELEMETRY_WORKERS_README.md** - Worker architecture and operations
2. **PERFORMANCE_BENCHMARKS.md** - Load test results and optimization tips
3. **CERTIFICATE_MANAGEMENT.md** - mTLS setup and certificate lifecycle
4. **API_TELEMETRY_INGESTION.md** - HTTP endpoint documentation
5. **Week 2 Progress Report** - Daily updates and final summary

---

## 🚀 Post-Week 2 Readiness

### ✅ After Week 2:
- Full telemetry processing pipeline operational
- Device-to-database flow complete
- Asset health monitoring functional
- Performance validated at 100 msg/sec
- Security hardened with mTLS
- HTTP fallback protocol available

### ⚠️ Still Needed (Week 3+):
- Alerting system (threshold violations)
- Real-time UI updates (WebSocket)
- Advanced analytics (aggregations, trends)
- Device provisioning workflow
- High availability (NATS cluster, worker scaling)

---

**Last Updated**: 2026-01-28
**Start Date**: 2026-01-29
**Target Completion**: 2026-02-04
