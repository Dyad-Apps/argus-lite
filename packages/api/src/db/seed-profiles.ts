/**
 * Seed organization profiles only
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

async function seedProfiles() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🌱 Seeding organization profiles...\n');

  const client = postgres(databaseUrl, { max: 1 });

  try {
    // Check if profiles already exist
    const existing = await client`
      SELECT COUNT(*) as count FROM organization_profiles
    `;

    if (Number(existing[0].count) > 0) {
      console.log('⚠️  Organization profiles already exist. Skipping...');
      return;
    }

    // Enterprise profile
    await client`
      INSERT INTO organization_profiles (
        name, description, type, is_system, capabilities, limits
      ) VALUES (
        'Enterprise',
        'Full-featured plan for large organizations with advanced security and compliance needs',
        'root',
        true,
        ${JSON.stringify({
          sso: true,
          whiteLabeling: true,
          impersonation: true,
          advancedAuditLogs: true,
          apiAccess: true,
          customDomain: true,
          childOrganizations: true,
          maxChildDepth: 5,
        })},
        ${JSON.stringify({
          maxUsers: -1,
          maxOrganizations: -1,
          maxRoles: -1,
          maxGroups: -1,
          storageGb: -1,
          apiRequestsPerDay: -1,
        })}
      )
    `;
    console.log('   ✅ Created Enterprise profile (system)');

    // Standard profile
    await client`
      INSERT INTO organization_profiles (
        name, description, type, is_system, capabilities, limits
      ) VALUES (
        'Standard',
        'Standard plan for growing teams with essential collaboration features',
        'root',
        true,
        ${JSON.stringify({
          sso: true,
          whiteLabeling: false,
          impersonation: false,
          advancedAuditLogs: false,
          apiAccess: true,
          customDomain: false,
          childOrganizations: true,
          maxChildDepth: 2,
        })},
        ${JSON.stringify({
          maxUsers: 100,
          maxOrganizations: 5,
          maxRoles: 10,
          maxGroups: 20,
          storageGb: 50,
          apiRequestsPerDay: 10000,
        })}
      )
    `;
    console.log('   ✅ Created Standard profile (system)');

    // Starter profile
    await client`
      INSERT INTO organization_profiles (
        name, description, type, is_system, capabilities, limits
      ) VALUES (
        'Starter',
        'Basic plan for small teams getting started',
        'root',
        true,
        ${JSON.stringify({
          sso: false,
          whiteLabeling: false,
          impersonation: false,
          advancedAuditLogs: false,
          apiAccess: false,
          customDomain: false,
          childOrganizations: false,
          maxChildDepth: 0,
        })},
        ${JSON.stringify({
          maxUsers: 10,
          maxOrganizations: 1,
          maxRoles: 3,
          maxGroups: 5,
          storageGb: 5,
          apiRequestsPerDay: 1000,
        })}
      )
    `;
    console.log('   ✅ Created Starter profile (system)');

    console.log('\n✅ Organization profiles seeded successfully!');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedProfiles();
