-- Migration: Phase 7.1 - IoT Meta-Model Base Types & Type System
-- Description: Create 5 base type tables (devices, assets, persons, activities, spaces)
--              and their corresponding type definition tables
-- Author: Phase 7 Implementation Team
-- Date: 2026-01-27

-- ============================================================
-- ENABLE POSTGIS EXTENSION
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- ENUMS
-- ============================================================

-- Device status
CREATE TYPE device_status_enum AS ENUM (
  'active',
  'inactive',
  'maintenance',
  'offline',
  'error'
);

-- Asset status
CREATE TYPE asset_status_enum AS ENUM (
  'active',
  'inactive',
  'maintenance',
  'retired',
  'pending'
);

-- Activity status
CREATE TYPE activity_status_enum AS ENUM (
  'pending',
  'pending_approval',
  'approved',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'failed'
);

-- Activity priority
CREATE TYPE activity_priority_enum AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Activity category
CREATE TYPE activity_category_enum AS ENUM (
  'system_to_system',
  'system_to_person',
  'person_to_system',
  'person_to_person'
);

-- ============================================================
-- TYPE DEFINITION TABLES
-- ============================================================

-- Device Types: Define schemas and presentation for device categories
CREATE TABLE device_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,

  -- Schema definition for custom attributes
  attribute_schema JSONB,

  -- Telemetry schema (what metrics this device type produces)
  telemetry_schema JSONB,

  -- Presentation configuration
  presentation_config JSONB,

  -- Type hierarchy (e.g., "Sensor" → "Temperature Sensor")
  parent_type_id UUID REFERENCES device_types(id) ON DELETE SET NULL,

  -- System types cannot be deleted
  is_system BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT device_types_org_name_unique UNIQUE (organization_id, name)
);

-- Asset Types: Define schemas for physical/logical assets
CREATE TABLE asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,

  attribute_schema JSONB,
  presentation_config JSONB,

  -- Type hierarchy support (e.g., "HVAC" → "Air Conditioner" → "Rooftop AC")
  parent_type_id UUID REFERENCES asset_types(id) ON DELETE SET NULL,

  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT asset_types_org_name_unique UNIQUE (organization_id, name)
);

-- Person Types: Define roles and attributes for people
CREATE TABLE person_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,

  attribute_schema JSONB,
  presentation_config JSONB,

  parent_type_id UUID REFERENCES person_types(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT person_types_org_name_unique UNIQUE (organization_id, name)
);

-- Activity Types: Define workflow templates
CREATE TABLE activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,

  -- Activity classification (4 categories)
  category activity_category_enum NOT NULL,

  -- Workflow configuration
  workflow_definition JSONB,
  requires_approval BOOLEAN DEFAULT false,
  estimated_duration_minutes INTEGER,

  -- Target constraints (which entity types can this apply to?)
  applicable_to_asset_types UUID[],
  applicable_to_device_types UUID[],

  attribute_schema JSONB,
  presentation_config JSONB,

  parent_type_id UUID REFERENCES activity_types(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT activity_types_org_name_unique UNIQUE (organization_id, name)
);

-- Space Types: Define location categories
CREATE TABLE space_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,

  attribute_schema JSONB,
  presentation_config JSONB,

  parent_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT space_types_org_name_unique UNIQUE (organization_id, name)
);

-- ============================================================
-- BASE TYPE TABLES (5 Core Entities)
-- ============================================================

-- 1. DEVICES: IoT hardware that produces telemetry
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_type_id UUID NOT NULL REFERENCES device_types(id) ON DELETE RESTRICT,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  serial_number TEXT,
  model TEXT,
  manufacturer TEXT,
  firmware_version TEXT,

  -- Status
  status device_status_enum NOT NULL DEFAULT 'inactive',
  last_seen_at TIMESTAMPTZ,

  -- Network
  ip_address INET,
  mac_address MACADDR,

  -- Geolocation (for mobile devices)
  geolocation GEOMETRY(Point, 4326),

  -- Customer-extensible attributes
  custom_attributes JSONB DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 2. ASSETS: Physical or logical entities with state
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_type_id UUID NOT NULL REFERENCES asset_types(id) ON DELETE RESTRICT,
  parent_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  serial_number TEXT,
  model TEXT,
  manufacturer TEXT,

  -- Status
  status asset_status_enum NOT NULL DEFAULT 'active',
  health_score NUMERIC(5,2),  -- 0-100 calculated health

  -- Geolocation (for tracking asset position)
  geolocation GEOMETRY(Point, 4326),
  last_location_update TIMESTAMPTZ,

  -- Customer-extensible attributes
  custom_attributes JSONB DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT assets_not_self_parent CHECK (id != parent_asset_id)
);

