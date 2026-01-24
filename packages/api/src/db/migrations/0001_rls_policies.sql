-- ============================================================================
-- Row-Level Security (RLS) Policies for Argus IQ
-- ============================================================================
-- These policies enforce multi-tenant isolation at the database level.
-- The application must SET app.current_user_id and app.current_org_id
-- before executing queries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper function to get current user ID from session
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- Helper function to get current organization ID from session
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- Helper function to check if user is member of organization
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = current_user_id()
    AND organization_id = org_id
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Helper function to check if user has admin role in organization
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_org_admin(org_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = current_user_id()
    AND organization_id = org_id
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- USERS TABLE
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (id = current_user_id());

-- Users can read other users in their organizations
CREATE POLICY users_select_org_members ON users
  FOR SELECT
  USING (
    id IN (
      SELECT uo.user_id FROM user_organizations uo
      WHERE uo.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = current_user_id()
      )
    )
  );

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (id = current_user_id())
  WITH CHECK (id = current_user_id());

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can read organizations they belong to
CREATE POLICY organizations_select ON organizations
  FOR SELECT
  USING (is_org_member(id));

-- Only admins can update organizations
CREATE POLICY organizations_update ON organizations
  FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- ============================================================================
-- USER_ORGANIZATIONS TABLE (Membership)
-- ============================================================================
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Users can see memberships in their organizations
CREATE POLICY user_organizations_select ON user_organizations
  FOR SELECT
  USING (is_org_member(organization_id));

-- Only admins can manage memberships
CREATE POLICY user_organizations_insert ON user_organizations
  FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY user_organizations_update ON user_organizations
  FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY user_organizations_delete ON user_organizations
  FOR DELETE
  USING (
    is_org_admin(organization_id)
    OR user_id = current_user_id() -- Users can leave orgs
  );

-- ============================================================================
-- ORGANIZATION_INVITATIONS TABLE
-- ============================================================================
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Users can see invitations in their organizations
CREATE POLICY org_invitations_select ON organization_invitations
  FOR SELECT
  USING (
    is_org_member(organization_id)
    OR email = (SELECT email FROM users WHERE id = current_user_id())
  );

-- Only admins can create invitations
CREATE POLICY org_invitations_insert ON organization_invitations
  FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

-- Only admins can update/cancel invitations
CREATE POLICY org_invitations_update ON organization_invitations
  FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can see projects in their organizations
CREATE POLICY projects_select ON projects
  FOR SELECT
  USING (is_org_member(organization_id));

-- Only admins can manage projects
CREATE POLICY projects_insert ON projects
  FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY projects_update ON projects
  FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY projects_delete ON projects
  FOR DELETE
  USING (is_org_admin(organization_id));

-- ============================================================================
-- ENTITIES TABLE (Core IoT entities)
-- ============================================================================
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Users can see entities in their tenant
CREATE POLICY entities_select ON entities
  FOR SELECT
  USING (is_org_member(tenant_id));

-- Members can create entities (not just admins)
CREATE POLICY entities_insert ON entities
  FOR INSERT
  WITH CHECK (is_org_member(tenant_id));

-- Members can update entities
CREATE POLICY entities_update ON entities
  FOR UPDATE
  USING (is_org_member(tenant_id))
  WITH CHECK (is_org_member(tenant_id));

-- Only admins can delete entities
CREATE POLICY entities_delete ON entities
  FOR DELETE
  USING (is_org_admin(tenant_id));

-- ============================================================================
-- ENTITY_EDGES TABLE (Relationships)
-- ============================================================================
ALTER TABLE entity_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_edges_select ON entity_edges
  FOR SELECT
  USING (is_org_member(tenant_id));

CREATE POLICY entity_edges_insert ON entity_edges
  FOR INSERT
  WITH CHECK (is_org_member(tenant_id));

CREATE POLICY entity_edges_update ON entity_edges
  FOR UPDATE
  USING (is_org_member(tenant_id))
  WITH CHECK (is_org_member(tenant_id));

CREATE POLICY entity_edges_delete ON entity_edges
  FOR DELETE
  USING (is_org_admin(tenant_id));

-- ============================================================================
-- TYPE_DEFINITIONS TABLE
-- ============================================================================
ALTER TABLE type_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY type_definitions_select ON type_definitions
  FOR SELECT
  USING (is_org_member(tenant_id));

-- Only admins can manage type definitions
CREATE POLICY type_definitions_insert ON type_definitions
  FOR INSERT
  WITH CHECK (is_org_admin(tenant_id));

CREATE POLICY type_definitions_update ON type_definitions
  FOR UPDATE
  USING (is_org_admin(tenant_id))
  WITH CHECK (is_org_admin(tenant_id));

CREATE POLICY type_definitions_delete ON type_definitions
  FOR DELETE
  USING (is_org_admin(tenant_id));

-- ============================================================================
-- ROLE_DEFINITIONS TABLE
-- ============================================================================
ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_definitions_select ON role_definitions
  FOR SELECT
  USING (is_org_member(tenant_id));

