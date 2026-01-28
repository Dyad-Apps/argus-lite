/**
 * Run a single migration file
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

async function runMigration() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('❌ Please provide migration file name');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log(`🔄 Running migration: ${migrationFile}`);

  const client = postgres(databaseUrl, { max: 1 });

  try {
    const sql = readFileSync(
      resolve(__dirname, `migrations/${migrationFile}`),
      'utf-8'
    );

    await client.unsafe(sql);
    console.log('✅ Migration applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
