/**
 * IoT Bridge Service - Main Entry Point
 *
 * Bridges MQTT telemetry messages from EMQX to NATS JetStream.
 */

import 'dotenv/config';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { BridgeService } from './bridge.js';

async function main() {
  // Load configuration
  const config = loadConfig();

  // Create logger
  const logger = createLogger(config);

  logger.info({ config: { mqtt: config.mqtt.brokerUrl, nats: config.nats.servers } }, 'Starting IoT Bridge');

  // Create bridge service
  const bridge = new BridgeService(config, logger);

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
