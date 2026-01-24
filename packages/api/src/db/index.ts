import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('DATABASE_URL not set, database operations will fail');
}

// Connection for queries (pooled)
const queryClient = postgres(databaseUrl ?? '', {
  max: 10, // Pool size
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Fail if can't connect in 10s
  prepare: false, // Disable prepared statements for pgbouncer compat
});

// Export typed db instance with schema for relational queries
export const db = drizzle(queryClient, { schema });

// Export transaction type for repository pattern
export type Transaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

// Export the raw query client for health checks
export const sql = queryClient;

/**
 * Health check function for database connectivity
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'pass' | 'fail';
  latency_ms: number;
  message?: string;
}> {
  const start = performance.now();
  try {
    await queryClient`SELECT 1`;
    const latency = performance.now() - start;
    return {
      status: 'pass',
      latency_ms: Math.round(latency),
    };
  } catch (error) {
    return {
      status: 'fail',
      latency_ms: Math.round(performance.now() - start),
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Graceful shutdown helper
 */
export async function closeDatabaseConnection(): Promise<void> {
  await queryClient.end();
}

// Export RLS context utilities
export * from './rls-context.js';
