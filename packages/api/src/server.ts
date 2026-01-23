import { buildApp } from './app.js';
import { closeCacheClient } from '@argus/shared';
import { closeDatabaseConnection } from './db/index.js';
import { flushSentry } from './plugins/sentry.js';

const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

async function start() {
  const app = await buildApp();

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, starting graceful shutdown...`);

    // Create a timeout to force exit if graceful shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      app.log.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);

    try {
      // Close Fastify server (stops accepting new requests)
      await app.close();
      app.log.info('HTTP server closed');

      // Close database connections
      try {
        await closeDatabaseConnection();
        app.log.info('Database connections closed');
      } catch (dbError) {
        app.log.error({ err: dbError }, 'Error closing database connections');
      }

      // Close cache connections
      try {
        await closeCacheClient();
        app.log.info('Cache connections closed');
      } catch (cacheError) {
        app.log.error({ err: cacheError }, 'Error closing cache connections');
      }

      // Flush Sentry events
      try {
        await flushSentry(2000);
        app.log.info('Sentry events flushed');
      } catch (sentryError) {
        app.log.error({ err: sentryError }, 'Error flushing Sentry events');
      }

      clearTimeout(forceExitTimeout);
      app.log.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExitTimeout);
      app.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    app.log.fatal({ reason, promise }, 'Unhandled rejection');
    shutdown('unhandledRejection');
  });

  try {
    const port = parseInt(process.env.PORT ?? '3040', 10);
    const host = process.env.HOST ?? '0.0.0.0';

    await app.listen({ port, host });
    app.log.info(`Server listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
