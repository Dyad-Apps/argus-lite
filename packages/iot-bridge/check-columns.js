import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(databaseUrl);

const columns = await sql`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'system_settings'
  ORDER BY ordinal_position
`;

console.log('Columns in system_settings table:');
columns.forEach((c) => {
  console.log(`  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(30)} nullable: ${c.is_nullable}`);
});

// Also check actual data
const settings = await sql`SELECT * FROM system_settings LIMIT 1`;
console.log('\nSample row keys:', Object.keys(settings[0] || {}));

if (settings[0]) {
  console.log('\nSample row values:');
  console.log(`  is_public: ${settings[0].is_public}`);
  console.log(`  is_encrypted: ${settings[0].is_encrypted}`);
}

await sql.end();
