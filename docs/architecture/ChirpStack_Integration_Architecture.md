# ChirpStack Integration Architecture

**Date**: 2026-01-29
**Decision**: Option A - ChirpStack MQTT Integration → EMQX
**Status**: Architecture Design

---

## Overview

ChirpStack (LoRaWAN Network Server) integrates with the IoT platform via MQTT, providing a unified ingestion path for both:
- **LoRa-based devices** (Location Hubs) → ChirpStack → EMQX
- **Cellular-based devices** (BLE Gateways) → EMQX directly

---

## Architecture Diagram

```mermaid
graph TB
    subgraph "Device Layer"
        LoRaDevice[LoRa Location Hub<br/>DevEUI: 0004A30B001B7AD2]
        CellularDevice[Cellular BLE Gateway<br/>Device UUID]
    end

    subgraph "Network Servers"
        LoRaGW[LoRa Gateway]
        CellularNet[Cellular Network]
        ChirpStack[ChirpStack LNS<br/>MQTT Integration]
    end

    subgraph "IoT Platform - Ingestion"
        EMQX[EMQX MQTT Broker<br/>Port 1883/8883]
        Bridge[IoT Bridge Service<br/>Payload Adapters]
    end

    subgraph "IoT Platform - Processing"
        NATS[NATS JetStream<br/>TELEMETRY Stream]
        Dispatcher[Raw Telemetry<br/>Dispatcher]
        Workers[Device Workers]
    end

    subgraph "Storage"
        DB[(PostgreSQL<br/>Device Mappings<br/>Telemetry)]
    end

    LoRaDevice -->|LoRaWAN| LoRaGW
    LoRaGW -->|UDP/MQTT| ChirpStack
    ChirpStack -->|MQTT Integration<br/>chirpstack/+/devices/+/up| EMQX

    CellularDevice -->|MQTT| CellularNet
    CellularNet -->|MQTT<br/>devices/{uuid}/telemetry| EMQX

    EMQX -->|Subscribe:<br/>chirpstack/+/devices/+/up<br/>devices/+/telemetry| Bridge

    Bridge -->|Transform & Enrich<br/>telemetry.raw.*| NATS
    NATS --> Dispatcher
    Dispatcher --> Workers
    Workers --> DB

    style ChirpStack fill:#e8f5e9
    style EMQX fill:#fff3e0
    style Bridge fill:#e1f5ff
    style NATS fill:#fce4ec
```

---

## MQTT Topic Structure

### Direct Device Topics (Cellular)
**Pattern**: `devices/{deviceUUID}/telemetry`

**Example**:
```
devices/550e8400-e29b-41d4-a716-446655440000/telemetry
```

**Payload** (canonical format):
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-29T10:00:00Z",
  "temp": 22.5,
  "humidity": 65.2
}
```

---

### ChirpStack Topics (LoRa)
**Pattern**: `chirpstack/{applicationId}/devices/{devEUI}/{event}`

**Events**:
- `up` - Uplink telemetry (most common)
- `join` - Device join (OTAA activation)
- `ack` - Downlink acknowledgment
- `txack` - Gateway transmission acknowledgment
- `log` - Device/gateway logs
- `status` - Device status
- `location` - GPS location (if available)

**Example Topics**:
```
chirpstack/app-001/devices/0004a30b001b7ad2/up
chirpstack/app-001/devices/0004a30b001b7ad2/join
chirpstack/app-001/devices/0004a30b001b7ad2/status
```

**ChirpStack Uplink Payload** (ChirpStack v4 format):
```json
{
  "deduplicationId": "063a5b0e-8e85-4a83-9a3d-7c32c7d16b7b",
  "time": "2026-01-29T10:00:00.123456Z",
  "deviceInfo": {
    "tenantId": "52f14cd4-c6f1-4fbd-8f87-4025e1d49242",
    "tenantName": "ChirpStack",
    "applicationId": "ca6b2c6a-0b7e-4a84-9d6c-3c7c37b3c3e0",
    "applicationName": "Indoor Tracking",
    "deviceProfileId": "0f92e602-b4e2-4f8a-8b0b-8e0f0d0e0e0e",
    "deviceProfileName": "Location Hub",
    "deviceName": "Location Hub 001",
    "devEui": "0004a30b001b7ad2",
    "tags": {
      "site": "warehouse-a",
      "zone": "receiving"
    }
  },
  "devAddr": "00bb8888",
  "adr": true,
  "dr": 5,
  "fCnt": 123,
  "fPort": 2,
  "confirmed": false,
  "data": "AQIDBAUGBwg=",  // Base64 encoded payload
  "object": {  // Decoded payload (if codec configured)
    "temperature": 22.5,
    "beacons": [
      {"id": "beacon-001", "rssi": -65},
      {"id": "beacon-002", "rssi": -72}
    ]
  },
  "rxInfo": [
    {
      "gatewayId": "0016c001f0000001",
      "uplinkId": 1234,
      "rssi": -45,
      "snr": 8.5,
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "altitude": 10
      }
    }
  ],
  "txInfo": {
    "frequency": 904300000,
    "modulation": "LORA",
    "loraModulationInfo": {
      "bandwidth": 125000,
      "spreadingFactor": 7,
      "codeRate": "CR_4_5"
    }
  }
}
```

---

## Payload Transformation

### ChirpStack Adapter (in IoT Bridge)

**Purpose**: Transform ChirpStack MQTT payloads to canonical telemetry format

**File**: `packages/iot-bridge/src/adapters/chirpstack-adapter.ts`

**Transformation Logic**:

```typescript
import type { Logger } from '../logger.js';