-- 3. PERSONS: Human actors in the system
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_type_id UUID NOT NULL REFERENCES person_types(id) ON DELETE RESTRICT,

  -- Link to users table (persons must be users)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Core fields
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  department TEXT,

  -- Customer-extensible attributes
  custom_attributes JSONB DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT persons_user_unique UNIQUE (user_id)
);

-- 4. ACTIVITIES: Events, tasks, workflows
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  parent_activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  status activity_status_enum NOT NULL DEFAULT 'pending',
  priority activity_priority_enum NOT NULL DEFAULT 'medium',

  -- WHO/WHAT initiated this activity
  initiator_type TEXT NOT NULL CHECK (
    initiator_type IN ('person', 'system', 'rule', 'alarm')
  ),
  initiator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- WHAT is this activity about (the target)
  target_type TEXT NOT NULL CHECK (
    target_type IN ('asset', 'device', 'space', 'person', 'organization')
  ),
  target_id UUID NOT NULL,

  -- WHO should do it
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_role TEXT,

  -- Scheduling
  due_at TIMESTAMPTZ,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approval_status TEXT CHECK (
    approval_status IN ('pending_approval', 'approved', 'rejected')
  ),
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Completion
  completion_notes TEXT,
  checklist_results JSONB,

  -- Cross-organization support
  owner_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignee_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Customer-extensible attributes
  custom_attributes JSONB DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 5. SPACES: Locations, zones, facilities
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_type_id UUID NOT NULL REFERENCES space_types(id) ON DELETE RESTRICT,
  parent_space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  space_code TEXT,
  floor_level INTEGER,

  -- Physical properties
  area_sqm NUMERIC(10,2),
  capacity INTEGER,

  -- Geospatial (requires PostGIS)
  geolocation GEOMETRY(Point, 4326),
  geofence GEOMETRY(Polygon, 4326),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Customer-extensible attributes
  custom_attributes JSONB DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT spaces_not_self_parent CHECK (id != parent_space_id)
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Type definition table indexes
CREATE INDEX idx_device_types_org ON device_types(organization_id);
CREATE INDEX idx_device_types_parent ON device_types(parent_type_id) WHERE parent_type_id IS NOT NULL;

CREATE INDEX idx_asset_types_org ON asset_types(organization_id);
CREATE INDEX idx_asset_types_parent ON asset_types(parent_type_id) WHERE parent_type_id IS NOT NULL;

CREATE INDEX idx_person_types_org ON person_types(organization_id);
CREATE INDEX idx_activity_types_org ON activity_types(organization_id);
CREATE INDEX idx_activity_types_category ON activity_types(category);
CREATE INDEX idx_space_types_org ON space_types(organization_id);

