/**
 * Database Loader for Device Mappings
 *
 * Loads LoRa device mappings from PostgreSQL database.
 * Uses postgres.js for direct database access (lightweight, no ORM overhead).
 */

import postgres from 'postgres';
import type { Logger } from 'pino';
import type { DeviceMapping } from './device-mapping.js';

export interface DbLoaderConfig {
  databaseUrl: string;
}

/**
 * Create a database loader function for device mappings
 *
 * @param config - Database configuration
 * @param logger - Logger instance
 * @returns Async function that loads device mappings from database
 */
export function createDatabaseLoader(
  config: DbLoaderConfig,
  logger: Logger
): () => Promise<DeviceMapping[]> {
  return async (): Promise<DeviceMapping[]> => {
    const sql = postgres(config.databaseUrl, {
      max: 1, // Single connection for this operation
      idle_timeout: 20,
      connect_timeout: 10,
    });

    try {
      logger.debug('Loading LoRa device mappings from database...');

      // Query devices where protocol='lorawan' and logical_identifier is not null
      const results = await sql<Array<{
        id: string;
        logical_identifier: string;
        tenant_id: string;
        name: string;
        protocol: string;
      }>>`
        SELECT
          id,
          logical_identifier,
          organization_id as tenant_id,
          name,
          protocol
        FROM devices
        WHERE protocol = 'lorawan'
          AND logical_identifier IS NOT NULL
          AND status = 'active'
        ORDER BY name
      `;

      const mappings: DeviceMapping[] = results.map((row) => ({
        deviceId: row.id,
        devEui: row.logical_identifier.toLowerCase(), // Normalize to lowercase
        tenantId: row.tenant_id,
        deviceName: row.name,
        protocol: row.protocol,
      }));

      logger.info(
        { count: mappings.length },
        'Loaded LoRa device mappings from database'
      );

      return mappings;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to load device mappings from database'
      );
      throw error;
    } finally {
      await sql.end();
    }
  };
}

/**
 * Create a mock loader for testing (returns empty array)
 */
export function createMockLoader(): () => Promise<DeviceMapping[]> {
  return async () => [];
}
