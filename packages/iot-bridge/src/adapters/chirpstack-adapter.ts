/**
 * ChirpStack Uplink Adapter
 *
 * Transforms ChirpStack uplink messages (from MQTT integration) into the canonical
 * telemetry format used by the ArgusIQ platform.
 *
 * ChirpStack sends messages on topics like:
 *   chirpstack/{applicationId}/devices/{devEui}/up
 *
 * This adapter:
 * 1. Extracts the DevEUI from the ChirpStack payload
 * 2. Looks up the corresponding Device UUID (via mapping cache)
 * 3. Transforms the payload into canonical format
 * 4. Enriches with LoRa metadata (RSSI, SNR, gateway info)
 */

import type { Logger } from 'pino';

/**
 * ChirpStack uplink message structure (MQTT integration payload)
 * Based on ChirpStack v4 MQTT integration format
 */
export interface ChirpStackUplink {
  // Device information
  deviceInfo: {
    tenantId: string;
    tenantName: string;
    applicationId: string;
    applicationName: string;
    deviceProfileId: string;
    deviceProfileName: string;
    deviceName: string;
    devEui: string; // LoRaWAN Device EUI (16 hex chars)
  };

  // LoRaWAN frame info
  devAddr: string;
  adr: boolean;
  dr: number; // Data rate
  fCnt: number; // Frame counter (uplink)
  fPort: number; // LoRaWAN port (1-223)
  confirmed: boolean;
  data: string; // Base64 encoded raw payload

  // Decoded payload (if codec configured in ChirpStack)
  object?: Record<string, unknown>;

  // Reception info from gateways
  rxInfo?: Array<{
    gatewayId: string;
    uplinkId: string;
    time?: string;
    timeSinceGpsEpoch?: string;
    rssi: number; // Received Signal Strength Indicator
    snr: number; // Signal-to-Noise Ratio
    channel: number;
    rfChain: number;
    board: number;
    antenna: number;
    location?: {
      latitude: number;
      longitude: number;
      altitude: number;
      source: string;
    };
    context: string; // Base64 encoded
    metadata?: Record<string, string>;
    crcStatus: string;
  }>;

  // Transmission info
  txInfo?: {
    frequency: number;
    modulation: {
      lora?: {
        bandwidth: number;
        spreadingFactor: number;
        codeRate: string;
      };
    };
  };

  // Timing
  time: string; // ISO 8601 timestamp
}

/**
 * Canonical telemetry format (internal platform format)
 */
export interface CanonicalTelemetry {
  deviceId: string; // ArgusIQ Device UUID
  timestamp: string; // ISO 8601
  payload: Record<string, unknown>;
  metadata: {
    source: 'chirpstack' | 'direct';
    devEui?: string; // Original LoRa DevEUI
    fPort?: number;
    fCnt?: number;
    rssi?: number;
    snr?: number;
    gatewayId?: string;
    dataRate?: number;
    frequency?: number;
    [key: string]: unknown;
  };
}

/**
 * Transforms a ChirpStack uplink message into canonical telemetry format
 *
 * @param uplink - ChirpStack uplink message from MQTT
 * @param deviceMapping - Map of DevEUI -> Device UUID (from cache)
 * @param logger - Pino logger instance
 * @returns Canonical telemetry message, or null if device mapping not found
 */
