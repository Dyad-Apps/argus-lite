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

    if (existingOrg.length > 0) {
      console.log('⚠️  Database already seeded. Skipping...');
      console.log(`   Organization "${SEED_CONFIG.organization.name}" exists with ID: ${existingOrg[0].id}`);

      // Check for admin user
      const existingAdmin = await client`
        SELECT id, email FROM users WHERE email = ${SEED_CONFIG.admin.email}
      `;
      if (existingAdmin.length > 0) {
        console.log(`   Admin user "${SEED_CONFIG.admin.email}" exists`);
      }

      console.log('\n✅ Seed check complete. Use existing data or reset database to re-seed.');
      return;
    }

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
    const orgId = org.id;
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
    const userId = user.id;
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

    // Step 4: Create identity providers for SSO
    console.log('\n🔐 Creating identity providers...');

    // Google provider
    const [googleProvider] = await client`
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
    console.log(`   ✅ Created Google provider (${googleProvider.id})`);

    // GitHub provider
    const [githubProvider] = await client`
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
    console.log(`   ✅ Created GitHub provider (${githubProvider.id})`);

    // Step 5: Create organization branding (optional - table may not exist)
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
    console.log('   Google Provider ID: ' + googleProvider.id);
    console.log('   GitHub Provider ID: ' + githubProvider.id);
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
