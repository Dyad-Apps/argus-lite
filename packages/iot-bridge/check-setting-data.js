import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const sql = postgres(databaseUrl);

const [setting] = await sql`
  SELECT *
  FROM system_settings
  WHERE category = 'iot' AND key = 'chirpstack_integration'
`;

console.log('ChirpStack integration setting:');
console.log(JSON.stringify(setting, null, 2));

console.log('\n\nField types:');
Object.entries(setting).forEach(([key, value]) => {
  console.log(`  ${key}: ${typeof value} = ${value === null ? 'null' : value === undefined ? 'undefined' : JSON.stringify(value)}`);
});

await sql.end();
