// Check system admins in the database
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
  console.log('\n=== System Admins ===\n');

  const admins = await sql`
    SELECT
      sa.id,
      sa.user_id,
      sa.role,
      sa.is_active,
      u.email,
      u.first_name,
      u.last_name
    FROM system_admins sa
    JOIN users u ON u.id = sa.user_id
    ORDER BY sa.created_at
  `;

  if (admins.length === 0) {
    console.log('❌ No system admins found in database!');
    console.log('\nYou need to add a system admin. Run this SQL:\n');
    console.log(`INSERT INTO system_admins (user_id, role, is_active)`);
    console.log(`VALUES ((SELECT id FROM users WHERE email = 'YOUR_EMAIL'), 'system_admin', true);`);
  } else {
    console.log(`Found ${admins.length} system admin(s):\n`);
    admins.forEach((admin, i) => {
      console.log(`${i + 1}. ${admin.first_name} ${admin.last_name} (${admin.email})`);
      console.log(`   User ID: ${admin.user_id}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Active: ${admin.is_active}`);
      console.log('');
    });
  }

  await sql.end();
  console.log('✅ Check completed!\n');
} catch (error) {
  console.error('Error:', error);
  await sql.end();
  process.exit(1);
}