CREATE POLICY role_definitions_insert ON role_definitions
  FOR INSERT
  WITH CHECK (is_org_admin(tenant_id));

CREATE POLICY role_definitions_update ON role_definitions
  FOR UPDATE
  USING (is_org_admin(tenant_id))
  WITH CHECK (is_org_admin(tenant_id));

CREATE POLICY role_definitions_delete ON role_definitions
  FOR DELETE
  USING (is_org_admin(tenant_id));

-- ============================================================================
-- TELEMETRY_HISTORY TABLE
-- ============================================================================
ALTER TABLE telemetry_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY telemetry_history_select ON telemetry_history
  FOR SELECT
  USING (is_org_member(tenant_id));

-- Allow members to insert telemetry (from devices)
CREATE POLICY telemetry_history_insert ON telemetry_history
  FOR INSERT
  WITH CHECK (is_org_member(tenant_id));

-- No updates or deletes on telemetry (immutable audit trail)

-- ============================================================================
-- SYSTEM_EVENTS TABLE
-- ============================================================================
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_events_select ON system_events
  FOR SELECT
  USING (is_org_member(tenant_id));

CREATE POLICY system_events_insert ON system_events
  FOR INSERT
  WITH CHECK (is_org_member(tenant_id));

CREATE POLICY system_events_update ON system_events
  FOR UPDATE
  USING (is_org_member(tenant_id))
  WITH CHECK (is_org_member(tenant_id));

-- ============================================================================
-- PERMISSION_AUDIT_LOG TABLE
-- ============================================================================
ALTER TABLE permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view permission audit logs
CREATE POLICY permission_audit_log_select ON permission_audit_log
  FOR SELECT
  USING (is_org_admin(tenant_id));

-- System can insert audit logs
CREATE POLICY permission_audit_log_insert ON permission_audit_log
  FOR INSERT
  WITH CHECK (is_org_member(tenant_id));

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own audit logs
CREATE POLICY audit_logs_select_own ON audit_logs
  FOR SELECT
  USING (user_id = current_user_id());

-- Admins can see org audit logs
CREATE POLICY audit_logs_select_org ON audit_logs
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND is_org_admin(organization_id)
  );

-- System can insert audit logs (no user check needed)
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- IDENTITY_PROVIDERS TABLE
-- ============================================================================
ALTER TABLE identity_providers ENABLE ROW LEVEL SECURITY;

-- Users can see providers for their org (or global providers)
CREATE POLICY identity_providers_select ON identity_providers
  FOR SELECT
  USING (
    organization_id IS NULL -- Global providers
    OR is_org_member(organization_id)
  );

-- Only org admins can manage providers
CREATE POLICY identity_providers_insert ON identity_providers
  FOR INSERT
  WITH CHECK (
    organization_id IS NULL -- Global requires superadmin (handled at app level)
    OR is_org_admin(organization_id)
  );

CREATE POLICY identity_providers_update ON identity_providers
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND is_org_admin(organization_id)
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_org_admin(organization_id)
  );

CREATE POLICY identity_providers_delete ON identity_providers
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND is_org_admin(organization_id)
  );

-- ============================================================================
-- USER_IDENTITIES TABLE
-- ============================================================================
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;

-- Users can see their own identities
CREATE POLICY user_identities_select ON user_identities
  FOR SELECT
  USING (user_id = current_user_id());

-- Users can manage their own identities
CREATE POLICY user_identities_insert ON user_identities
  FOR INSERT
  WITH CHECK (user_id = current_user_id());

CREATE POLICY user_identities_update ON user_identities
  FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

CREATE POLICY user_identities_delete ON user_identities
  FOR DELETE
  USING (user_id = current_user_id());

-- ============================================================================
-- REFRESH_TOKENS TABLE
-- ============================================================================
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own tokens
CREATE POLICY refresh_tokens_select ON refresh_tokens
  FOR SELECT
  USING (user_id = current_user_id());

CREATE POLICY refresh_tokens_insert ON refresh_tokens
  FOR INSERT
  WITH CHECK (user_id = current_user_id());

CREATE POLICY refresh_tokens_update ON refresh_tokens
  FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

CREATE POLICY refresh_tokens_delete ON refresh_tokens
  FOR DELETE
  USING (user_id = current_user_id());

-- ============================================================================
-- PASSWORD_RESET_TOKENS TABLE
-- ============================================================================
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own reset tokens
CREATE POLICY password_reset_tokens_select ON password_reset_tokens
  FOR SELECT
  USING (user_id = current_user_id());

-- System handles insert (no RLS check for service account)
CREATE POLICY password_reset_tokens_insert ON password_reset_tokens
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY password_reset_tokens_update ON password_reset_tokens
  FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- ============================================================================
-- Grant usage to application role
-- ============================================================================
-- Note: Run these after creating the application database user
-- GRANT USAGE ON SCHEMA public TO argus_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO argus_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO argus_app;
