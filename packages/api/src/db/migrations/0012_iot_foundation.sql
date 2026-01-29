-- Migration: IoT Platform Foundation
-- Description: Extend existing tables and create new tables for IoT telemetry platform
-- Author: IoT Implementation Team
-- Date: 2026-01-28
-- References: Week_1_Implementation_Tasks.md

-- ============================================================
-- EXTEND EXISTING TABLES
-- ============================================================

-- 1. Extend devices table for IoT-specific fields
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_role TEXT DEFAULT 'endpoint'
    CHECK (device_role IN ('endpoint', 'gateway', 'gateway_chunked', 'rtu_multiport')),
  ADD COLUMN IF NOT EXISTS parent_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS logical_identifier TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS network_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS protocol TEXT DEFAULT 'mqtt';

CREATE INDEX IF NOT EXISTS idx_devices_role ON devices(device_role);
CREATE INDEX IF NOT EXISTS idx_devices_parent ON devices(parent_device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_devices_protocol ON devices(protocol);

COMMENT ON COLUMN devices.device_role IS 'Device role: endpoint (simple device), gateway (aggregates multiple devices), gateway_chunked (sends data in chunks), rtu_multiport (multiple ports)';
COMMENT ON COLUMN devices.parent_device_id IS 'For virtual/logical devices: reference to physical gateway device';
COMMENT ON COLUMN devices.logical_identifier IS 'Unique identifier for virtual devices within a gateway';
COMMENT ON COLUMN devices.network_metadata IS 'Network connection metadata: IP, MAC, certificate info, etc.';

-- 2. Extend assets table for health score tracking
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS health_score_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_score_computed_by TEXT,
  ADD COLUMN IF NOT EXISTS last_telemetry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_assets_health_updated ON assets(health_score_updated_at);
CREATE INDEX IF NOT EXISTS idx_assets_last_telemetry ON assets(last_telemetry_at);

COMMENT ON COLUMN assets.health_score_updated_at IS 'Timestamp when health score was last computed';
COMMENT ON COLUMN assets.health_score_computed_by IS 'Worker version that computed the score (e.g., asset-worker-v1)';
COMMENT ON COLUMN assets.last_telemetry_at IS 'Timestamp of last received telemetry data';

-- 3. Extend asset_types table for telemetry processing configuration
ALTER TABLE asset_types
  ADD COLUMN IF NOT EXISTS metric_definitions JSONB,
  ADD COLUMN IF NOT EXISTS transformation_engine JSONB,
  ADD COLUMN IF NOT EXISTS health_algorithm JSONB,
  ADD COLUMN IF NOT EXISTS threshold_rules JSONB,
  ADD COLUMN IF NOT EXISTS event_rules JSONB,
  ADD COLUMN IF NOT EXISTS aggregation_rules JSONB,
  ADD COLUMN IF NOT EXISTS validation_rules JSONB,
  ADD COLUMN IF NOT EXISTS telemetry_config_version TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS telemetry_config_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS telemetry_config_updated_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_asset_types_config_version
  ON asset_types(telemetry_config_version, telemetry_config_updated_at);

COMMENT ON COLUMN asset_types.metric_definitions IS 'Defines what metrics this asset type tracks (keys, units, data types, ranges)';
COMMENT ON COLUMN asset_types.transformation_engine IS 'Rules for mapping device metrics to asset metrics and computing derived metrics';
COMMENT ON COLUMN asset_types.health_algorithm IS 'Algorithm to compute health score (0-100) from telemetry data';
COMMENT ON COLUMN asset_types.threshold_rules IS 'Warning/critical thresholds with hysteresis and debounce settings';
COMMENT ON COLUMN asset_types.event_rules IS 'Conditions for generating events (alarms, notifications) from telemetry';
COMMENT ON COLUMN asset_types.aggregation_rules IS 'Rules for rolling up child asset metrics to parent assets';
COMMENT ON COLUMN asset_types.validation_rules IS 'Data quality checks and anomaly detection rules';

-- 4. Extend device_types table for processing configuration
ALTER TABLE device_types
  ADD COLUMN IF NOT EXISTS processing_mode TEXT DEFAULT 'endpoint'
    CHECK (processing_mode IN ('endpoint', 'gateway', 'gateway_chunked', 'rtu_multiport')),
  ADD COLUMN IF NOT EXISTS protocol_adapter TEXT DEFAULT 'json',
  ADD COLUMN IF NOT EXISTS message_schema JSONB,
  ADD COLUMN IF NOT EXISTS extraction_rules JSONB,
  ADD COLUMN IF NOT EXISTS demux_strategy JSONB,
  ADD COLUMN IF NOT EXISTS chunking_config JSONB,
  ADD COLUMN IF NOT EXISTS transformation_rules JSONB;

CREATE INDEX IF NOT EXISTS idx_device_types_processing_mode ON device_types(processing_mode);

COMMENT ON COLUMN device_types.processing_mode IS 'How to process messages from this device type';
COMMENT ON COLUMN device_types.protocol_adapter IS 'Protocol parser to use (json, protobuf, modbus, xml)';
COMMENT ON COLUMN device_types.message_schema IS 'JSON Schema or Zod schema for validation';
COMMENT ON COLUMN device_types.extraction_rules IS 'JSONPath expressions for extracting data from payload';
COMMENT ON COLUMN device_types.demux_strategy IS 'Strategy for splitting gateway messages into logical devices';
COMMENT ON COLUMN device_types.chunking_config IS 'Configuration for reassembling chunked messages';

-- ============================================================
-- NEW TABLES FOR TELEMETRY
-- ============================================================

-- Create entity_type enum if not exists
DO $$ BEGIN
  CREATE TYPE entity_type_enum AS ENUM ('Device', 'Asset', 'Person', 'Space', 'Activity');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create quality enum for telemetry
DO $$ BEGIN
  CREATE TYPE telemetry_quality_enum AS ENUM ('good', 'uncertain', 'bad');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Create telemetry_history table (processed, queryable telemetry)
CREATE TABLE IF NOT EXISTS telemetry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Entity reference (Device or Asset)
  entity_id UUID NOT NULL,
  entity_type entity_type_enum NOT NULL,

  -- Metric data
  metric_key TEXT NOT NULL,
  value NUMERIC,
  value_text TEXT,
  value_json JSONB,
  unit TEXT,

  -- Quality indicator
  quality telemetry_quality_enum DEFAULT 'good',

  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source tracking
  source_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  source_message_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for telemetry_history (optimized for time-series queries)
CREATE INDEX IF NOT EXISTS idx_telemetry_entity ON telemetry_history(entity_id, entity_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_tenant ON telemetry_history(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_metric_key ON telemetry_history(metric_key);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_quality ON telemetry_history(quality) WHERE quality != 'good';
CREATE INDEX IF NOT EXISTS idx_telemetry_source_device ON telemetry_history(source_device_id, timestamp DESC);

-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_telemetry_metadata ON telemetry_history USING GIN(metadata);

COMMENT ON TABLE telemetry_history IS 'Processed, queryable telemetry data for devices and assets';
COMMENT ON COLUMN telemetry_history.entity_type IS 'Type of entity this telemetry belongs to (Device or Asset)';
COMMENT ON COLUMN telemetry_history.quality IS 'Data quality indicator: good (normal), uncertain (questionable), bad (invalid)';

-- 6. Create telemetry_raw table (immutable, append-only for audit/replay)
CREATE TABLE IF NOT EXISTS telemetry_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  -- Raw payload as received
  payload JSONB NOT NULL,
  payload_size_bytes INTEGER,

  -- Message metadata for chunked/batched messages
  correlation_id TEXT,
  sequence_number INTEGER,
  total_chunks INTEGER,

  -- Timestamps
  device_timestamp TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source tracking
  ingestion_source TEXT DEFAULT 'mqtt' CHECK (ingestion_source IN ('mqtt', 'http', 'bridge')),
  mqtt_topic TEXT,
  client_id TEXT,

  -- Immutability constraint
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for telemetry_raw
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_device ON telemetry_raw(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_tenant ON telemetry_raw(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_correlation ON telemetry_raw(correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_received ON telemetry_raw(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_ingestion_source ON telemetry_raw(ingestion_source);

COMMENT ON TABLE telemetry_raw IS 'Immutable, append-only raw telemetry for audit trail and replay';
COMMENT ON COLUMN telemetry_raw.correlation_id IS 'For chunked messages: groups chunks belonging to same logical message';
COMMENT ON COLUMN telemetry_raw.ingestion_source IS 'How the message was received: mqtt, http, or bridge';

-- 7. Create telemetry_chunks table (temporary storage for reassembling chunked messages)
CREATE TABLE IF NOT EXISTS telemetry_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  correlation_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,

  chunk_payload JSONB NOT NULL,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),

  CONSTRAINT telemetry_chunks_unique_sequence UNIQUE(correlation_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_chunks_correlation ON telemetry_chunks(correlation_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_chunks_expires ON telemetry_chunks(expires_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_chunks_device ON telemetry_chunks(device_id);

COMMENT ON TABLE telemetry_chunks IS 'Temporary storage for reassembling multi-packet chunked messages (TTL: 60 seconds)';
COMMENT ON COLUMN telemetry_chunks.expires_at IS 'Chunks expire after 60 seconds if not reassembled';

-- 8. Create telemetry_transactions table (tracks atomic processing of logical device batches)
CREATE TABLE IF NOT EXISTS telemetry_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  correlation_id TEXT UNIQUE NOT NULL,
  gateway_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  total_logical_devices INTEGER NOT NULL,
  processed_devices INTEGER DEFAULT 0,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  error_message TEXT,

  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_telemetry_tx_correlation ON telemetry_transactions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_tx_status ON telemetry_transactions(status);
CREATE INDEX IF NOT EXISTS idx_telemetry_tx_gateway ON telemetry_transactions(gateway_device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_tx_started ON telemetry_transactions(started_at);

COMMENT ON TABLE telemetry_transactions IS 'Tracks atomic processing of gateway messages (ensures all devices updated together)';
COMMENT ON COLUMN telemetry_transactions.total_logical_devices IS 'Number of virtual devices in this gateway message';

-- 9. Create threshold_rules table (alerting rules for metrics)
CREATE TABLE IF NOT EXISTS threshold_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Scope: which assets does this rule apply to?
  asset_type_id UUID REFERENCES asset_types(id) ON DELETE CASCADE,
  specific_asset_ids UUID[], -- If null, applies to all assets of type

  -- Rule definition
  metric_key TEXT NOT NULL,
  condition JSONB NOT NULL, -- JSONata expression or simple threshold

  -- Thresholds
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,

  -- Behavior
  hysteresis NUMERIC DEFAULT 0,
  debounce_seconds INTEGER DEFAULT 60,
  cooldown_seconds INTEGER DEFAULT 300,

  -- Event generation
  event_type TEXT NOT NULL,
  event_severity TEXT NOT NULL CHECK (event_severity IN ('info', 'warning', 'critical')),
  event_priority INTEGER DEFAULT 3,
  message_template TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT threshold_rules_org_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_threshold_rules_tenant ON threshold_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threshold_rules_asset_type ON threshold_rules(asset_type_id);
CREATE INDEX IF NOT EXISTS idx_threshold_rules_active ON threshold_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_threshold_rules_metric ON threshold_rules(metric_key);

COMMENT ON TABLE threshold_rules IS 'Alerting rules that trigger events when metric thresholds are breached';
COMMENT ON COLUMN threshold_rules.hysteresis IS 'Amount metric must drop below threshold before clearing alert (prevents flapping)';
COMMENT ON COLUMN threshold_rules.debounce_seconds IS 'Minimum time threshold must be breached before triggering';
COMMENT ON COLUMN threshold_rules.cooldown_seconds IS 'Minimum time between repeat alerts';

-- ============================================================
-- ENHANCE ENTITY_EDGES FOR DEVICE-ASSET LINKS
-- ============================================================

-- Add indices for device-asset link queries
CREATE INDEX IF NOT EXISTS idx_entity_edges_device_asset
  ON entity_edges(source_entity_id, target_entity_id)
  WHERE source_entity_type = 'Device' AND target_entity_type = 'Asset';

CREATE INDEX IF NOT EXISTS idx_entity_edges_asset_device
  ON entity_edges(target_entity_id, source_entity_id)
  WHERE source_entity_type = 'Device' AND target_entity_type = 'Asset';

CREATE INDEX IF NOT EXISTS idx_entity_edges_relationship
  ON entity_edges(relationship_type, valid_from, valid_until);

COMMENT ON INDEX idx_entity_edges_device_asset IS 'Optimizes device → asset link queries';
COMMENT ON INDEX idx_entity_edges_asset_device IS 'Optimizes asset → device link queries';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE telemetry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE threshold_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for telemetry_history
CREATE POLICY telemetry_history_tenant_isolation ON telemetry_history
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for telemetry_raw
CREATE POLICY telemetry_raw_tenant_isolation ON telemetry_raw
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for telemetry_chunks
CREATE POLICY telemetry_chunks_tenant_isolation ON telemetry_chunks
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for telemetry_transactions
CREATE POLICY telemetry_transactions_tenant_isolation ON telemetry_transactions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for threshold_rules
CREATE POLICY threshold_rules_tenant_isolation ON threshold_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for threshold_rules
CREATE TRIGGER threshold_rules_updated_at
  BEFORE UPDATE ON threshold_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for asset_types telemetry config updates
CREATE TRIGGER asset_types_telemetry_config_updated_at
  BEFORE UPDATE ON asset_types
  FOR EACH ROW
  WHEN (
    OLD.metric_definitions IS DISTINCT FROM NEW.metric_definitions OR
    OLD.transformation_engine IS DISTINCT FROM NEW.transformation_engine OR
    OLD.health_algorithm IS DISTINCT FROM NEW.health_algorithm OR
    OLD.threshold_rules IS DISTINCT FROM NEW.threshold_rules OR
    OLD.event_rules IS DISTINCT FROM NEW.event_rules
  )
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GRANTS (Service account for workers)
-- ============================================================

-- Note: Actual service account creation should be done separately
-- These grants assume a 'iot_worker' role exists

-- Grant read/write on telemetry tables
-- GRANT SELECT, INSERT ON telemetry_history TO iot_worker;
-- GRANT SELECT, INSERT ON telemetry_raw TO iot_worker;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON telemetry_chunks TO iot_worker;
-- GRANT SELECT, INSERT, UPDATE ON telemetry_transactions TO iot_worker;

-- Grant read on configuration tables
-- GRANT SELECT ON devices TO iot_worker;
-- GRANT SELECT ON device_types TO iot_worker;
-- GRANT SELECT ON assets TO iot_worker;
-- GRANT SELECT ON asset_types TO iot_worker;
-- GRANT SELECT ON entity_edges TO iot_worker;
-- GRANT SELECT ON threshold_rules TO iot_worker;

-- Grant update on assets (for health score)
-- GRANT UPDATE (health_score, health_score_updated_at, health_score_computed_by, last_telemetry_at) ON assets TO iot_worker;

-- Grant update on devices (for last_seen_at)
-- GRANT UPDATE (last_seen_at, network_metadata) ON devices TO iot_worker;