export interface ChirpStackUplink {
  deduplicationId: string;
  time: string;
  deviceInfo: {
    tenantId: string;
    applicationId: string;
    deviceName: string;
    devEui: string;
    tags?: Record<string, string>;
  };
  devAddr: string;
  fPort: number;
  fCnt: number;
  data: string; // Base64
  object?: Record<string, unknown>; // Decoded payload
  rxInfo?: Array<{
    gatewayId: string;
    rssi: number;
    snr: number;
    location?: {
      latitude: number;
      longitude: number;
      altitude: number;
    };
  }>;
}

export interface CanonicalTelemetry {
  deviceId: string;
  timestamp: string;
  payload: Record<string, unknown>;
  metadata: {
    source: 'chirpstack' | 'direct';
    devEui?: string;
    fPort?: number;
    fCnt?: number;
    rssi?: number;
    snr?: number;
    gatewayId?: string;
  };
}

/**
 * Transform ChirpStack uplink to canonical telemetry format
 */
export function transformChirpStackUplink(
  uplink: ChirpStackUplink,
  deviceMapping: Map<string, string>, // DevEUI → Device UUID
  logger: Logger
): CanonicalTelemetry | null {
  const devEui = uplink.deviceInfo.devEui;

  // 1. Look up device UUID from DevEUI
  const deviceId = deviceMapping.get(devEui);
  if (!deviceId) {
    logger.warn(
      { devEui, applicationId: uplink.deviceInfo.applicationId },
      'Device mapping not found for DevEUI'
    );
    return null;
  }

  // 2. Use decoded payload if available, otherwise log warning
  let payload: Record<string, unknown>;
  if (uplink.object) {
    payload = uplink.object;
  } else {
    logger.warn({ devEui, fPort: uplink.fPort }, 'No decoded payload, using raw data');
    payload = { data: uplink.data }; // Raw base64 data
  }

  // 3. Extract best RSSI/SNR from rxInfo
  const bestRx = uplink.rxInfo?.reduce((best, current) => {
    return (current.rssi > best.rssi) ? current : best;
  });

  // 4. Create canonical format
  return {
    deviceId,
    timestamp: uplink.time,
    payload,
    metadata: {
      source: 'chirpstack',
      devEui,
      fPort: uplink.fPort,
      fCnt: uplink.fCnt,
      rssi: bestRx?.rssi,
      snr: bestRx?.snr,
      gatewayId: bestRx?.gatewayId,
    },
  };
}
```

---

## Device Mapping (DevEUI → UUID)

### Database Schema Extension

**Add to `devices` table**:
```sql
-- Already exists: logical_identifier
-- Use this for DevEUI

ALTER TABLE devices
  ADD CONSTRAINT devices_dev_eui_unique
  UNIQUE (logical_identifier, tenant_id);

CREATE INDEX idx_devices_logical_identifier
  ON devices(logical_identifier)
  WHERE logical_identifier IS NOT NULL;
