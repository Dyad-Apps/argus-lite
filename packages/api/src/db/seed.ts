/**
 * Database Seed Script
 *
 * Creates initial data for local development:
 * - Default root organization (Viaanix)
 * - Default admin user
 * - Google and GitHub identity provider configurations
 *
 * Usage: pnpm db:seed
 */

// Load environment variables from root .env file
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

import postgres from 'postgres';
import { hashPassword } from '../utils/password.js';

// Seed configuration
const SEED_CONFIG = {
  organization: {
    name: 'Viaanix',
    slug: 'viaanix',
    orgCode: 'VIAANIX',
    subdomain: 'viaanix',
  },
  admin: {
    email: 'admin@viaanix.com',
    password: 'Admin123!',
    firstName: 'System',
    lastName: 'Admin',
  },
  // Optional: Set these to enable SSO (or leave as placeholders)
  sso: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || 'your-github-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret',
    },
  },
};

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🌱 Starting database seed...\n');

  const client = postgres(databaseUrl, { max: 1 });

  try {
    // Check if already seeded
    const existingOrg = await client`
      SELECT id FROM organizations WHERE slug = ${SEED_CONFIG.organization.slug}
    `;

    let orgId: string;
    let userId: string;
    let googleProvider: { id: string } | null = null;
    let githubProvider: { id: string } | null = null;

    if (existingOrg.length > 0) {
      console.log('⚠️  Organization already exists. Using existing data and adding IoT seed data...');
      orgId = existingOrg[0].id;
      console.log(`   Organization "${SEED_CONFIG.organization.name}" exists with ID: ${orgId}`);

      // Check for admin user
      const existingAdmin = await client`
        SELECT id, email FROM users WHERE email = ${SEED_CONFIG.admin.email}
      `;
      if (existingAdmin.length > 0) {
        userId = existingAdmin[0].id;
        console.log(`   Admin user "${SEED_CONFIG.admin.email}" exists with ID: ${userId}`);
      } else {
        console.error('❌ Admin user not found. Cannot proceed with IoT seed.');
        return;
      }

      // Skip to IoT seeding (jump to Step 7)
      console.log('\n📡 Adding IoT seed data...');
    } else {

    // Step 1: Create root organization
    console.log('📁 Creating root organization...');
    const [org] = await client`
      INSERT INTO organizations (
        name, slug, org_code, subdomain, is_root, can_have_children, plan
      ) VALUES (
        ${SEED_CONFIG.organization.name},
        ${SEED_CONFIG.organization.slug},
        ${SEED_CONFIG.organization.orgCode},
        ${SEED_CONFIG.organization.subdomain},
        true,
        true,
        'enterprise'
      )
      RETURNING id
    `;
    orgId = org.id;
    console.log(`   ✅ Created organization: ${SEED_CONFIG.organization.name} (${orgId})`);

    // Update root_organization_id to point to itself (required for root orgs)
    await client`
      UPDATE organizations
      SET root_organization_id = ${orgId}
      WHERE id = ${orgId}
    `;
    console.log('   ✅ Set root_organization_id self-reference');

    // Step 2: Create admin user
    console.log('\n👤 Creating admin user...');
    const passwordHash = await hashPassword(SEED_CONFIG.admin.password);

    const [user] = await client`
      INSERT INTO users (
        email, password_hash, first_name, last_name,
        root_organization_id, primary_organization_id,
        status, email_verified_at
      ) VALUES (
        ${SEED_CONFIG.admin.email},
        ${passwordHash},
        ${SEED_CONFIG.admin.firstName},
        ${SEED_CONFIG.admin.lastName},
        ${orgId},
        ${orgId},
        'active',
        NOW()
      )
      RETURNING id
    `;
    userId = user.id;
    console.log(`   ✅ Created admin: ${SEED_CONFIG.admin.email} (${userId})`);

    // Step 3: Add user to organization as owner
    console.log('\n🔗 Linking admin to organization...');
    await client`
      INSERT INTO user_organizations (
        user_id, organization_id, role, is_primary
      ) VALUES (
        ${userId},
        ${orgId},
        'owner',
        true
      )
    `;
    console.log('   ✅ Admin linked as organization owner');

    // Step 3b: Add admin to system_admins as super_admin
    console.log('\n👑 Setting up super admin...');
    try {
      await client`
        INSERT INTO system_admins (user_id, role, is_active, created_by)
        VALUES (${userId}, 'super_admin', true, ${userId})
      `;
      console.log('   ✅ Admin granted super_admin privileges');
    } catch (error) {
      console.log('   ⚠️  system_admins table not found, skipping (optional)');
    }

    // Step 4: Create identity providers for SSO
    console.log('\n🔐 Creating identity providers...');

    // Google provider
    const googleProviderResult = await client`
      INSERT INTO identity_providers (
        organization_id, type, name, display_name, enabled, auto_create_users, auto_link_users, config
      ) VALUES (
        ${orgId},
        'google',
        'google',
        'Google',
        true,
        true,
        true,
        ${JSON.stringify({
          type: 'google',
          clientId: SEED_CONFIG.sso.google.clientId,
          clientSecret: SEED_CONFIG.sso.google.clientSecret,
          scopes: ['openid', 'email', 'profile'],
        })}
      )
      RETURNING id
    `;
    googleProvider = googleProviderResult[0] as { id: string };
    console.log(`   ✅ Created Google provider (${googleProvider.id})`);

    // GitHub provider
    const githubProviderResult = await client`
      INSERT INTO identity_providers (
        organization_id, type, name, display_name, enabled, auto_create_users, auto_link_users, config
      ) VALUES (
        ${orgId},
        'github',
        'github',
        'GitHub',
        true,
        true,
        true,
        ${JSON.stringify({
          type: 'github',
          clientId: SEED_CONFIG.sso.github.clientId,
          clientSecret: SEED_CONFIG.sso.github.clientSecret,
          scopes: ['user:email', 'read:user'],
        })}
      )
      RETURNING id
    `;
    githubProvider = githubProviderResult[0] as { id: string };
    console.log(`   ✅ Created GitHub provider (${githubProvider.id})`);

    // Step 5: Create default organization profiles
    console.log('\n📊 Creating default organization profiles...');
    try {
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
    } catch (error) {
      console.log('   ⚠️  Organization profiles table not found or error:', (error as Error).message);
    }

    // Step 6: Create organization branding (optional - table may not exist)
    console.log('\n🎨 Creating organization branding...');
    try {
      await client`
        INSERT INTO organization_branding (
          organization_id, primary_color, login_background_type, login_welcome_text, login_subtitle
        ) VALUES (
          ${orgId},
          '#2563eb',
          'default',
          'Welcome to Viaanix',
          'Sign in to your account'
        )
      `;
      console.log('   ✅ Created branding configuration');
    } catch {
      console.log('   ⚠️  Branding table not found, skipping (optional)');
    }
    } // End of else block (new organization creation)

    // Step 7: Create IoT Device Types
    console.log('\n📡 Creating IoT device types...');
    try {
      // Endpoint Device Type (simple temperature sensor)
      const [tempSensorType] = await client`
        INSERT INTO device_types (
          organization_id, name, description, category, icon,
          processing_mode, protocol_adapter, message_schema, extraction_rules, created_by
        ) VALUES (
          ${orgId}, 'Temperature Sensor', 'Simple endpoint device that reports temperature',
          'Sensors', 'thermometer',
          'endpoint', 'json',
          ${JSON.stringify({
            type: 'object',
            properties: { temp: { type: 'number', unit: 'celsius' }, humidity: { type: 'number', unit: 'percent' } }
          })},
          ${JSON.stringify({
            temperature: { path: '$.temp', type: 'numeric', unit: 'celsius' },
            humidity: { path: '$.humidity', type: 'numeric', unit: 'percent' }
          })},
          ${userId}
        ) RETURNING id
      `;
      console.log(`   ✅ Created Temperature Sensor device type (${tempSensorType.id})`);

      // Gateway Device Type (location hub)
      const [locationHubType] = await client`
        INSERT INTO device_types (
          organization_id, name, description, category, icon,
          processing_mode, protocol_adapter, message_schema, demux_strategy, created_by
        ) VALUES (
          ${orgId}, 'Location Hub', 'Gateway that reports 50 location beacons',
          'Gateways', 'router',
          'gateway', 'json',
          ${JSON.stringify({
            type: 'object',
            properties: { beacons: { type: 'array', items: { type: 'object' } } }
          })},
          ${JSON.stringify({
            strategy: 'iterate_array',
            arrayPath: '$.beacons',
            idPath: '$.beaconId',
            nameTemplate: 'Beacon {{beaconId}}'
          })},
          ${userId}
        ) RETURNING id
      `;
      console.log(`   ✅ Created Location Hub device type (${locationHubType.id})`);

      // Gateway Chunked Device Type (BLE gateway)
      const [bleGatewayType] = await client`
        INSERT INTO device_types (
          organization_id, name, description, category, icon,
          processing_mode, protocol_adapter, chunking_config, demux_strategy, created_by
        ) VALUES (
          ${orgId}, 'BLE Gateway', 'Gateway with chunked messages (2000 beacons, 67 chunks)',
          'Gateways', 'bluetooth',
          'gateway_chunked', 'json',
          ${JSON.stringify({
            enabled: true,
            maxChunkSize: 8192,
            ttl: 60,
            correlationIdPath: '$.correlationId',
            sequencePath: '$.seq',
            totalPath: '$.total'
          })},
          ${JSON.stringify({
            strategy: 'iterate_array',
            arrayPath: '$.devices',
            idPath: '$.deviceId',
            nameTemplate: 'BLE Device {{deviceId}}'
          })},
          ${userId}
        ) RETURNING id
      `;
      console.log(`   ✅ Created BLE Gateway device type (${bleGatewayType.id})`);
    } catch (error) {
      console.log('   ⚠️  Error creating device types:', (error as Error).message);
    }

    // Step 8: Create IoT Asset Types
    console.log('\n🏭 Creating IoT asset types...');
    try {
      // HVAC Asset Type
      const [hvacType] = await client`
        INSERT INTO asset_types (
          organization_id, name, description, category, icon,
          metric_definitions, health_algorithm, threshold_rules, created_by
        ) VALUES (
          ${orgId}, 'HVAC System', 'Heating, Ventilation, and Air Conditioning unit',
          'Equipment', 'wind',
          ${JSON.stringify({
            temperature: { unit: 'celsius', type: 'gauge', displayName: 'Temperature' },
            setpoint: { unit: 'celsius', type: 'gauge', displayName: 'Setpoint' },
            fanSpeed: { unit: 'rpm', type: 'gauge', displayName: 'Fan Speed' },
            powerConsumption: { unit: 'kw', type: 'gauge', displayName: 'Power' }
          })},
          ${JSON.stringify({
            algorithm: 'weighted_average',
            weights: { temperature: 0.3, fanSpeed: 0.3, powerConsumption: 0.4 },
            normalization: { temperature: { min: 15, max: 30 }, fanSpeed: { min: 0, max: 3000 }, powerConsumption: { min: 0, max: 10 } }
          })},
          ${JSON.stringify([
            { metric: 'temperature', warning: 28, critical: 32, message: 'Temperature too high' },
            { metric: 'powerConsumption', warning: 8, critical: 10, message: 'Power consumption excessive' }
          ])},
          ${userId}
        ) RETURNING id
      `;
      console.log(`   ✅ Created HVAC System asset type (${hvacType.id})`);

      // Cold Storage Asset Type
      const [coldStorageType] = await client`
        INSERT INTO asset_types (
          organization_id, name, description, category, icon,
          metric_definitions, health_algorithm, threshold_rules, created_by
        ) VALUES (
          ${orgId}, 'Cold Storage', 'Refrigerated storage unit',
          'Equipment', 'snowflake',
          ${JSON.stringify({
            temperature: { unit: 'celsius', type: 'gauge', displayName: 'Temperature' },
            humidity: { unit: 'percent', type: 'gauge', displayName: 'Humidity' },
            doorStatus: { unit: 'boolean', type: 'state', displayName: 'Door Status' }
          })},
          ${JSON.stringify({
            algorithm: 'threshold_based',
            critical_if: 'temperature > -15',
            warning_if: 'temperature > -18',
            healthy_if: 'temperature <= -20'
          })},
          ${JSON.stringify([
            { metric: 'temperature', warning: -15, critical: -10, message: 'Storage temperature too high - food safety risk' }
          ])},
          ${userId}
        ) RETURNING id
      `;
      console.log(`   ✅ Created Cold Storage asset type (${coldStorageType.id})`);
    } catch (error) {
      console.log('   ⚠️  Error creating asset types:', (error as Error).message);
    }

    // Step 9: Create sample devices
    console.log('\n🔌 Creating sample devices...');
    try {
      const [device1] = await client`
        INSERT INTO devices (
          organization_id, device_type_id, name, description, serial_number,
          device_role, protocol, status, created_by
        ) SELECT
          ${orgId}, id, 'Temp Sensor 001', 'Temperature sensor in warehouse',
          'TS-001-2024', 'endpoint', 'mqtt', 'active', ${userId}
        FROM device_types WHERE name = 'Temperature Sensor' AND organization_id = ${orgId}
        RETURNING id
      `;
      console.log(`   ✅ Created sample device: Temp Sensor 001 (${device1.id})`);

      const [device2] = await client`
        INSERT INTO devices (
          organization_id, device_type_id, name, description, serial_number,
          device_role, protocol, status, created_by
        ) SELECT
          ${orgId}, id, 'Location Hub 001', 'Location tracking hub in facility A',
          'LH-001-2024', 'gateway', 'mqtt', 'active', ${userId}
        FROM device_types WHERE name = 'Location Hub' AND organization_id = ${orgId}
        RETURNING id
      `;
      console.log(`   ✅ Created sample device: Location Hub 001 (${device2.id})`);
    } catch (error) {
      console.log('   ⚠️  Error creating devices:', (error as Error).message);
    }

    // Step 10: Create sample assets
    console.log('\n🏗️  Creating sample assets...');
    try {
      const [asset1] = await client`
        INSERT INTO assets (
          organization_id, asset_type_id, name, description,
          status, health_score, created_by
        ) SELECT
          ${orgId}, id, 'HVAC Unit A1', 'Main HVAC unit in Building A',
          'active', 95.5, ${userId}
        FROM asset_types WHERE name = 'HVAC System' AND organization_id = ${orgId}
        RETURNING id
      `;
      console.log(`   ✅ Created sample asset: HVAC Unit A1 (${asset1.id})`);

      const [asset2] = await client`
        INSERT INTO assets (
          organization_id, asset_type_id, name, description,
          status, health_score, created_by
        ) SELECT
          ${orgId}, id, 'Cold Storage Room 1', 'Main refrigerated storage room',
          'active', 98.0, ${userId}
        FROM asset_types WHERE name = 'Cold Storage' AND organization_id = ${orgId}
        RETURNING id
      `;
      console.log(`   ✅ Created sample asset: Cold Storage Room 1 (${asset2.id})`);
    } catch (error) {
      console.log('   ⚠️  Error creating assets:', (error as Error).message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Seed completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   Organization: ${SEED_CONFIG.organization.name}`);
    console.log(`   Subdomain:    ${SEED_CONFIG.organization.subdomain} (${SEED_CONFIG.organization.subdomain}.argusiq.com)`);
    console.log(`   Org Code:     ${SEED_CONFIG.organization.orgCode}`);
    console.log(`   Org ID:       ${orgId}`);
    console.log('');
    console.log('   Admin Email:    ' + SEED_CONFIG.admin.email);
    console.log('   Admin Password: ' + SEED_CONFIG.admin.password);
    console.log('   Admin ID:       ' + userId);
    console.log('');
    if (googleProvider && githubProvider) {
      console.log('   Google Provider ID: ' + googleProvider.id);
      console.log('   GitHub Provider ID: ' + githubProvider.id);
      console.log('');
    }
    console.log('🚀 IoT Platform Seed Data:');
    console.log('   Device Types: Temperature Sensor, Location Hub, BLE Gateway');
    console.log('   Asset Types:  HVAC System, Cold Storage');
    console.log('   Devices:      Temp Sensor 001, Location Hub 001');
    console.log('   Assets:       HVAC Unit A1, Cold Storage Room 1');
    console.log('');
    console.log('⚠️  Note: SSO providers use placeholder credentials.');
    console.log('   Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc. in .env');
    console.log('   then re-run seed or update the database directly.');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
