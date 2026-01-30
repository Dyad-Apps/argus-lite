-- Migration: System Settings Table
-- Description: Centralized system-level configuration managed by SysAdmins
-- Author: Claude
-- Date: 2026-01-29

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('iot', 'mqtt', 'integrations', 'security', 'email', 'storage', 'general')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  is_encrypted BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT system_settings_category_key_unique UNIQUE(category, key)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_category_key ON system_settings(category, key);

-- Ensure existing rows have proper boolean defaults
UPDATE system_settings SET is_public = COALESCE(is_public, false) WHERE is_public IS NULL;
UPDATE system_settings SET is_encrypted = COALESCE(is_encrypted, false) WHERE is_encrypted IS NULL;

-- Note: RLS not enabled as authorization is handled at API level via requireSystemAdmin middleware

-- Insert default IoT settings
INSERT INTO system_settings (category, key, value, description, is_public, updated_by)
VALUES (
  'iot',
  'chirpstack_integration',
  jsonb_build_object(
    'enabled', true,
    'topicPattern', 'application/+/device/+/event/up',
    'description', 'ChirpStack MQTT integration for LoRa devices. Topic pattern supports MQTT wildcards: + (single level), # (multi level).'
  ),
  'ChirpStack MQTT Integration Configuration',
  false,
  NULL
)
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description, is_public, updated_by)
VALUES (
  'mqtt',
  'broker_config',
  jsonb_build_object(
    'brokerUrl', 'mqtt://localhost:1883',
    'qos', 1,
    'keepalive', 60,
    'reconnectPeriod', 5000
  ),
  'MQTT Broker Configuration',
  false,
  NULL
)
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description, is_public, updated_by)
VALUES (
  'iot',
  'processing_config',
  jsonb_build_object(
    'maxMessageSize', 8388608,
    'batchSize', 100,
    'batchTimeout', 1000,
    'validateMessages', true
  ),
  'IoT Message Processing Configuration',
  false,
  NULL
)
ON CONFLICT (category, key) DO NOTHING;

-- Add audit trigger
CREATE OR REPLACE FUNCTION system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_updated_at_trigger
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION system_settings_updated_at();

-- Add comment
COMMENT ON TABLE system_settings IS 'System-level configuration settings managed by SysAdmins through the admin UI';
COMMENT ON COLUMN system_settings.category IS 'Setting category: iot, mqtt, integrations, security, email, storage, general';
COMMENT ON COLUMN system_settings.key IS 'Unique key within category';
COMMENT ON COLUMN system_settings.value IS 'JSON configuration value';
COMMENT ON COLUMN system_settings.is_public IS 'Whether non-admin users can read this setting';
COMMENT ON COLUMN system_settings.is_encrypted IS 'Whether the value contains encrypted secrets';