```

**Device Record for LoRa Device**:
```sql
INSERT INTO devices (
  id,
  tenant_id,
  device_type_id,
  name,
  device_role,
  protocol,
  logical_identifier,  -- Store DevEUI here
  network_metadata,
  created_by
) VALUES (
  gen_random_uuid(),
  '<tenant-id>',
  '<location-hub-type-id>',
  'Location Hub 001',
  'gateway',
  'lorawan',
  '0004a30b001b7ad2',  -- DevEUI
  jsonb_build_object(
    'chirpstack_application_id', 'ca6b2c6a-0b7e-4a84-9d6c-3c7c37b3c3e0',
    'chirpstack_device_profile_id', '0f92e602-b4e2-4f8a-8b0b-8e0f0d0e0e0e',
    'dev_addr', '00bb8888',
    'join_eui', '0000000000000000'
  ),
  '<admin-user-id>'
);
```

### Redis Cache for DevEUI → UUID Mapping

**Cache Key**: `devmapping:{devEui}` → `deviceUUID`

**Example**:
```
SET devmapping:0004a30b001b7ad2 550e8400-e29b-41d4-a716-446655440000
EXPIRE devmapping:0004a30b001b7ad2 3600  # 1 hour TTL
```

**Cache Population** (on bridge startup):
```typescript
// Load all LoRa devices into cache
const loraDevices = await db
  .select({ id: devices.id, devEui: devices.logicalIdentifier })
  .from(devices)
  .where(
    and(
      eq(devices.protocol, 'lorawan'),
      isNotNull(devices.logicalIdentifier)
    )
  );

for (const device of loraDevices) {
  await redis.set(`devmapping:${device.devEui}`, device.id, 'EX', 3600);
}
```

---

## IoT Bridge Updates

### Subscribe to ChirpStack Topics

**File**: `packages/iot-bridge/src/config.ts`

```typescript
const configSchema = z.object({
  mqtt: z.object({
    topics: z.array(z.string()).default([
      'devices/+/telemetry',           // Direct devices
      'chirpstack/+/devices/+/up',     // ChirpStack uplinks
      'chirpstack/+/devices/+/join',   // ChirpStack joins (optional)
    ]),
  }),
});
```

### Message Router

**File**: `packages/iot-bridge/src/bridge.ts`

```typescript
private async handleMqttMessage(message: MqttMessage): Promise<void> {
  this.metrics.messagesReceived++;
  this.metrics.bytesReceived += message.payload.length;

  // Route based on topic pattern
  if (message.topic.startsWith('chirpstack/')) {
    await this.handleChirpStackMessage(message);
  } else if (message.topic.startsWith('devices/')) {
    await this.handleDirectDeviceMessage(message);
  } else {
    this.logger.warn({ topic: message.topic }, 'Unknown topic pattern');
    this.metrics.messagesInvalid++;
  }
}

private async handleChirpStackMessage(message: MqttMessage): Promise<void> {
  // Parse ChirpStack payload
  let chirpstackUplink: ChirpStackUplink;
  try {
    chirpstackUplink = JSON.parse(message.payload.toString('utf-8'));
  } catch (error) {
    this.logger.error({ error, topic: message.topic }, 'Failed to parse ChirpStack payload');
    this.metrics.messagesInvalid++;
    return;
  }

  // Transform to canonical format
  const canonicalTelemetry = transformChirpStackUplink(
    chirpstackUplink,
    this.devEuiMapping, // Redis cache
    this.logger
  );

  if (!canonicalTelemetry) {
    this.metrics.messagesInvalid++;
    return; // Device not found
  }

  // Publish to NATS (same as direct devices)
  await this.publishToNats(canonicalTelemetry);
}
```

---

## ChirpStack Configuration

### MQTT Integration Setup

**In ChirpStack Web UI**:

1. Navigate to: **Applications → [Your App] → Integrations**
2. Click: **Add Integration → MQTT**
3. Configure:

**MQTT Integration Settings**:
```yaml
Server: tcp://emqx:1883  # Or use public IP/hostname
Username: chirpstack-integration  # Create in EMQX
Password: <secure-password>
QoS: 1
Topic Template: chirpstack/{{ application_id }}/devices/{{ dev_eui }}/{{ event }}
JSON Encoding: JSON (not Protobuf)
```

**Events to Forward**:
- ✅ Uplink
- ✅ Join
- ⚠️ Status (optional)
- ❌ Ack (not needed for telemetry)
- ❌ TxAck (not needed for telemetry)
- ❌ Log (too verbose)

### EMQX ACL Configuration

**Create ChirpStack User in EMQX**:
```bash
# Via EMQX Dashboard (Authentication → Built-in Database)
Username: chirpstack-integration
Password: <secure-password>
Permissions:
  - Subscribe: DENY (integration only publishes)
  - Publish: ALLOW chirpstack/#
