// Check what tables exist in the database
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log('Database URL:', databaseUrl.replace(/:[^:@]+@/, ':****@'));

const sql = postgres(databaseUrl);

try {
  // List all tables in public schema
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log('\n=== Tables in public schema ===\n');
  tables.forEach((t, i) => {
    console.log(`${i + 1}. ${t.table_name}`);
  });

  // Check if system_settings exists in any schema
  const systemSettingsInAnySchema = await sql`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_name = 'system_settings'
  `;

  console.log('\n=== system_settings table ===\n');
  if (systemSettingsInAnySchema.length === 0) {
    console.log('❌ system_settings table NOT FOUND in any schema');
  } else {
    systemSettingsInAnySchema.forEach(t => {
      console.log(`✅ Found in schema: ${t.table_schema}`);
    });
  }

  await sql.end();
} catch (error) {
  console.error('Error:', error);
  await sql.end();
  process.exit(1);
}
