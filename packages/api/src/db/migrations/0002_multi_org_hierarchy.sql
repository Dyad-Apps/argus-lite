-- ============================================================================
-- Multi-Organization Hierarchy Support
-- ============================================================================
-- Implements ADR-001: Multi-Tenant Model with Unlimited Recursive Trees
-- Implements ADR-002: Subdomain-Based Root Organization Identification
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable LTREE extension for efficient tree queries
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS ltree;

-- ----------------------------------------------------------------------------
-- Add hierarchy columns to organizations table
-- ----------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS org_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parent_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS root_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_root BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS path LTREE,
  ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS can_have_children BOOLEAN NOT NULL DEFAULT false;

-- Update existing organizations to be root organizations
UPDATE organizations
SET
  org_code = UPPER(slug),
  is_root = true,
  root_organization_id = id,
  path = slug::ltree,
  depth = 0,
  can_have_children = true
WHERE org_code IS NULL;

-- Make org_code NOT NULL after backfill
ALTER TABLE organizations ALTER COLUMN org_code SET NOT NULL;

-- ----------------------------------------------------------------------------
-- Add indexes for hierarchy queries
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_root ON organizations(root_organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_org_code ON organizations(org_code);

-- GiST index for LTREE path queries (ancestors, descendants)
CREATE INDEX IF NOT EXISTS idx_organizations_path_gist ON organizations USING GIST (path);

-- B-tree index for path ordering
CREATE INDEX IF NOT EXISTS idx_organizations_path_btree ON organizations USING BTREE (path);

-- Unique index for org_code within root organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_org_code_root
  ON organizations(org_code, root_organization_id);

-- ----------------------------------------------------------------------------
-- Add constraints for hierarchy integrity
-- ----------------------------------------------------------------------------

-- Root organizations must have subdomain, non-root must not
ALTER TABLE organizations ADD CONSTRAINT chk_root_subdomain
  CHECK (
    (is_root = true AND subdomain IS NOT NULL) OR
    (is_root = false AND subdomain IS NULL)
  );

-- Root organizations must reference themselves
ALTER TABLE organizations ADD CONSTRAINT chk_root_self_reference
  CHECK (
    (is_root = true AND root_organization_id = id) OR
    (is_root = false AND root_organization_id IS NOT NULL AND root_organization_id != id)
  );

-- Non-root organizations must have a parent
ALTER TABLE organizations ADD CONSTRAINT chk_non_root_parent
  CHECK (
    (is_root = true AND parent_organization_id IS NULL) OR
    (is_root = false AND parent_organization_id IS NOT NULL)
  );

-- ----------------------------------------------------------------------------
-- Add organization context columns to users table
-- ----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS root_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS primary_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);

-- Make password_hash nullable for SSO-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Remove global unique constraint on email
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Create composite unique index for email per root organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_root
  ON users(email, root_organization_id);

CREATE INDEX IF NOT EXISTS idx_users_root_org ON users(root_organization_id);
CREATE INDEX IF NOT EXISTS idx_users_primary_org ON users(primary_organization_id);

-- ----------------------------------------------------------------------------
-- Update user_organizations table with ADR-aligned fields
-- ----------------------------------------------------------------------------
ALTER TABLE user_organizations
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- Helper function to get root organization ID from session
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_root_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_root_org_id', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- Helper function to check if user belongs to root organization
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_same_root_org(check_root_org_id uuid) RETURNS boolean AS $$
  SELECT check_root_org_id = current_root_org_id();
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- Helper function to get all descendant organization IDs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_descendant_org_ids(org_id uuid) RETURNS SETOF uuid AS $$
  SELECT id FROM organizations
  WHERE path <@ (SELECT path FROM organizations WHERE id = org_id);
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- Helper function to get all ancestor organization IDs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_ancestor_org_ids(org_id uuid) RETURNS SETOF uuid AS $$
  SELECT id FROM organizations
  WHERE (SELECT path FROM organizations WHERE id = org_id) <@ path;
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- Helper function to check if organization is under user's accessible orgs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION user_can_access_org(check_org_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations uo
    JOIN organizations o ON o.id = uo.organization_id
    WHERE uo.user_id = current_user_id()
    AND (
      -- Direct access to the org
      uo.organization_id = check_org_id
      -- Or org is descendant of user's accessible orgs
      OR (SELECT path FROM organizations WHERE id = check_org_id) <@ o.path
    )
    AND (uo.expires_at IS NULL OR uo.expires_at > NOW())
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Update RLS helper function for root organization isolation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations uo
    JOIN organizations o ON o.id = uo.organization_id
    WHERE uo.user_id = current_user_id()
    AND o.root_organization_id = (SELECT root_organization_id FROM organizations WHERE id = org_id)
    AND (
      uo.organization_id = org_id
      OR (SELECT path FROM organizations WHERE id = org_id) <@ o.path
    )
    AND (uo.expires_at IS NULL OR uo.expires_at > NOW())
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Trigger to auto-calculate path and depth on organization insert/update
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_organization_path() RETURNS trigger AS $$
DECLARE
  parent_path LTREE;
BEGIN
  IF NEW.is_root THEN
    NEW.path := NEW.slug::ltree;
    NEW.depth := 0;
    NEW.root_organization_id := NEW.id;
  ELSE
    SELECT path INTO parent_path FROM organizations WHERE id = NEW.parent_organization_id;
    NEW.path := parent_path || NEW.slug::ltree;
    NEW.depth := nlevel(NEW.path);

    -- Inherit root_organization_id from parent
    SELECT root_organization_id INTO NEW.root_organization_id
    FROM organizations WHERE id = NEW.parent_organization_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organization_path ON organizations;
CREATE TRIGGER trg_organization_path
  BEFORE INSERT OR UPDATE OF parent_organization_id, is_root, slug
  ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_path();

-- ----------------------------------------------------------------------------
-- Trigger to ensure only one primary organization per user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_single_primary_org() RETURNS trigger AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE user_organizations
    SET is_primary = false
    WHERE user_id = NEW.user_id
    AND organization_id != NEW.organization_id
    AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_primary_org ON user_organizations;
CREATE TRIGGER trg_single_primary_org
  AFTER INSERT OR UPDATE OF is_primary
  ON user_organizations
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_org();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON COLUMN organizations.org_code IS 'Human-readable code for tenant switching UI (e.g., WALMART, REGION-NE). NOT used for login.';
COMMENT ON COLUMN organizations.path IS 'LTREE path for efficient tree queries. Format: root.child.grandchild';
COMMENT ON COLUMN organizations.is_root IS 'True for top-level root organizations. Root orgs have subdomains and isolate all data.';
COMMENT ON COLUMN organizations.root_organization_id IS 'Reference to root organization. All data isolation uses this field.';
COMMENT ON COLUMN users.root_organization_id IS 'The root organization this user belongs to. Same email can exist across different roots.';
COMMENT ON COLUMN users.primary_organization_id IS 'Default organization after login. Must be within root org hierarchy.';
COMMENT ON COLUMN user_organizations.is_primary IS 'True if this is the users default organization after login.';
COMMENT ON COLUMN user_organizations.expires_at IS 'Optional expiration for time-limited access (e.g., contractor access).';
