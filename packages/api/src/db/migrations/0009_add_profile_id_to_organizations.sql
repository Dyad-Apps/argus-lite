-- Migration: Add profile_id column to organizations table
-- Description: Links organizations to organization profiles for capabilities and limits

-- Add profile_id column to organizations table
ALTER TABLE organizations
ADD COLUMN profile_id UUID REFERENCES organization_profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_organizations_profile ON organizations(profile_id);

-- Add comment
COMMENT ON COLUMN organizations.profile_id IS 'Organization profile defining capabilities and limits';