export function transformChirpStackUplink(
  uplink: ChirpStackUplink,
  deviceMapping: Map<string, string>,
  logger: Logger
): CanonicalTelemetry | null {
  const devEui = uplink.deviceInfo.devEui;

  // 1. Look up device UUID from DevEUI
  const deviceId = deviceMapping.get(devEui);
  if (!deviceId) {
    logger.warn(
      {
        devEui,
        applicationId: uplink.deviceInfo.applicationId,
        deviceName: uplink.deviceInfo.deviceName
      },
      'Device mapping not found for DevEUI - device may not be provisioned in ArgusIQ'
    );
    return null;
  }

  // 2. Use decoded payload if available (preferred), otherwise use raw data
  let payload: Record<string, unknown>;
  if (uplink.object && Object.keys(uplink.object).length > 0) {
    // ChirpStack codec decoded the payload
    payload = uplink.object;
  } else {
    // No decoder configured, include raw base64 data
    payload = {
      data: uplink.data,
      fPort: uplink.fPort,
    };
  }

  // 3. Extract best RSSI/SNR from rxInfo (find gateway with strongest signal)
  let bestRx = uplink.rxInfo?.[0];
  if (uplink.rxInfo && uplink.rxInfo.length > 1) {
    bestRx = uplink.rxInfo.reduce((best, current) => {
      return (current.rssi > best.rssi) ? current : best;
    });
  }

  // 4. Create canonical telemetry message
  const canonical: CanonicalTelemetry = {
    deviceId,
    timestamp: uplink.time,
    payload,
    metadata: {
      source: 'chirpstack',
      devEui,
      fPort: uplink.fPort,
      fCnt: uplink.fCnt,
      dataRate: uplink.dr,
      rssi: bestRx?.rssi,
      snr: bestRx?.snr,
      gatewayId: bestRx?.gatewayId,
      frequency: uplink.txInfo?.frequency,
      applicationId: uplink.deviceInfo.applicationId,
      deviceName: uplink.deviceInfo.deviceName,
    },
  };

  logger.debug(
    {
      devEui,
      deviceId,
      fPort: uplink.fPort,
      fCnt: uplink.fCnt,
      hasDecoded: !!uplink.object,
      rssi: bestRx?.rssi,
    },
    'Transformed ChirpStack uplink to canonical format'
  );

  return canonical;
}

/**
 * Converts MQTT wildcard pattern to RegExp
 *
 * MQTT wildcards:
 * - + matches single level (e.g., "application/+/device" matches "application/abc/device")
 * - # matches multiple levels (e.g., "application/#" matches "application/abc/device/xyz")
 *
 * @param pattern - MQTT topic pattern with wildcards
 * @returns RegExp that matches the pattern
 */
export function mqttPatternToRegex(pattern: string): RegExp {
  // Escape special regex chars except + and #
  let regexPattern = pattern
    .replace(/[.?*()[\]{}|\\^$]/g, '\\$&')
    // Replace + with single-level match (anything except /)
    .replace(/\+/g, '[^/]+')
    // Replace # with multi-level match (anything including /)
    .replace(/#/g, '.+');

  return new RegExp(`^${regexPattern}$`);
}

/**
 * Validates if a topic matches a ChirpStack uplink pattern
 *
 * @param topic - MQTT topic to check
 * @param topicPattern - ChirpStack MQTT topic pattern (with wildcards)
 * @returns true if topic matches the pattern
 */
export function isChirpStackTopic(topic: string, topicPattern?: string): boolean {
  if (!topicPattern) {
    // Fallback: check common patterns
    return (
      topic.includes('chirpstack') ||
      topic.includes('application') ||
      (topic.includes('device') && topic.includes('event'))
    );
  }

  const regex = mqttPatternToRegex(topicPattern);
  return regex.test(topic);
}

/**
 * Extracts application ID from ChirpStack MQTT topic (flexible)
 *
 * Tries to extract application ID from various common patterns:
 * - application/{appId}/device/{devEui}/event/up
 * - chirpstack/{appId}/devices/{devEui}/up
 * - v3/{appId}/devices/{devEui}/rx
 *
 * @param topic - MQTT topic
 * @returns Application ID or null
 */
export function extractApplicationIdFromTopic(topic: string): string | null {
  // Try various patterns
  const patterns = [
    /^application\/([^/]+)\/device\//,     // application/{appId}/device/...
    /^chirpstack\/([^/]+)\/devices\//,     // chirpstack/{appId}/devices/...
    /^v3\/([^/]+)\/devices\//,             // v3/{appId}/devices/...
  ];

  for (const pattern of patterns) {
    const match = topic.match(pattern);
    if (match) return match[1];
  }

  return null;
}
