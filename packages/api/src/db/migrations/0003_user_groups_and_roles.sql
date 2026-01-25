-- ============================================================================
-- User Groups and Roles RBAC System
-- ============================================================================
-- Creates tables for group-based user organization and role-based access control
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Create role scope enum
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE role_scope AS ENUM ('organization', 'children', 'tree');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- Create role source enum
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE role_source AS ENUM ('direct', 'group', 'sso', 'inherited');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- User Groups table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for user_groups
CREATE INDEX IF NOT EXISTS idx_user_groups_org ON user_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_name ON user_groups(name);

-- Unique constraint: name must be unique within organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_groups_org_name ON user_groups(organization_id, name);

-- ----------------------------------------------------------------------------
-- User Group Memberships junction table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_group_memberships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, group_id)
);

-- Indexes for user_group_memberships
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_user ON user_group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_group ON user_group_memberships(group_id);

-- ----------------------------------------------------------------------------
-- Roles table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  default_scope role_scope NOT NULL DEFAULT 'organization',
  permissions JSONB DEFAULT '{"resources": [], "menuAccess": []}'::jsonb,
  priority VARCHAR(10) NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for roles
CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_system ON roles(is_system);

-- Unique constraint: role name must be unique within organization (or globally for system roles)
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_org_name ON roles(organization_id, name) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_system_name ON roles(name) WHERE organization_id IS NULL AND is_system = true;

-- ----------------------------------------------------------------------------
-- User Role Assignments table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_role_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope role_scope,
  source role_source NOT NULL DEFAULT 'direct',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, role_id, organization_id)
);

-- Indexes for user_role_assignments
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_org ON user_role_assignments(organization_id);

-- ----------------------------------------------------------------------------
-- Group Role Assignments table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_role_assignments (
  group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope role_scope,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, role_id)
);

-- Indexes for group_role_assignments
CREATE INDEX IF NOT EXISTS idx_group_role_assignments_group ON group_role_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_group_role_assignments_role ON group_role_assignments(role_id);

-- ----------------------------------------------------------------------------
-- Seed System Roles
-- ----------------------------------------------------------------------------
INSERT INTO roles (name, description, is_system, default_scope, permissions, priority)
VALUES
  ('Owner', 'Full access to all organization resources and settings', true, 'tree',
   '{"resources": [{"resource": "*", "actions": ["create", "read", "update", "delete"]}], "menuAccess": ["*"]}'::jsonb, '100'),
  ('Admin', 'Administrative access to organization resources', true, 'tree',
   '{"resources": [{"resource": "*", "actions": ["create", "read", "update", "delete"]}], "menuAccess": ["*"]}'::jsonb, '80'),
  ('Member', 'Standard access to organization resources', true, 'organization',
   '{"resources": [{"resource": "organizations", "actions": ["read"]}, {"resource": "users", "actions": ["read"]}, {"resource": "groups", "actions": ["read"]}], "menuAccess": ["dashboard", "organizations", "users"]}'::jsonb, '40'),
  ('Viewer', 'Read-only access to organization resources', true, 'organization',
   '{"resources": [{"resource": "organizations", "actions": ["read"]}, {"resource": "users", "actions": ["read"]}], "menuAccess": ["dashboard"]}'::jsonb, '20')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE user_groups IS 'User groups for organizing users within organizations';
COMMENT ON TABLE user_group_memberships IS 'Junction table linking users to groups';
COMMENT ON TABLE roles IS 'Role definitions including system roles and custom organization roles';
COMMENT ON TABLE user_role_assignments IS 'Direct role assignments to users';
COMMENT ON TABLE group_role_assignments IS 'Role assignments to groups (inherited by group members)';
COMMENT ON COLUMN roles.organization_id IS 'NULL for system roles, organization ID for custom roles';
COMMENT ON COLUMN roles.is_system IS 'System roles cannot be modified or deleted';
COMMENT ON COLUMN roles.default_scope IS 'Default scope for role assignments';
COMMENT ON COLUMN user_role_assignments.source IS 'How the role was assigned (direct, group, sso, inherited)';
