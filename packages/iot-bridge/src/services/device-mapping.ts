/**
 * Device Mapping Service
 *
 * Manages the mapping between LoRaWAN DevEUI and ArgusIQ Device UUIDs.
 * ChirpStack sends messages with DevEUI, but our internal processing needs Device UUIDs.
 *
 * This service:
 * 1. Loads LoRa device mappings from the database on startup
 * 2. Maintains an in-memory cache (Map) for fast lookups
 * 3. Provides methods to refresh the cache
 * 4. TODO: Will integrate with Redis for distributed caching in production
 */

import type { Logger } from 'pino';

export interface DeviceMapping {
  deviceId: string; // ArgusIQ Device UUID
  devEui: string; // LoRaWAN Device EUI (16 hex chars)
  tenantId: string;
  deviceName?: string;
  protocol: string;
}

export interface DeviceMappingConfig {
  refreshIntervalMs?: number; // Auto-refresh interval (default: disabled)
  enableRedis?: boolean; // Use Redis cache (default: false, in-memory only)
}

/**
 * Device Mapping Service
 *
 * In-memory cache of DevEUI -> Device UUID mappings for ChirpStack integration.
 * Future: Will add Redis layer for distributed caching.
 */
export class DeviceMappingService {
  private mappings: Map<string, DeviceMapping> = new Map();
  private refreshTimer?: NodeJS.Timeout;
  private lastRefresh?: Date;

  constructor(
    private config: DeviceMappingConfig,
    private logger: Logger
  ) {}

  /**
   * Initialize the service and load mappings from database
   */
  async initialize(loadFn: () => Promise<DeviceMapping[]>): Promise<void> {
    this.logger.info('Initializing device mapping service...');

    await this.refresh(loadFn);

    // Set up auto-refresh if configured
    if (this.config.refreshIntervalMs && this.config.refreshIntervalMs > 0) {
      this.refreshTimer = setInterval(
        () => this.refresh(loadFn),
        this.config.refreshIntervalMs
      );
      this.logger.info(
        { intervalMs: this.config.refreshIntervalMs },
        'Device mapping auto-refresh enabled'
      );
    }
  }

  /**
   * Refresh mappings from database
   */
  async refresh(loadFn: () => Promise<DeviceMapping[]>): Promise<void> {
    try {
      const startTime = Date.now();
      const mappings = await loadFn();

      // Clear and rebuild the map
      this.mappings.clear();
      for (const mapping of mappings) {
        // Normalize DevEUI to lowercase for case-insensitive lookup
        const devEui = mapping.devEui.toLowerCase();
        this.mappings.set(devEui, { ...mapping, devEui });
      }

      this.lastRefresh = new Date();
      const duration = Date.now() - startTime;

      this.logger.info(
        {
          count: this.mappings.size,
          durationMs: duration,
          lastRefresh: this.lastRefresh.toISOString(),
        },
        'Device mappings refreshed from database'
      );
    } catch (error) {
      this.logger.error(
        { error },
        'Failed to refresh device mappings from database'
      );
      throw error;
    }
  }

  /**
   * Look up Device UUID by DevEUI
   *
   * @param devEui - LoRaWAN Device EUI (16 hex chars, case-insensitive)
   * @returns Device UUID or null if not found
   */
  getDeviceId(devEui: string): string | null {
    const normalized = devEui.toLowerCase();
    const mapping = this.mappings.get(normalized);
    return mapping?.deviceId || null;
  }

  /**
   * Look up full device mapping by DevEUI
   *
   * @param devEui - LoRaWAN Device EUI
   * @returns Full device mapping or null
   */
  getMapping(devEui: string): DeviceMapping | null {
    const normalized = devEui.toLowerCase();
    return this.mappings.get(normalized) || null;
  }

  /**
   * Get the internal mapping cache for adapter use
   *
   * @returns Map of DevEUI -> Device UUID
   */
  getMappingCache(): Map<string, string> {
    const cache = new Map<string, string>();
    for (const [devEui, mapping] of this.mappings.entries()) {
      cache.set(devEui, mapping.deviceId);
    }
    return cache;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.mappings.size,
      lastRefresh: this.lastRefresh?.toISOString() || null,
      refreshEnabled: !!this.refreshTimer,
    };
  }

  /**
   * Add or update a single device mapping (for dynamic provisioning)
   *
   * @param mapping - Device mapping to add/update
   */
  addMapping(mapping: DeviceMapping): void {
    const devEui = mapping.devEui.toLowerCase();
    this.mappings.set(devEui, { ...mapping, devEui });
    this.logger.debug({ devEui, deviceId: mapping.deviceId }, 'Device mapping added');
  }

  /**
   * Remove a device mapping
   *
   * @param devEui - DevEUI to remove
   */
  removeMapping(devEui: string): void {
    const normalized = devEui.toLowerCase();
    this.mappings.delete(normalized);
    this.logger.debug({ devEui: normalized }, 'Device mapping removed');
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.mappings.clear();
    this.logger.info('Device mapping service closed');
  }
}

/**
 * Factory function to create a database loader for device mappings
 *
 * This is a placeholder - actual implementation will use Drizzle ORM to query the database.
 * For now, this shows the expected interface.
 *
 * @returns Function that loads device mappings from database
 */
export function createDatabaseLoader(): () => Promise<DeviceMapping[]> {
  return async () => {
    // TODO: Implement with Drizzle ORM
    // const db = await getDatabase();
    // const mappings = await db
    //   .select({
    //     deviceId: devices.id,
    //     devEui: devices.logicalIdentifier,
    //     tenantId: devices.tenantId,
    //     deviceName: devices.name,
    //     protocol: devices.protocol,
    //   })
    //   .from(devices)
    //   .where(
    //     and(
    //       eq(devices.protocol, 'lorawan'),
    //       isNotNull(devices.logicalIdentifier)
    //     )
    //   );
    //
    // return mappings as DeviceMapping[];

    // Placeholder: return empty array for now
    return [];
  };
}
