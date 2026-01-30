/**
 * IoT Bridge Service - Main Entry Point
 *
 * Bridges MQTT telemetry messages from EMQX to NATS JetStream.
 */

// Load environment variables from root .env file
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// From src/ directory: ../../../.env goes to root .env
config({ path: resolve(__dirname, '../../../.env') });
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { BridgeService } from './bridge.js';
import { DeviceMappingService } from './services/device-mapping.js';
import { createDatabaseLoader } from './services/db-loader.js';
import { createSystemSettingsLoader } from './services/system-settings-loader.js';

async function main() {
  // Load base configuration from environment
  const config = loadConfig();

  // Create logger
  const logger = createLogger(config);

  logger.info({ config: { mqtt: config.mqtt.brokerUrl, nats: config.nats.servers } }, 'Starting IoT Bridge');

  // Get database URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set - using environment variables for configuration');
  }

  // Load system settings from database (if DATABASE_URL is available)
  if (databaseUrl) {
    try {
      const settingsLoader = createSystemSettingsLoader(
        { databaseUrl },
        logger.child({ component: 'settings-loader' })
      );
      const systemSettings = await settingsLoader();

      // Apply ChirpStack settings from database
      config.chirpstack.enabled = systemSettings.chirpStackIntegration.enabled;
      config.chirpstack.topicPattern = systemSettings.chirpStackIntegration.topicPattern;

      // Update MQTT topics to include ChirpStack pattern if enabled
      if (config.chirpstack.enabled) {
        const defaultTopics = ['devices/+/telemetry'];
        if (!defaultTopics.includes(config.chirpstack.topicPattern)) {
          defaultTopics.push(config.chirpstack.topicPattern);
        }
        config.mqtt.topics = defaultTopics;
      }

      logger.info(
        {
          chirpStackEnabled: config.chirpstack.enabled,
          topicPattern: config.chirpstack.topicPattern,
          mqttTopics: config.mqtt.topics,
        },
        'Applied system settings from database'
      );
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to load system settings from database, using environment defaults'
      );
    }
  }

  // Create device mapping service
  const deviceMappingService = new DeviceMappingService(
    {
      refreshIntervalMs: 300000, // Refresh every 5 minutes
      enableRedis: false, // In-memory only for now
    },
    logger.child({ component: 'device-mapping' })
  );

  // Create database loader for device mappings
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set - device mappings will be empty (ChirpStack integration disabled)');
  }

  const dbLoader = databaseUrl
    ? createDatabaseLoader({ databaseUrl }, logger.child({ component: 'db-loader' }))
    : async () => [];

  // Initialize device mapping service (load mappings from database)
  await deviceMappingService.initialize(dbLoader);
  const mappingStats = deviceMappingService.getStats();
  logger.info(
    { mappingCount: mappingStats.size, lastRefresh: mappingStats.lastRefresh },
    'Device mapping service initialized'
  );

  // Create bridge service with device mapping
  const bridge = new BridgeService(config, logger, deviceMappingService);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    try {
      await bridge.stop();
      process.exit(0);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });

  // Start the bridge
  try {
    await bridge.start();
  } catch (error) {
    logger.fatal({ error: error instanceof Error ? error.message : String(error) }, 'Failed to start bridge');
    process.exit(1);
  }
}

main();
