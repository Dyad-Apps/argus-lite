import { Redis, type RedisOptions } from 'ioredis';

let cacheClient: Redis | null = null;

/**
 * Creates and returns a Valkey/Redis client.
 * The client is cached and reused across calls.
 */
export function createCacheClient(url?: string): Redis {
  if (cacheClient) return cacheClient;

  const options: RedisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  cacheClient = new Redis(
    url ?? process.env.VALKEY_URL ?? 'redis://localhost:6379',
    options
  );

  cacheClient.on('error', (err: Error) => {
    console.error('Valkey connection error:', err);
  });

  cacheClient.on('connect', () => {
    console.log('Connected to Valkey');
  });

  return cacheClient;
}

/**
 * Gets the existing cache client.
 * Throws if the client hasn't been initialized.
 */
export function getCacheClient(): Redis {
  if (!cacheClient) {
    throw new Error(
      'Cache client not initialized. Call createCacheClient() first.'
    );
  }
  return cacheClient;
}

/**
 * Closes the cache client connection.
 * Call this during graceful shutdown.
 */
export async function closeCacheClient(): Promise<void> {
  if (cacheClient) {
    await cacheClient.quit();
    cacheClient = null;
  }
}
