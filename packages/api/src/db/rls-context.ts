/**
 * RLS Context Helper
 *
 * Sets PostgreSQL session variables for Row-Level Security policies.
 * These variables are used by RLS policies to filter data by user/org.
 */

import { sql } from 'drizzle-orm';
import type { db as DbType } from './index.js';

type Database = typeof DbType;

/**
 * Sets the current user context for RLS policies
 */
export async function setRlsContext(
  db: Database,
  userId: string | null,
  organizationId: string | null
): Promise<void> {
  // Set user ID (or empty string to clear)
  await db.execute(
    sql`SELECT set_config('app.current_user_id', ${userId ?? ''}, true)`
  );

  // Set organization ID (or empty string to clear)
  await db.execute(
    sql`SELECT set_config('app.current_org_id', ${organizationId ?? ''}, true)`
  );
}

/**
 * Clears the RLS context (useful after request completes)
 */
export async function clearRlsContext(db: Database): Promise<void> {
  await setRlsContext(db, null, null);
}

/**
 * Executes a function with RLS context set
 * Context is automatically cleared after function completes
 */
export async function withRlsContext<T>(
  db: Database,
  userId: string,
  organizationId: string | null,
  fn: () => Promise<T>
): Promise<T> {
  await setRlsContext(db, userId, organizationId);
  try {
    return await fn();
  } finally {
    await clearRlsContext(db);
  }
}

/**
 * Transaction wrapper that sets RLS context
 */
export async function withRlsTransaction<T>(
  db: Database,
  userId: string,
  organizationId: string | null,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // Set context within transaction
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${userId}, true)`
    );
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${organizationId ?? ''}, true)`
    );

    return fn(tx);
  });
}