```

**Topic ACL Rules**:
```
# ChirpStack can only publish to chirpstack/* topics
{
  "rules": [
    {
      "username": "chirpstack-integration",
      "permission": "allow",
      "action": "publish",
      "topic": "chirpstack/#"
    },
    {
      "username": "chirpstack-integration",
      "permission": "deny",
      "action": "subscribe",
      "topic": "#"
    }
  ]
}
```

---

## Security Considerations

### Topic Isolation

**Namespace Separation**:
- `devices/*` - Direct device telemetry
- `chirpstack/*` - ChirpStack integration events
- `commands/*` - Device commands (future)
- `admin/*` - Platform administration (future)

**ACL Enforcement**:
- ChirpStack user can ONLY publish to `chirpstack/*`
- Devices can ONLY publish to `devices/{their-uuid}/telemetry`
- Bridge subscribes to both namespaces

### Authentication

**ChirpStack → EMQX**:
- Username/password authentication
- mTLS optional (if ChirpStack supports it)
- Rate limiting: 1000 msg/sec per integration

**Devices → EMQX**:
- Cellular devices: mTLS (Week 2)
- LoRa devices: Authenticated via ChirpStack (device joins)

---

## FUOTA (Firmware Update Over The Air)

### Important: Keep Separate

**Gateway Backend MQTT** (LoRa gateways ↔ ChirpStack):
- Use ChirpStack's built-in gateway MQTT
- **DO NOT** use EMQX for gateway traffic
- Critical for downlink timing and FUOTA multicast

**Application MQTT** (ChirpStack ↔ IoT Platform):
- Use EMQX via integration
- Uplink telemetry only (read-only)

**Downlink Commands** (IoT Platform → Devices):
- Via ChirpStack gRPC/REST API (not MQTT)
- POST /api/devices/{devEUI}/queue

**Architecture**:
```
LoRa Gateways ←→ ChirpStack Gateway MQTT (separate broker)
ChirpStack → EMQX (application integration, uplink only)
IoT Platform → ChirpStack API (downlinks, FUOTA)
```

---

## Monitoring & Observability

### Metrics to Track

**ChirpStack Integration**:
- Uplinks received from ChirpStack
- Device mappings not found (DevEUI → UUID)
- Payload decode failures
- MQTT connection status (ChirpStack → EMQX)

**DevEUI Mapping Cache**:
- Cache hits vs misses
- Cache refresh rate
- Unknown DevEUIs (need to create devices)

**EMQX Topics**:
- Message rate on `chirpstack/#` topics
- Message rate on `devices/#` topics
- Topic-based message routing success rate

### Grafana Dashboard

**Panels**:
1. Ingestion Rate by Source (Direct vs ChirpStack)
2. ChirpStack Event Types (up, join, status)
3. DevEUI Mapping Cache Hit Rate
4. Unknown Devices (need provisioning)
5. EMQX Topic Message Rates

---

## Migration & Rollout

### Phase 1: ChirpStack MQTT Integration (Week 2)
- Configure ChirpStack MQTT integration → EMQX
- Deploy ChirpStack adapter in IoT Bridge
- Populate DevEUI → UUID mappings
- Test with 1-2 LoRa devices

### Phase 2: Device Provisioning Workflow (Week 3)
- Auto-create devices from unknown DevEUIs
- Admin UI for device mapping management
- Bulk import DevEUI → UUID mappings

### Phase 3: Full Rollout (Week 4)
- Enable all ChirpStack applications
- Monitor cache hit rates
- Optimize Redis cache TTLs

---

## Testing Strategy

### Unit Tests
- ChirpStack payload transformation
- DevEUI → UUID lookup (with cache)
- Topic routing logic

### Integration Tests
- ChirpStack MQTT → EMQX → Bridge → NATS
- Direct device MQTT → EMQX → Bridge → NATS
- Unknown DevEUI handling

### Load Tests
- 100 msg/sec ChirpStack uplinks
- Mixed traffic (50% ChirpStack, 50% direct)
- Cache performance under load

---

## Alternative: Option B (HTTP Integration)

**Why We Rejected It**:
1. Two separate ingestion stacks (MQTT + HTTP)
2. More infrastructure to build (webhook handler)
3. HTTP doesn't handle bursts as well as MQTT
4. More operational complexity

**When to Consider Option B**:
- If ChirpStack MQTT integration is unstable
- If you need immediate edge normalization (before EMQX)
- If you want complete decoupling from MQTT layer

---

## Related Documentation

- [IoT Platform Architecture Design](IoT_Platform_Architecture_Design.md)
- [IoT Bridge README](../IOT_BRIDGE_README.md)
- [Week 2 Implementation Plan](Week_2_Implementation_Plan.md)
- [ChirpStack v4 MQTT Integration Docs](https://www.chirpstack.io/docs/chirpstack/integrations/mqtt.html)

---

**Decision Date**: 2026-01-29
**Approved By**: Architecture Review
**Implementation**: Week 2 (W2-T1 updates)
