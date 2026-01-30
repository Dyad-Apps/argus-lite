/**
 * System Settings Loader
 *
 * Loads system configuration from PostgreSQL database.
 * Uses postgres.js for direct database access.
 */

import postgres from 'postgres';
import type { Logger } from 'pino';

export interface ChirpStackIntegrationSetting {
  enabled: boolean;
  topicPattern: string;
  description?: string;
}

export interface SystemSettings {
  chirpStackIntegration: ChirpStackIntegrationSetting;
}

export interface SystemSettingsLoaderConfig {
  databaseUrl: string;
}

/**
 * Create a system settings loader function
 *
 * @param config - Database configuration
 * @param logger - Logger instance
 * @returns Async function that loads system settings from database
 */
export function createSystemSettingsLoader(
  config: SystemSettingsLoaderConfig,
  logger: Logger
): () => Promise<SystemSettings> {
  return async (): Promise<SystemSettings> => {
    const sql = postgres(config.databaseUrl, {
      max: 1, // Single connection for this operation
      idle_timeout: 20,
      connect_timeout: 10,
    });

    try {
      logger.debug('Loading system settings from database...');

      // Query system_settings table for IoT configuration
      const results = await sql<Array<{
        category: string;
        key: string;
        value: Record<string, unknown>;
      }>>`
        SELECT
          category,
          key,
          value
        FROM system_settings
        WHERE category = 'iot'
          AND key = 'chirpstack_integration'
        LIMIT 1
      `;

      // Default settings
      const defaultSettings: SystemSettings = {
        chirpStackIntegration: {
          enabled: true,
          topicPattern: 'application/+/device/+/event/up',
          description: 'ChirpStack MQTT integration for LoRa devices',
        },
      };

      if (results.length === 0) {
        logger.warn('No ChirpStack integration settings found in database, using defaults');
        return defaultSettings;
      }

      const setting = results[0];
      const value = setting.value as ChirpStackIntegrationSetting;

      const settings: SystemSettings = {
        chirpStackIntegration: {
          enabled: value.enabled ?? defaultSettings.chirpStackIntegration.enabled,
          topicPattern: value.topicPattern ?? defaultSettings.chirpStackIntegration.topicPattern,
          description: value.description,
        },
      };

      logger.info(
        {
          enabled: settings.chirpStackIntegration.enabled,
          topicPattern: settings.chirpStackIntegration.topicPattern,
        },
        'Loaded system settings from database'
      );

      return settings;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to load system settings from database, using defaults'
      );

      // Return defaults on error
      return {
        chirpStackIntegration: {
          enabled: true,
          topicPattern: 'application/+/device/+/event/up',
          description: 'ChirpStack MQTT integration for LoRa devices',
        },
      };
    } finally {
      await sql.end();
    }
  };
}

/**
 * Create a mock settings loader for testing (returns defaults)
 */
export function createMockSettingsLoader(): () => Promise<SystemSettings> {
  return async () => ({
    chirpStackIntegration: {
      enabled: true,
      topicPattern: 'application/+/device/+/event/up',
      description: 'ChirpStack MQTT integration for LoRa devices',
    },
  });
}
