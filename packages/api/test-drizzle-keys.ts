import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import { db } from './src/db/index.js';
import { systemSettings } from './src/db/schema/system-settings.js';
import { eq, and } from 'drizzle-orm';

const [setting] = await db
  .select()
  .from(systemSettings)
  .where(and(eq(systemSettings.category, 'iot'), eq(systemSettings.key, 'chirpstack_integration')));

console.log('Setting from Drizzle:');
console.log(JSON.stringify(setting, null, 2));

console.log('\n\nKeys:');
console.log(Object.keys(setting));

console.log('\n\nField access test:');
console.log('  setting.isPublic:', setting.isPublic);
console.log('  setting.isEncrypted:', setting.isEncrypted);
console.log('  setting.updatedBy:', setting.updatedBy);

process.exit(0);
