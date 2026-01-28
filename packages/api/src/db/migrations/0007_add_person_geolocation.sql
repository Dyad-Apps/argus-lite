-- Migration: Add geolocation to persons table
-- Description: Add PostGIS Point geometry column for person location tracking
-- Author: Phase 7 Enhancement
-- Date: 2026-01-28

-- ============================================================
-- ADD GEOLOCATION COLUMN TO PERSONS TABLE
-- ============================================================

-- Add geolocation column (nullable, since existing records won't have location)
ALTER TABLE persons
ADD COLUMN geolocation geometry(Point, 4326);

-- Create spatial index for efficient geospatial queries
CREATE INDEX idx_persons_geolocation ON persons USING GIST (geolocation);

-- Add comment for documentation
COMMENT ON COLUMN persons.geolocation IS 'Person location as PostGIS Point geometry (WGS84, SRID 4326)';
