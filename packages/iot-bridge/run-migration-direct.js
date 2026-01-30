// Run the system_settings migration directly
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(databaseUrl);

try {
  console.log('Reading migration file...');
  const migrationPath = resolve(__dirname, '../api/src/db/migrations/0013_system_settings.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('Executing migration...\n');
  await sql.unsafe(migrationSQL);

  console.log('\n✅ Migration executed successfully!');

  // Verify table was created
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name = 'system_settings'
  `;

  if (tables.length > 0) {
    console.log('✅ system_settings table now exists');

    // Check data
    const settings = await sql`SELECT * FROM system_settings`;
    console.log(`Found ${settings.length} settings in table`);
  } else {
    console.log('❌ system_settings table still NOT found!');
  }

  await sql.end();
} catch (error) {
  console.error('Error:', error);
  await sql.end();
  process.exit(1);
}
