-- Migration: Add organization_profiles table
-- Description: Organization profiles define capabilities and limits for different organization types

-- Create profile_type enum
CREATE TYPE profile_type AS ENUM ('root', 'child', 'universal');

-- Create organization_profiles table
CREATE TABLE organization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  type profile_type NOT NULL DEFAULT 'universal',
  is_system BOOLEAN NOT NULL DEFAULT false,
  capabilities JSONB DEFAULT '{}'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_organization_profiles_name ON organization_profiles(name);
CREATE INDEX idx_organization_profiles_type ON organization_profiles(type);
CREATE INDEX idx_organization_profiles_active ON organization_profiles(is_active);

-- Add comments
COMMENT ON TABLE organization_profiles IS 'Configuration templates for organizations with defined capabilities and limits';
COMMENT ON COLUMN organization_profiles.type IS 'Profile type: root (root orgs only), child (child orgs only), universal (any org)';
COMMENT ON COLUMN organization_profiles.is_system IS 'System-defined profiles cannot be deleted';
COMMENT ON COLUMN organization_profiles.capabilities IS 'Feature capabilities configuration (JSON)';
COMMENT ON COLUMN organization_profiles.limits IS 'Resource limits configuration (JSON)';
