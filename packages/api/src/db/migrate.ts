/**
 * Database Migration Runner
 *
 * Applies schema migrations and RLS policies.
 * Usage: pnpm db:migrate:run
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔄 Starting database migrations...');
  console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);

  // Create connection for migrations (not pooled)
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Step 1: Run Drizzle schema migrations
    console.log('\n📦 Applying schema migrations...');
    await migrate(db, {
      migrationsFolder: join(__dirname, 'migrations'),
    });
    console.log('✅ Schema migrations complete');

    // Step 2: Apply RLS policies
    console.log('\n🔒 Applying RLS policies...');
    const rlsPolicyFile = join(__dirname, 'migrations', '0001_rls_policies.sql');

    try {
      const rlsSql = readFileSync(rlsPolicyFile, 'utf-8');

      // Split into individual statements and execute
      const statements = rlsSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          await migrationClient.unsafe(statement);
        } catch (err) {
          // Ignore "already exists" errors for idempotency
          const message = err instanceof Error ? err.message : String(err);
          if (
            !message.includes('already exists') &&
            !message.includes('duplicate key')
          ) {
            console.warn(`   ⚠️  Warning: ${message.split('\n')[0]}`);
          }
        }
      }
      console.log('✅ RLS policies applied');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('   ℹ️  No RLS policy file found, skipping');
      } else {
        throw err;
      }
    }

    // Step 3: Verify tables
    console.log('\n📊 Verifying database state...');
    const tables = await migrationClient`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    console.log(`   Found ${tables.length} tables`);

    const policies = await migrationClient`
      SELECT COUNT(*) as count FROM pg_policies
    `;
    console.log(`   Found ${policies[0].count} RLS policies`);

    console.log('\n✅ All migrations complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
