-- Migration: Add quota_overrides column to organizations table
-- Description: Allows individual organizations to override limits from their assigned profile

-- Add quota_overrides column to organizations table
ALTER TABLE organizations
ADD COLUMN quota_overrides JSONB DEFAULT NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN organizations.quota_overrides IS 'Organization-specific quota overrides that take precedence over profile limits';
