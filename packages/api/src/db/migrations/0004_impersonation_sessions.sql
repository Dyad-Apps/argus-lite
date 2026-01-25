-- Migration: 0004_impersonation_sessions
-- Description: Create impersonation sessions table for admin user impersonation

-- Create impersonation status enum
DO $$ BEGIN
    CREATE TYPE impersonation_status AS ENUM ('active', 'ended', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create impersonation_sessions table
CREATE TABLE IF NOT EXISTS impersonation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impersonator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status impersonation_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for impersonation_sessions
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_impersonator
    ON impersonation_sessions(impersonator_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target
    ON impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_status
    ON impersonation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_org
    ON impersonation_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_expires
    ON impersonation_sessions(expires_at);

-- Add comment for documentation
COMMENT ON TABLE impersonation_sessions IS 'Tracks admin/support user impersonation sessions for audit and security';
