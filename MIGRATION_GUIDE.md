# Database Migration Guide

## Problem Summary

When the database was dropped and recreated, only migrations 0000, 0001, 0002, and 0005-0011 were applied. **Migrations 0003 and 0004 were missing**, causing the groups endpoint to fail with a 500 error because the `user_groups` table didn't exist.

## Root Cause

The migration files exist but weren't applied in sequence when recreating the database. This happened because:

1. The database was dropped (fresh start)
2. `npm run db:migrate` was run, but it skipped some migrations
3. The missing tables caused runtime errors when the API tried to query them

## Solution

Applied the missing migrations manually:

```bash
cd packages/api
npx tsx src/db/migrate-single.ts 0003_user_groups_and_roles.sql
npx tsx src/db/migrate-single.ts 0004_impersonation_sessions.sql
```

## Complete Migration List (In Order)

When recreating the database from scratch, apply migrations in this order:

1. **0000_wooden_sunset_bain.sql** - Initial comprehensive schema
2. **0001_rls_policies.sql** - Row-level security policies
3. **0002_multi_org_hierarchy.sql** - Organization hierarchy support
4. **0003_user_groups_and_roles.sql** - ⚠️ RBAC tables (user_groups, roles, assignments)
5. **0004_impersonation_sessions.sql** - ⚠️ Impersonation audit logging
6. **0005_fix_ltree_column_type.sql** - LTREE column type fixes
7. **0006_phase7_base_types.sql** - Phase 7 IoT base types
8. **0007_add_person_geolocation.sql** - Geolocation for persons
9. **0008_add_organization_profiles.sql** - Organization profiles table
10. **0009_add_profile_id_to_organizations.sql** - Link orgs to profiles
11. **0010_add_quota_overrides_to_organizations.sql** - Quota override column
12. **0011_add_description_to_organizations.sql** - Description column

## Proper Workflow

### When Creating New Migrations

```bash
# 1. Edit TypeScript schema
vim packages/api/src/db/schema/organizations.ts

# 2. Generate migration with Drizzle Kit
cd packages/api
npx drizzle-kit generate

# 3. Review the generated migration
cat src/db/migrations/XXXX_new_migration.sql

# 4. Apply the migration
npm run db:migrate

# 5. Commit BOTH files together
git add src/db/schema/ src/db/migrations/
git commit -m "feat: add new feature with migration"
```

### When Recreating Database

```bash
# Option 1: Use Drizzle Kit (recommended)
cd packages/api
npm run db:migrate

# Option 2: Apply migrations manually (if drizzle-kit has issues)
cd packages/api
for file in src/db/migrations/*.sql; do
  npx tsx src/db/migrate-single.ts $(basename $file)
done

# Option 3: Apply specific migration
npx tsx src/db/migrate-single.ts 0003_user_groups_and_roles.sql
```

### Verifying Migrations

```bash
# Check which tables exist
psql $DATABASE_URL -c "\dt"

# Check specific table
psql $DATABASE_URL -c "\d user_groups"

# Check all applied migrations (if using drizzle)
psql $DATABASE_URL -c "SELECT * FROM __drizzle_migrations ORDER BY created_at"
```

## Critical Tables Required

These tables must exist for the application to work:

### Core Tables (from 0000)
- organizations
- users
- user_organizations
- organization_invitations
- refresh_tokens
- password_reset_tokens
- audit_logs
- organization_branding
- identity_providers

### RBAC Tables (from 0003) ⚠️ CRITICAL
- user_groups
- user_group_memberships
- roles
- user_role_assignments
- group_role_assignments

### Security Tables (from 0004)
- impersonation_sessions

### Profile Tables (from 0008)
- organization_profiles

### Phase 7 IoT Tables (from 0006)
- device_types, devices
- asset_types, assets
- person_types, persons
- activity_types, activities
- space_types, spaces

## Lessons Learned

1. **Always apply ALL migrations in order** when recreating a database
2. **Test critical endpoints** after database recreation
3. **Use migration tracking** to know which migrations have been applied
4. **Document migration dependencies** so missing tables are caught early
5. **Schema changes need migrations** - never update schema without creating a migration

## Quick Health Check

After recreating database, verify critical tables:

```bash
psql $DATABASE_URL << EOF
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'organizations') THEN '✓' ELSE '✗'
  END as organizations,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users') THEN '✓' ELSE '✗'
  END as users,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_groups') THEN '✓' ELSE '✗'
  END as user_groups,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roles') THEN '✓' ELSE '✗'
  END as roles,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'organization_profiles') THEN '✓' ELSE '✗'
  END as org_profiles;
EOF
```

All should show ✓ for the app to work properly.
