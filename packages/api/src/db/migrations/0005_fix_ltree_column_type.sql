-- ============================================================================
-- Fix LTREE Column Type
-- ============================================================================
-- Converts organizations.path from TEXT to LTREE type
-- This is needed because Drizzle ORM creates it as TEXT initially
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Convert path column from TEXT to LTREE if needed
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Check if the column exists and is of type TEXT
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'organizations'
    AND column_name = 'path'
    AND data_type = 'text'
  ) THEN
    -- Convert the column type from TEXT to LTREE
    ALTER TABLE organizations
      ALTER COLUMN path TYPE ltree USING path::ltree;

    RAISE NOTICE 'Converted organizations.path from TEXT to LTREE';
  ELSE
    RAISE NOTICE 'Column organizations.path is already LTREE or does not exist as TEXT';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Ensure LTREE indexes exist
-- ----------------------------------------------------------------------------
-- GiST index for efficient ancestor/descendant queries
CREATE INDEX IF NOT EXISTS idx_organizations_path_gist
  ON organizations USING GIST (path);

-- B-tree index for path ordering and exact matches
CREATE INDEX IF NOT EXISTS idx_organizations_path_btree
  ON organizations USING BTREE (path);

-- ----------------------------------------------------------------------------
-- Verify the conversion
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  path_type TEXT;
BEGIN
  SELECT data_type INTO path_type
  FROM information_schema.columns
  WHERE table_name = 'organizations' AND column_name = 'path';

  IF path_type = 'USER-DEFINED' THEN
    RAISE NOTICE '✅ Success: organizations.path is now LTREE type';
  ELSE
    RAISE WARNING '⚠️  Warning: organizations.path type is %, expected USER-DEFINED (ltree)', path_type;
  END IF;
END $$;