-- Base type table indexes
-- Devices
CREATE INDEX idx_devices_org_status ON devices(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_type ON devices(device_type_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at) WHERE status = 'active';
CREATE INDEX idx_devices_serial ON devices(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_devices_custom_attrs ON devices USING GIN (custom_attributes);
CREATE INDEX idx_devices_geolocation ON devices USING GIST (geolocation) WHERE geolocation IS NOT NULL;

-- Assets
CREATE INDEX idx_assets_org_status ON assets(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_type ON assets(asset_type_id);
CREATE INDEX idx_assets_parent ON assets(parent_asset_id) WHERE parent_asset_id IS NOT NULL;
CREATE INDEX idx_assets_serial ON assets(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_assets_health ON assets(health_score) WHERE health_score IS NOT NULL;
CREATE INDEX idx_assets_custom_attrs ON assets USING GIN (custom_attributes);
CREATE INDEX idx_assets_geolocation ON assets USING GIST (geolocation) WHERE geolocation IS NOT NULL;

-- Persons
CREATE INDEX idx_persons_org ON persons(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_persons_type ON persons(person_type_id);
CREATE INDEX idx_persons_user ON persons(user_id);
CREATE INDEX idx_persons_email ON persons(email) WHERE email IS NOT NULL;

-- Activities
CREATE INDEX idx_activities_org_status ON activities(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_type ON activities(activity_type_id);
CREATE INDEX idx_activities_parent ON activities(parent_activity_id) WHERE parent_activity_id IS NOT NULL;
CREATE INDEX idx_activities_assigned ON activities(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_activities_initiator ON activities(initiator_user_id) WHERE initiator_user_id IS NOT NULL;
CREATE INDEX idx_activities_target ON activities(target_type, target_id);
CREATE INDEX idx_activities_due ON activities(due_at) WHERE due_at IS NOT NULL AND status IN ('pending', 'in_progress');
CREATE INDEX idx_activities_priority_status ON activities(priority DESC, status) WHERE deleted_at IS NULL;

-- Spaces
CREATE INDEX idx_spaces_org ON spaces(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_spaces_type ON spaces(space_type_id);
CREATE INDEX idx_spaces_parent ON spaces(parent_space_id) WHERE parent_space_id IS NOT NULL;
CREATE INDEX idx_spaces_code ON spaces(space_code) WHERE space_code IS NOT NULL;
CREATE INDEX idx_spaces_geolocation ON spaces USING GIST (geolocation) WHERE geolocation IS NOT NULL;
CREATE INDEX idx_spaces_geofence ON spaces USING GIST (geofence) WHERE geofence IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access data from their organization
-- Type definition tables
CREATE POLICY device_types_org_isolation ON device_types
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

CREATE POLICY asset_types_org_isolation ON asset_types
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

CREATE POLICY person_types_org_isolation ON person_types
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

CREATE POLICY activity_types_org_isolation ON activity_types
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

CREATE POLICY space_types_org_isolation ON space_types
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

-- Base type tables
CREATE POLICY devices_org_isolation ON devices
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

CREATE POLICY assets_org_isolation ON assets
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

CREATE POLICY persons_org_isolation ON persons
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

-- Activities: Allow access to owned activities OR activities assigned to user's org
CREATE POLICY activities_org_isolation ON activities
  FOR ALL
  USING (
    owner_organization_id = current_setting('app.current_organization_id', TRUE)::uuid
    OR assignee_organization_id = current_setting('app.current_organization_id', TRUE)::uuid
  );

CREATE POLICY spaces_org_isolation ON spaces
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE device_types IS 'Type definitions for IoT devices with schema and telemetry configuration';
COMMENT ON TABLE asset_types IS 'Type definitions for physical/logical assets with hierarchical support';
COMMENT ON TABLE person_types IS 'Type definitions for people/roles in the system';
COMMENT ON TABLE activity_types IS 'Workflow templates with approval rules and target constraints';
COMMENT ON TABLE space_types IS 'Type definitions for locations, zones, and facilities';

COMMENT ON TABLE devices IS 'IoT hardware devices that produce telemetry data';
COMMENT ON TABLE assets IS 'Physical or logical assets with hierarchical composition support';
COMMENT ON TABLE persons IS 'Human actors linked to user accounts';
COMMENT ON TABLE activities IS 'Work items, tasks, and workflows with 4-category system';
COMMENT ON TABLE spaces IS 'Hierarchical locations with geospatial support (PostGIS)';

COMMENT ON COLUMN devices.geolocation IS 'PostGIS Point geometry for device location (mobile devices, gateways)';
COMMENT ON COLUMN assets.geolocation IS 'PostGIS Point geometry for asset location (RTLS tracking)';
COMMENT ON COLUMN assets.health_score IS 'Calculated health score 0-100 based on rules and telemetry';
COMMENT ON COLUMN activities.target_type IS 'What entity this activity is about (asset, device, space, person, org)';
COMMENT ON COLUMN activities.initiator_type IS 'Who/what started this activity (person, system, rule, alarm)';
COMMENT ON COLUMN spaces.geofence IS 'PostGIS Polygon geometry for space boundaries';
