-- Migration: Add description column to organizations table
-- Description: Allows organizations to have an optional description field

-- Add description column to organizations table
ALTER TABLE organizations
ADD COLUMN description VARCHAR(1000) DEFAULT NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN organizations.description IS 'Optional description for the organization';
