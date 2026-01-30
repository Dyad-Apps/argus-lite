// Test script to verify system settings in database
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

const sql = postgres(databaseUrl);

try {
  console.log('\n=== System Settings ===\n');

  const settings = await sql`
    SELECT
      id,
      category,
      key,
      value,
      description,
      is_public as "isPublic",
      updated_at as "updatedAt",
      created_at as "createdAt"
    FROM system_settings
    WHERE category = 'iot'
  `;

  if (settings.length === 0) {
    console.log('No IoT settings found in database');
  } else {
    settings.forEach(setting => {
      console.log(`Category: ${setting.category}`);
      console.log(`Key: ${setting.key}`);
      console.log(`Value:`, JSON.stringify(setting.value, null, 2));
      console.log(`Description: ${setting.description}`);
      console.log(`Public: ${setting.isPublic}`);
      console.log(`Updated: ${setting.updatedAt}`);
      console.log(`Created: ${setting.createdAt}`);
      console.log('---');
    });
  }

  console.log('\n=== Testing System Settings Loader ===\n');

  // Test the actual loader
  const { createSystemSettingsLoader } = await import('./dist/services/system-settings-loader.js');
  const settingsLoader = createSystemSettingsLoader(
    { databaseUrl },
    { debug: console.log, info: console.log, warn: console.warn, error: console.error }
  );

  const loadedSettings = await settingsLoader();
  console.log('Loaded ChirpStack Settings:');
  console.log('  Enabled:', loadedSettings.chirpStackIntegration.enabled);
  console.log('  Topic Pattern:', loadedSettings.chirpStackIntegration.topicPattern);
  console.log('  Description:', loadedSettings.chirpStackIntegration.description);

  await sql.end();
  console.log('\n✅ Test completed successfully!');
} catch (error) {
  console.error('Error:', error);
  await sql.end();
  process.exit(1);
}
