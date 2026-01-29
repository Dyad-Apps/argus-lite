/**
 * Telemetry Message Validator
 *
 * Validates incoming MQTT messages against expected schema.
 */

import { z } from 'zod';
import type { Logger } from './logger.js';

/**
 * Base telemetry message schema
 */
const telemetryMessageSchema = z.object({
  // Device identification
  deviceId: z.string().uuid().optional(),

  // Message metadata
  timestamp: z.string().optional(),
  correlationId: z.string().optional(),

  // For chunked messages
  seq: z.number().int().optional(),
  total: z.number().int().optional(),

  // Telemetry data (flexible - varies by device type)
  data: z.record(z.string(), z.unknown()).optional(),

  // Or flat structure
}).passthrough(); // Allow additional properties

export type TelemetryMessage = z.infer<typeof telemetryMessageSchema>;

/**
 * Validate telemetry message
 */
export function validateMessage(
  payload: unknown,
  logger: Logger
): TelemetryMessage | null {
  try {
    return telemetryMessageSchema.parse(payload);
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), payload },
      'Invalid telemetry message format'
    );
    return null;
  }
}

/**
 * Extract device ID from MQTT topic
 *
 * Topic format: devices/{deviceId}/telemetry
 */
export function extractDeviceIdFromTopic(topic: string): string | null {
  const match = topic.match(/^devices\/([^/]+)\/telemetry$/);
  return match ? match[1] : null;
}
