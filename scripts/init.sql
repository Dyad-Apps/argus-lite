-- Argus IQ Database Initialization Script
-- This runs once when the database is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: RLS (Row Level Security) is enabled per-table in migrations, not here
-- This script only sets up extensions needed by the application
