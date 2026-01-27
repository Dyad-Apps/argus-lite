# Phase 7: UI Navigation Structure Analysis

> **Date:** January 27, 2026
> **Source:** C:\source\paas (New Mock UI)
> **Purpose:** Analyze Asset Hub and CMMS navigation to validate Phase 7 architecture

---

## Executive Summary

The new mock UI (C:\source\paas) reveals a comprehensive navigation structure that has **significant implications for Phase 7 architecture**. The Asset Hub now includes **7 sub-sections**, and a new **CMMS module** with **4 sub-sections** that directly maps to Activities.

### Key Findings

✅ **Asset Hub alignment**: 85% architecture coverage
⚠️ **New features identified**: Asset Profiles, Group Triggers require schema additions
🆕 **CMMS module**: Maps directly to Activity workflows (Phase 7.3+)
📋 **IoT Hub**: 11 sub-sections for future phases (Phase 8+)

---

## Full Navigation Structure (Root Tenant)

### Main Navigation (16 Top-Level Items)

```
1.  Home
2.  Ask Argus
3.  Solutions
    └─ Smart City
    └─ Industrial
4.  Dashboards
5.  Asset Hub ⭐ (PHASE 7 FOCUS)
    ├─ Assets
    ├─ Asset Types
    ├─ Asset Profiles
    ├─ Asset Groups
    ├─ Templates
    ├─ Group Triggers
    └─ Alarms & Events
6.  CMMS ⭐ (PHASE 7.3+ - Activity-based)
    ├─ Work Orders
    ├─ PM Schedule
    ├─ Requests
    └─ Parts Inventory
7.  IoT Hub (PHASE 8+)
    ├─ Devices
    ├─ Gateways
    ├─ Edge
    ├─ Location Hubs
    ├─ RTLS Infra
    ├─ OTA Center
    ├─ Converters
    ├─ Integrations
    ├─ Usage
    ├─ Global Triggers
    └─ Alarms
8.  Customer Hub
    ├─ Customers
    └─ Customer Profiles
9.  Spaces
10. Solution Templates
11. KPI
12. Reports
13. Tickets
14. Notifications
15. Users
16. Knowledge Base
17. Studio
    ├─ DashMaker
    ├─ Rule Engine
    └─ Data Explorer
18. Logs
19. Billing & Plans
    ├─ Provider Setup
    ├─ Retail Plans
    └─ Customer Billing
```

### Bottom Navigation (3 Sections)

```
1. Partner Portal
   ├─ Partner
   └─ Partner Profile
2. Admin Console
   ├─ Security
   ├─ White Labeling
   └─ Audit Log
3. Help Center
   ├─ Documentation
   └─ Report an Issue
4. Settings
```

---

## Asset Hub Deep Dive

### Current UI Structure

```typescript
const AssetHubItem = {
    title: "Asset Hub",
    path: "/org/asset-hub",
    icon: Layers,
    children: [
      { title: "Assets", path: "/org/asset-hub/assets", icon: Box },
      { title: "Asset Types", path: "/org/asset-hub/types", icon: Tags },
      { title: "Asset Profiles", path: "/org/asset-hub/profiles", icon: SlidersHorizontal },
      { title: "Asset Groups", path: "/org/asset-hub/groups", icon: Folder },
      { title: "Templates", path: "/org/asset-hub/templates", icon: LayoutTemplate },
      { title: "Group Triggers", path: "/org/asset-hub/triggers", icon: Zap },
      { title: "Alarms & Events", path: "/org/asset-hub/alarms", icon: AlertTriangle },
    ]
};
```

### Phase 7 Architecture Coverage

| UI Feature | Phase 7 Coverage | Status | Notes |
|------------|------------------|--------|-------|
| **Assets** | ✅ Full | Phase 7.1 | `assets` table with hierarchy |
| **Asset Types** | ✅ Full | Phase 7.1 | `asset_types` table |
| **Asset Profiles** | ⚠️ Partial | **NEW REQUIREMENT** | Needs `asset_profiles` table |
| **Asset Groups** | ✅ Full | Phase 7.2 | `asset_groups` table (already in arch) |
| **Templates** | ✅ Full | Phase 7.1 | `asset_types` with `is_template` flag |
| **Group Triggers** | ⚠️ Partial | **NEW REQUIREMENT** | Needs `group_triggers` table |
| **Alarms & Events** | ✅ Full | Phase 7.3 | `alarms` table |

---

## NEW REQUIREMENT 1: Asset Profiles

### What Are Asset Profiles?

**Asset Profiles are BEHAVIOR POLICIES** that configure how assets interact with devices, spaces, and telemetry. They are NOT just default values - they enforce business rules and system behavior.

**Key Concept:** Asset Profiles = **Configuration + Constraints + Behavior Rules**

### Asset Profile Configuration (4 Tabs)

Based on UI mockups, Asset Profiles have 4 configuration areas:

#### 1. Basic Configuration
- **Profile Name**: "HVAC Equipment Profile"
- **Description**: "For HVAC systems with multiple sensors and controls"
- **Asset Type Restriction**: Can be limited to specific asset types
- **Set as Default**: Auto-apply to new assets of selected types

#### 2. Device Configuration 🔑
Controls device-asset relationships:
- **Device Mode**: Template (use predefined dashboard) vs Custom
- **Dashboard Template**: Which template to display for this asset
- **Max Devices Per Asset**: Limit (0 = unlimited, 1 = single device)
- **Enforce 1:1 Device Binding**: If enabled, device can only link to ONE asset at a time

**Example:** "High-Security Asset Profile" with 1:1 binding prevents device sharing

#### 3. Location Configuration 🔑
Controls location tracking behavior:
- **Location Mode**: Tracked (real-time), Static, Virtual
- **Require Space Assignment**: Asset MUST be placed in a space
- **Inherit Space from Linked Device**: Auto-sync location from device
- **Enable RTLS Tracking**: Enable indoor positioning system

**Example:** "Mobile Asset Profile" with RTLS enabled tracks forklifts in warehouse

#### 4. Telemetry Configuration 🔑
Controls telemetry behavior:
- **Aggregate Telemetry from Devices**: Combine data from multiple linked devices
- **Telemetry Retention (days)**: Override default retention (e.g., 30 days)
- **Inherit Alarms from Devices**: Copy device alarm rules to asset level

**Example:** "Critical Asset Profile" with 90-day retention for compliance

### Complete Schema

```sql
CREATE TABLE asset_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Basic
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,

  -- Applicable asset types (can apply to multiple types)
  applicable_asset_type_ids UUID[],  -- Array of asset_type IDs

  -- Device Configuration
  device_mode TEXT CHECK (device_mode IN ('template', 'custom')),
  dashboard_template_id UUID,  -- References dashboard template
  max_devices_per_asset INTEGER DEFAULT 0,  -- 0 = unlimited
  enforce_1to1_device_binding BOOLEAN DEFAULT false,

  -- Location Configuration
  location_mode TEXT CHECK (
    location_mode IN ('tracked', 'static', 'virtual', 'inherited')
  ),
  require_space_assignment BOOLEAN DEFAULT false,
  inherit_space_from_device BOOLEAN DEFAULT false,
  enable_rtls_tracking BOOLEAN DEFAULT false,

  -- Telemetry Configuration
  aggregate_telemetry_from_devices BOOLEAN DEFAULT false,
  telemetry_retention_days INTEGER DEFAULT 30,
  inherit_alarms_from_devices BOOLEAN DEFAULT false,

  -- Legacy/Extended Configuration (from custom_attributes)
  default_attributes JSONB DEFAULT '{}',
  health_scoring_config JSONB,
  alarm_thresholds JSONB,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT asset_profiles_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX idx_asset_profiles_org ON asset_profiles(organization_id);
CREATE INDEX idx_asset_profiles_applicable_types ON asset_profiles USING GIN (applicable_asset_type_ids);
CREATE INDEX idx_asset_profiles_default ON asset_profiles(is_default) WHERE is_default = true;

-- Link assets to profiles
ALTER TABLE assets
  ADD COLUMN asset_profile_id UUID REFERENCES asset_profiles(id);

CREATE INDEX idx_assets_profile ON assets(asset_profile_id) WHERE asset_profile_id IS NOT NULL;
```

### Behavior Enforcement Examples

#### Example 1: 1:1 Device Binding Enforcement

```typescript
// Attempting to link a device that's already linked elsewhere
async function linkDeviceToAsset(
  deviceId: string,
  assetId: string,
  relationshipType: string
) {
  // Get asset's profile
  const asset = await db.query(
    'SELECT asset_profile_id FROM assets WHERE id = $1',
    [assetId]
  );

  const profile = await db.query(
    'SELECT enforce_1to1_device_binding, max_devices_per_asset FROM asset_profiles WHERE id = $1',
    [asset.asset_profile_id]
  );

  // Check 1:1 binding constraint
  if (profile.enforce_1to1_device_binding) {
    const existingLink = await db.query(
      'SELECT asset_id FROM asset_device_links WHERE device_id = $1',
      [deviceId]
    );

    if (existingLink.rows.length > 0) {
      throw new Error(
        `Device ${deviceId} is already linked to asset ${existingLink.rows[0].asset_id}. ` +
        `Profile "${profile.name}" enforces 1:1 device binding.`
      );
    }
  }

  // Check max devices constraint
  if (profile.max_devices_per_asset > 0) {
    const deviceCount = await db.query(
      'SELECT COUNT(*) FROM asset_device_links WHERE asset_id = $1',
      [assetId]
    );

    if (deviceCount.rows[0].count >= profile.max_devices_per_asset) {
      throw new Error(
        `Asset ${assetId} already has ${profile.max_devices_per_asset} devices. ` +
        `Profile "${profile.name}" limits max devices.`
      );
    }
  }

  // All checks passed, create link
  return await db.insert(asset_device_links).values({
    asset_id: assetId,
    device_id: deviceId,
    relationship_type: relationshipType
  });
}
```

#### Example 2: Space Assignment Requirement

```typescript
// Creating an asset with a profile that requires space assignment
async function createAsset(data: CreateAssetRequest) {
  const profile = await db.query(
    'SELECT require_space_assignment FROM asset_profiles WHERE id = $1',
    [data.asset_profile_id]
  );

  // Enforce space requirement
  if (profile.require_space_assignment && !data.space_id) {
    throw new Error(
      `Profile "${profile.name}" requires space assignment. Please specify a space.`
    );
  }

  // Create asset
  const asset = await db.insert(assets).values(data).returning();

  // If space provided, create space_assets link
  if (data.space_id) {
    await db.insert(space_assets).values({
      space_id: data.space_id,
      asset_id: asset.id
    });
  }

  return asset;
}
```

#### Example 3: RTLS Tracking Enablement

```typescript
// When a device reports location for an asset
async function updateAssetLocation(
  assetId: string,
  latitude: number,
  longitude: number,
  deviceId: string
) {
  const asset = await db.query(`
    SELECT a.*, p.enable_rtls_tracking, p.inherit_space_from_device
    FROM assets a
    JOIN asset_profiles p ON p.id = a.asset_profile_id
    WHERE a.id = $1
  `, [assetId]);

  // Check if RTLS tracking is enabled in profile
  if (!asset.enable_rtls_tracking) {
    console.log(`RTLS tracking disabled for asset ${assetId} by profile`);
    return;
  }

  // Update asset location
  await db.query(`
    UPDATE assets
    SET geolocation = ST_SetSRID(ST_MakePoint($1, $2), 4326),
        last_location_update = NOW()
    WHERE id = $3
  `, [longitude, latitude, assetId]);

  // If profile says inherit space, find space containing this location
  if (asset.inherit_space_from_device) {
    const space = await db.query(`
      SELECT id FROM spaces
      WHERE ST_Contains(geofence, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      LIMIT 1
    `, [longitude, latitude]);

    if (space.rows.length > 0) {
      // Update space assignment
      await db.query(`
        INSERT INTO space_assets (space_id, asset_id)
        VALUES ($1, $2)
        ON CONFLICT (space_id, asset_id) DO NOTHING
      `, [space.rows[0].id, assetId]);
    }
  }
}
```

#### Example 4: Telemetry Aggregation

```typescript
// When querying telemetry for an asset
async function getAssetTelemetry(
  assetId: string,
  metricName: string,
  startDate: Date,
  endDate: Date
) {
  const asset = await db.query(`
    SELECT a.*, p.aggregate_telemetry_from_devices, p.telemetry_retention_days
    FROM assets a
    JOIN asset_profiles p ON p.id = a.asset_profile_id
    WHERE a.id = $1
  `, [assetId]);

  // Check if data is within retention period
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - asset.telemetry_retention_days);

  if (startDate < retentionCutoff) {
    throw new Error(
      `Telemetry data older than ${asset.telemetry_retention_days} days ` +
      `has been purged per profile policy`
    );
  }

  // If aggregation enabled, combine data from all linked devices
  if (asset.aggregate_telemetry_from_devices) {
    return await db.query(`
      SELECT
        t.timestamp,
        AVG(t.value) as avg_value,
        MIN(t.value) as min_value,
        MAX(t.value) as max_value,
        COUNT(*) as device_count
      FROM telemetry t
      JOIN asset_device_links adl ON adl.device_id = t.device_id
      WHERE adl.asset_id = $1
      AND t.metric_name = $2
      AND t.timestamp BETWEEN $3 AND $4
      GROUP BY t.timestamp
      ORDER BY t.timestamp ASC
    `, [assetId, metricName, startDate, endDate]);
  } else {
    // Return individual device telemetry
    return await db.query(`
      SELECT
        t.timestamp,
        t.value,
        t.device_id,
        d.name as device_name
      FROM telemetry t
      JOIN asset_device_links adl ON adl.device_id = t.device_id
      JOIN devices d ON d.id = t.device_id
      WHERE adl.asset_id = $1
      AND t.metric_name = $2
      AND t.timestamp BETWEEN $3 AND $4
      ORDER BY t.timestamp ASC
    `, [assetId, metricName, startDate, endDate]);
  }
}
```

### Workflow: Creating Assets with Profiles

```typescript
// 1. Create profile for HVAC equipment
const hvacProfile = await createAssetProfile({
  name: "HVAC Equipment Profile",
  description: "For HVAC systems with multiple sensors and controls",
  applicable_asset_type_ids: [
    hvacTypeId,
    airConditionerTypeId,
    heaterTypeId,
    ventilationTypeId
  ],

  // Device config
  device_mode: "template",
  dashboard_template_id: hvacDashboardTemplateId,
  max_devices_per_asset: 0,  // Unlimited
  enforce_1to1_device_binding: false,

  // Location config
  location_mode: "static",
  require_space_assignment: true,
  inherit_space_from_device: false,
  enable_rtls_tracking: false,

  // Telemetry config
  aggregate_telemetry_from_devices: true,
  telemetry_retention_days: 30,
  inherit_alarms_from_devices: true,

  is_default: true
});

// 2. Create assets using this profile
const rooftopAC = await createAsset({
  name: "Rooftop AC Unit #1",
  asset_type_id: airConditionerTypeId,
  asset_profile_id: hvacProfile.id,  // Inherit all behavior
  space_id: rooftopSpaceId,  // Required by profile
  serial_number: "AC-2024-001"
});

// 3. Link devices to asset
await linkDeviceToAsset(tempSensorDevice.id, rooftopAC.id, "monitors");
await linkDeviceToAsset(humiditySensorDevice.id, rooftopAC.id, "monitors");
await linkDeviceToAsset(compressorControlDevice.id, rooftopAC.id, "controls");

// Profile automatically:
// - Aggregates telemetry from all 3 devices
// - Enforces 30-day retention
// - Inherits alarm rules from devices
// - Uses HVAC dashboard template
```

---

## NEW REQUIREMENT 2: Group Triggers

### What Are Group Triggers?

**Group Triggers** are rules that execute actions when conditions are met **across a group of assets**, not just individual assets.

**Example Scenarios:**
- **Fleet-wide threshold**: Alert if >30% of pumps in a group exceed temperature threshold
- **Aggregate capacity**: Trigger when total capacity of all chillers in a building drops below 80%
- **Cascading failures**: Detect patterns (3+ pumps failing in sequence within 1 hour)
- **Load balancing**: Automatically redistribute load when group utilization > 85%

### Proposed Schema

```sql
CREATE TABLE group_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  name TEXT NOT NULL,
  description TEXT,

  -- Target group
  asset_group_id UUID NOT NULL REFERENCES asset_groups(id),

  -- Trigger condition (evaluated against group aggregates)
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN (
      'percentage_threshold',  -- X% of assets meet condition
      'count_threshold',       -- N assets meet condition
      'aggregate_metric',      -- SUM/AVG/MIN/MAX of metric across group
      'pattern_detection'      -- Temporal pattern (e.g., 3 failures in 1 hour)
    )
  ),

  condition_config JSONB NOT NULL,

  -- Actions to execute when triggered
  actions JSONB NOT NULL,  -- Array of actions (create_alarm, send_notification, etc.)

  -- State
  enabled BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,

  -- Cooldown (prevent trigger spam)
  cooldown_minutes INTEGER DEFAULT 15,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_triggers_org ON group_triggers(organization_id);
CREATE INDEX idx_group_triggers_group ON group_triggers(asset_group_id);
CREATE INDEX idx_group_triggers_enabled ON group_triggers(enabled) WHERE enabled = true;

-- Trigger execution history
CREATE TABLE group_trigger_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_trigger_id UUID NOT NULL REFERENCES group_triggers(id) ON DELETE CASCADE,

  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Snapshot of group state at trigger time
  group_state JSONB NOT NULL,  -- Which assets triggered, metric values, etc.

  -- Actions taken
  actions_executed JSONB NOT NULL,

  -- Results
  execution_status TEXT NOT NULL CHECK (
    execution_status IN ('success', 'partial_failure', 'failure')
  ),
  execution_errors JSONB
);

CREATE INDEX idx_group_trigger_execs_trigger ON group_trigger_executions(group_trigger_id);
CREATE INDEX idx_group_trigger_execs_triggered_at ON group_trigger_executions(triggered_at);
```

### Group Trigger Examples

#### Example 1: Percentage Threshold

```json
{
  "name": "Critical Pump Failure Alert",
  "asset_group_id": "group_cooling_tower_pumps",
  "trigger_type": "percentage_threshold",
  "condition_config": {
    "metric": "status",
    "operator": "equals",
    "value": "offline",
    "percentage_threshold": 30,
    "evaluation_window": "5m"
  },
  "actions": [
    {
      "type": "create_alarm",
      "severity": "critical",
      "message": "{{percentage}}% of cooling tower pumps are offline ({{count}}/{{total}})"
    },
    {
      "type": "send_notification",
      "channels": ["email", "sms"],
      "recipients": ["facility_manager", "on_duty_operator"]
    },
    {
      "type": "create_activity",
      "activity_type": "investigate_group_failure",
      "category": "system_to_person",
      "priority": "critical"
    }
  ],
  "cooldown_minutes": 30
}
```

#### Example 2: Aggregate Metric

```json
{
  "name": "Building Cooling Capacity Low",
  "asset_group_id": "group_building_a_chillers",
  "trigger_type": "aggregate_metric",
  "condition_config": {
    "aggregation": "sum",
    "metric": "cooling_capacity_tons",
    "operator": "<",
    "threshold": 80,
    "threshold_type": "percentage_of_rated"
  },
  "actions": [
    {
      "type": "create_alarm",
      "severity": "high",
      "message": "Building A total cooling capacity at {{value}}% ({{current_tons}}/{{rated_tons}} tons)"
    },
    {
      "type": "execute_device_command",
      "device_id": "{{backup_chiller_device_id}}",
      "command": "start"
    }
  ],
  "cooldown_minutes": 15
}
```

#### Example 3: Pattern Detection

```json
{
  "name": "Cascading Pump Failures",
  "asset_group_id": "group_hydraulic_system_pumps",
  "trigger_type": "pattern_detection",
  "condition_config": {
    "pattern": "sequential_failures",
    "failure_count": 3,
    "time_window": "1h",
    "metric": "status",
    "failure_value": "offline"
  },
  "actions": [
    {
      "type": "create_alarm",
      "severity": "critical",
      "message": "Cascading failure detected: {{count}} pumps failed within {{time_window}}"
    },
    {
      "type": "create_activity",
      "activity_type": "emergency_system_inspection",
      "category": "system_to_person",
      "priority": "critical",
      "custom_attributes": {
        "pattern_detected": "cascading_failure",
        "affected_assets": "{{failed_asset_ids}}"
      }
    }
  ],
  "cooldown_minutes": 60
}
```

### Group Trigger Evaluation Engine

```typescript
// Pseudo-code for evaluation engine
async function evaluateGroupTriggers() {
  const activeTriggers = await db.query(
    'SELECT * FROM group_triggers WHERE enabled = true'
  );

  for (const trigger of activeTriggers) {
    // Check cooldown
    if (isInCooldown(trigger)) continue;

    // Get current group state
    const groupState = await getGroupState(trigger.asset_group_id);

    // Evaluate condition
    const triggered = evaluateCondition(trigger, groupState);

    if (triggered) {
      // Execute actions
      await executeActions(trigger.actions, {
        groupState,
        triggerId: trigger.id
      });

      // Update trigger state
      await db.query(`
        UPDATE group_triggers
        SET last_triggered_at = NOW(),
            trigger_count = trigger_count + 1
        WHERE id = $1
      `, [trigger.id]);

      // Log execution
      await db.insert(group_trigger_executions).values({
        group_trigger_id: trigger.id,
        group_state: groupState,
        actions_executed: trigger.actions,
        execution_status: 'success'
      });
    }
  }
}

// Run every 30 seconds
setInterval(evaluateGroupTriggers, 30000);
```

---

## CMMS Module → Activity Mapping

### CMMS Navigation Structure

```typescript
const CMmsItem = {
    title: "CMMS",
    path: "/org/cmms",
    icon: Wrench,
    children: [
      { title: "Work Orders", path: "/org/cmms/work-orders", icon: ClipboardList },
      { title: "PM Schedule", path: "/org/cmms/pm-schedule", icon: Calendar },
      { title: "Requests", path: "/org/cmms/requests", icon: MessageSquare },
      { title: "Parts Inventory", path: "/org/cmms/parts", icon: Package },
    ]
};
```

### How CMMS Maps to Activities

**CMMS is a specialized UI for Activity Management**, where activities are filtered by category and displayed in domain-specific views.

| CMMS Feature | Activity Mapping | Implementation |
|--------------|------------------|----------------|
| **Work Orders** | Activities with `category = 'person_to_person'` or `'person_to_system'` | Filter: `activity_type IN (maintenance, repair, inspection)` |
| **PM Schedule** | Recurring activities from `activity_schedules` | Show scheduled maintenance activities |
| **Requests** | Activities with `category = 'person_to_person'` AND `status = 'pending_approval'` | Maintenance requests awaiting approval |
| **Parts Inventory** | **NEW ENTITY** (not an activity) | Separate `parts_inventory` table |

### Work Orders Implementation

```typescript
// Work Orders page = Filtered Activity List
async function getWorkOrders(organizationId: string, filters?: WorkOrderFilters) {
  return await db.query(`
    SELECT
      a.*,
      at.name as activity_type_name,
      u.name as assigned_to_name,
      CASE a.target_type
        WHEN 'asset' THEN (SELECT name FROM assets WHERE id = a.target_id)
        WHEN 'device' THEN (SELECT name FROM devices WHERE id = a.target_id)
        WHEN 'space' THEN (SELECT name FROM spaces WHERE id = a.target_id)
      END as target_name
    FROM activities a
    JOIN activity_types at ON at.id = a.activity_type_id
    LEFT JOIN users u ON u.id = a.assigned_to_user_id
    WHERE a.organization_id = $1
    AND at.category IN ('person_to_person', 'person_to_system')
    AND at.name IN ('maintenance', 'repair', 'inspection', 'calibration', 'installation')
    AND a.status IN ('pending', 'in_progress', 'approved')
    ORDER BY a.priority DESC, a.due_at ASC
  `, [organizationId]);
}

// Work Order detail = Activity detail with CMMS-specific presentation
// Create Work Order = Create Activity with specific activity_type
// Complete Work Order = Update Activity status to 'completed'
```

### PM Schedule Implementation

```typescript
// PM Schedule page = activity_schedules view
async function getPMSchedule(organizationId: string) {
  return await db.query(`
    SELECT
      s.*,
      at.name as activity_type_name,
      CASE s.target_type
        WHEN 'asset' THEN (SELECT name FROM assets WHERE id = s.target_id)
        WHEN 'device' THEN (SELECT name FROM devices WHERE id = s.target_id)
      END as target_name,
      COUNT(a.id) as completed_count,
      MAX(a.completed_at) as last_completed_at
    FROM activity_schedules s
    JOIN activity_types at ON at.id = s.activity_type_id
    LEFT JOIN activities a ON a.parent_activity_id = s.id AND a.status = 'completed'
    WHERE s.organization_id = $1
    AND s.enabled = true
    GROUP BY s.id, at.name
    ORDER BY s.next_occurrence ASC
  `, [organizationId]);
}
```

### Maintenance Requests Implementation

```typescript
// Maintenance Requests = Activities awaiting approval
async function getMaintenanceRequests(organizationId: string) {
  return await db.query(`
    SELECT
      a.*,
      at.name as activity_type_name,
      u_initiator.name as requested_by_name,
      u_approver.name as approver_name
    FROM activities a
    JOIN activity_types at ON at.id = a.activity_type_id
    LEFT JOIN users u_initiator ON u_initiator.id = a.initiator_user_id
    LEFT JOIN users u_approver ON u_approver.id = a.assigned_to_user_id
    WHERE a.organization_id = $1
    AND a.category = 'person_to_person'
    AND a.requires_approval = true
    AND a.approval_status IN ('pending_approval', 'approved')
    ORDER BY a.created_at DESC
  `, [organizationId]);
}

// Approve Request = Update activity approval_status
async function approveMaintenanceRequest(activityId: string, approverId: string) {
  await db.query(`
    UPDATE activities
    SET approval_status = 'approved',
        approved_by_user_id = $1,
        approved_at = NOW(),
        status = 'approved'
    WHERE id = $2
  `, [approverId, activityId]);

  // Log approval in activity_logs
  await db.insert(activity_logs).values({
    activity_id: activityId,
    user_id: approverId,
    action: 'approved',
    logged_at: new Date()
  });
}
```

### Parts Inventory (NEW ENTITY)

**Parts Inventory is NOT an activity** - it's a separate entity for tracking spare parts.

```sql
CREATE TABLE parts_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  description TEXT,

  -- Categorization
  category TEXT,  -- "Electrical", "Mechanical", "Hydraulic"
  subcategory TEXT,

  -- Inventory
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER,
  reorder_quantity INTEGER,

  -- Cost
  unit_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',

  -- Storage
  storage_location TEXT,
  bin_location TEXT,

  -- Compatibility (which asset types use this part)
  compatible_asset_types UUID[],

  -- Supplier info
  supplier_name TEXT,
  supplier_part_number TEXT,

  custom_attributes JSONB DEFAULT '{}',

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT parts_inventory_org_part_unique UNIQUE (organization_id, part_number)
);

CREATE INDEX idx_parts_inventory_org ON parts_inventory(organization_id);
CREATE INDEX idx_parts_inventory_category ON parts_inventory(category);
CREATE INDEX idx_parts_inventory_compatible_types ON parts_inventory USING GIN (compatible_asset_types);

-- Link parts to work orders (activities)
CREATE TABLE activity_parts_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts_inventory(id),

  quantity_used INTEGER NOT NULL,
  cost_per_unit NUMERIC(10,2),

  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_by UUID REFERENCES users(id)
);

CREATE INDEX idx_activity_parts_activity ON activity_parts_used(activity_id);
CREATE INDEX idx_activity_parts_part ON activity_parts_used(part_id);
```

---

## IoT Hub Analysis (Future - Phase 8+)

The IoT Hub has **11 sub-sections**, most of which are **beyond Phase 7 scope**:

```
IoT Hub (11 sections)
├─ Devices               ✅ Phase 7.1 (devices table)
├─ Gateways              ⏭️ Phase 8 (device subtype or separate table)
├─ Edge                  ⏭️ Phase 8 (edge computing nodes)
├─ Location Hubs         ⏭️ Phase 8 (RTLS anchor points)
├─ RTLS Infra            ⏭️ Phase 8 (Real-Time Location System)
├─ OTA Center            ⏭️ Phase 9 (Over-The-Air firmware updates)
├─ Converters            ⏭️ Phase 8 (Protocol converters)
├─ Integrations          ⏭️ Phase 8 (Third-party integrations)
├─ Usage                 ⏭️ Phase 7.4 (Telemetry analytics)
├─ Global Triggers       ✅ Phase 7.3 (rules table)
└─ Alarms                ✅ Phase 7.3 (alarms table)
```

**Phase 7 Scope:**
- Devices (basic management)
- Global Triggers (rules)
- Alarms

**Defer to Phase 8+:**
- Gateways, Edge, RTLS, OTA, Converters, Integrations (specialized IoT infrastructure)

---

## Updated Phase 7 Schema Additions

### 1. Asset Profiles Table

```sql
CREATE TABLE asset_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  default_attributes JSONB DEFAULT '{}',
  health_scoring_config JSONB,
  alarm_thresholds JSONB,
  maintenance_schedule JSONB,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT asset_profiles_org_name_unique UNIQUE (organization_id, name)
);

ALTER TABLE assets ADD COLUMN asset_profile_id UUID REFERENCES asset_profiles(id);
```

### 2. Group Triggers Tables

```sql
CREATE TABLE group_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  asset_group_id UUID NOT NULL REFERENCES asset_groups(id),
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN ('percentage_threshold', 'count_threshold', 'aggregate_metric', 'pattern_detection')
  ),
  condition_config JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  cooldown_minutes INTEGER DEFAULT 15,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_trigger_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_trigger_id UUID NOT NULL REFERENCES group_triggers(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  group_state JSONB NOT NULL,
  actions_executed JSONB NOT NULL,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('success', 'partial_failure', 'failure')),
  execution_errors JSONB
);
```

### 3. Parts Inventory Tables

```sql
CREATE TABLE parts_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER,
  reorder_quantity INTEGER,
  unit_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  storage_location TEXT,
  compatible_asset_types UUID[],
  supplier_name TEXT,
  supplier_part_number TEXT,
  custom_attributes JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parts_inventory_org_part_unique UNIQUE (organization_id, part_number)
);

CREATE TABLE activity_parts_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts_inventory(id),
  quantity_used INTEGER NOT NULL,
  cost_per_unit NUMERIC(10,2),
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_by UUID REFERENCES users(id)
);
```

---

## Impact on Phase 7 Roadmap

### ✅ PRIORITY: Phase 7.1-7.2 (Weeks 1-3)

**Phase 7.1 (Weeks 1-2): Base Types**
- ✅ 5 base type tables (devices, assets, persons, activities, spaces)
- ✅ Type definition tables (device_types, asset_types, etc.)
- ✅ **Asset Type Hierarchy** (parent_type_id already in schema)
- ✅ Basic CRUD endpoints

**Phase 7.2 (Weeks 2-3): Relationships + Asset Profiles** 🎯
- ✅ asset_device_links (M:N with semantics)
- ✅ space_assets (containment)
- ✅ **asset_profiles table** (BEHAVIOR POLICIES - 4 tabs)
- ✅ **asset_profile_id column** on assets table
- ✅ **Profile behavior enforcement** (device binding, location, telemetry)
- ✅ Asset Profiles CRUD UI (4-tab editor)
- ✅ Asset Type Hierarchy UI (tree view)

### Phase 7.3-7.7 (Weeks 3-10): Core IoT Features

**Phase 7.3 (Weeks 3-5): Rules & Alarms**
- ✅ rules table
- ✅ alarms table
- ✅ Rule evaluation engine
- ⏭️ **DEFER**: group_triggers (design ready, implement later)

**Phase 7.4 (Weeks 5-6): Telemetry & Real-Time**
- ✅ Telemetry storage (hot/warm/cold tiers)
- ✅ WebSocket real-time updates
- ✅ Telemetry aggregation (respecting profile settings)

**Phase 7.5 (Weeks 6-8): Geospatial**
- ✅ PostGIS integration
- ✅ Floor plans
- ✅ Indoor positioning (RTLS)
- ✅ Heatmaps

**Phase 7.6 (Weeks 8-9): Cross-Org Sharing**
- ✅ asset_shares table
- ✅ device_shares table
- ✅ Permission resolution

**Phase 7.7 (Weeks 9-10): Polish & Testing**
- ✅ Performance optimization
- ✅ Integration testing
- ✅ Documentation

### ⏭️ DEFERRED TO PHASE 8+ (But Designed For)

The following features are **designed for** in Phase 7 architecture but **not implemented** until later:

**Group Triggers** (Phase 8.1, ~1 week)
- ✅ Schema ready: `group_triggers`, `group_trigger_executions`
- ⏭️ Evaluation engine
- ⏭️ Group Triggers UI

**CMMS Module** (Phase 8.2-8.3, ~2 weeks)
- ✅ Activities system already supports CMMS workflows
- ⏭️ Parts Inventory: `parts_inventory`, `activity_parts_used` tables
- ⏭️ Work Orders UI (filtered activities view)
- ⏭️ PM Schedule UI
- ⏭️ Maintenance Requests UI
- ⏭️ Parts Inventory UI

**Advanced IoT Hub** (Phase 9+)
- ⏭️ Gateways, Edge, RTLS Infrastructure
- ⏭️ OTA Center, Converters, Integrations

---

## API Endpoints to Add

### Asset Profiles

```
GET    /api/v1/asset-profiles                    // List all profiles
POST   /api/v1/asset-profiles                    // Create profile
GET    /api/v1/asset-profiles/:id                // Get profile
PATCH  /api/v1/asset-profiles/:id                // Update profile
DELETE /api/v1/asset-profiles/:id                // Delete profile
GET    /api/v1/asset-types/:id/profiles          // Get profiles for asset type
```

### Group Triggers

```
GET    /api/v1/group-triggers                    // List all triggers
POST   /api/v1/group-triggers                    // Create trigger
GET    /api/v1/group-triggers/:id                // Get trigger
PATCH  /api/v1/group-triggers/:id                // Update trigger
DELETE /api/v1/group-triggers/:id                // Delete trigger
POST   /api/v1/group-triggers/:id/enable         // Enable trigger
POST   /api/v1/group-triggers/:id/disable        // Disable trigger
GET    /api/v1/group-triggers/:id/executions     // Get execution history
POST   /api/v1/group-triggers/:id/test           // Test trigger (dry run)
```

### CMMS

```
GET    /api/v1/cmms/work-orders                  // List work orders (filtered activities)
POST   /api/v1/cmms/work-orders                  // Create work order
GET    /api/v1/cmms/work-orders/:id              // Get work order detail
PATCH  /api/v1/cmms/work-orders/:id              // Update work order
POST   /api/v1/cmms/work-orders/:id/complete     // Complete work order

GET    /api/v1/cmms/pm-schedule                  // List PM schedules
POST   /api/v1/cmms/pm-schedule                  // Create PM schedule
GET    /api/v1/cmms/pm-schedule/:id              // Get schedule
PATCH  /api/v1/cmms/pm-schedule/:id              // Update schedule
DELETE /api/v1/cmms/pm-schedule/:id              // Delete schedule

GET    /api/v1/cmms/requests                     // List maintenance requests
POST   /api/v1/cmms/requests                     // Create request
POST   /api/v1/cmms/requests/:id/approve         // Approve request
POST   /api/v1/cmms/requests/:id/reject          // Reject request

GET    /api/v1/cmms/parts                        // List parts inventory
POST   /api/v1/cmms/parts                        // Add part
GET    /api/v1/cmms/parts/:id                    // Get part
PATCH  /api/v1/cmms/parts/:id                    // Update part
DELETE /api/v1/cmms/parts/:id                    // Delete part
POST   /api/v1/cmms/parts/:id/adjust-stock       // Adjust stock quantity
GET    /api/v1/cmms/parts/low-stock              // Get parts below reorder point
```

---

## Recommendations

### ✅ IMMEDIATE PRIORITY: Phase 7.2 (Weeks 2-3)

**Asset Profiles Implementation** 🎯
1. ✅ Create `asset_profiles` table with **all 4 configuration areas**:
   - Basic (name, description, applicable types)
   - Device (binding rules, dashboard templates, max devices)
   - Location (tracking mode, space requirements, RTLS)
   - Telemetry (aggregation, retention, alarm inheritance)
2. ✅ Add `asset_profile_id` to `assets` table
3. ✅ Implement behavior enforcement logic:
   - Device binding validation
   - Space assignment enforcement
   - Location tracking enablement
   - Telemetry aggregation and retention
4. ✅ Build Asset Profiles UI with 4-tab editor:
   - Basic configuration tab
   - Device configuration tab
   - Location configuration tab
   - Telemetry configuration tab
5. ✅ Add Asset Profiles CRUD API endpoints

**Asset Type Hierarchy UI**
1. ✅ Tree view of asset types (already supported by `parent_type_id`)
2. ✅ Asset count per type and subtype
3. ✅ Expand/collapse categories

**Estimated Effort**: 4-5 days (Asset Profiles are more complex than originally thought due to behavior enforcement)

### ⏭️ DEFER TO PHASE 8+ (But Design For)

These features are **architecturally ready** but deferred per user request:

**Phase 8.1: Group Triggers** (~1 week)
- Schema complete: `group_triggers`, `group_trigger_executions`
- Evaluation engine implementation
- Group Triggers UI page
- API endpoints

**Phase 8.2-8.3: CMMS Module** (~2 weeks)
- `parts_inventory` and `activity_parts_used` tables
- Work Orders UI (filtered activities view)
- PM Schedule UI (activity_schedules view)
- Maintenance Requests UI (approval workflow)
- Parts Inventory UI

**Phase 9+: Advanced IoT Hub**
- Gateways, Edge, RTLS Infrastructure
- OTA Center, Converters, Integrations

---

## Questions ANSWERED ✅

1. **Asset Profiles vs Asset Types**: ✅ **CLARIFIED** - Asset Profiles are **behavior policies** that control how assets interact with devices, spaces, and telemetry. They enforce business rules, not just default values.

2. **Group Triggers cooldown**: Per-trigger configuration (already in schema)

3. **Parts Inventory costing**: Defer to Phase 8 implementation discussion

4. **Work Order lifecycle**: Defer to Phase 8 CMMS implementation

5. **PM Schedule recurrence**: Defer to Phase 8 CMMS implementation

---

## Conclusion

The new mock UI reveals **critical insights into Asset Profiles**:

### Key Finding: Asset Profiles = Behavior Policies

**Asset Profiles are NOT just templates** - they are **runtime behavior enforcement policies** that control:
1. **Device Relationships**: 1:1 binding, max devices constraints
2. **Location Behavior**: Tracking mode, space requirements, RTLS enablement
3. **Telemetry Rules**: Aggregation, retention overrides, alarm inheritance
4. **Presentation**: Dashboard template selection

### Schema Impact

**Phase 7 (Immediate)**:
- `asset_profiles` table with 14 behavior configuration fields
- Behavior enforcement in device linking, location updates, telemetry queries

**Phase 8+ (Deferred)**:
- `group_triggers` + `group_trigger_executions`
- `parts_inventory` + `activity_parts_used`

**Total new tables in Phase 7**: 1 (`asset_profiles`)
**Total deferred to Phase 8+**: 4 tables

### Implementation Effort

**Phase 7 (Immediate)**:
- Asset Profiles: **4-5 days** (more complex due to behavior enforcement)
  - Schema with 14 behavior fields
  - Enforcement logic for device binding, location, telemetry
  - 4-tab UI editor
  - API endpoints

**Phase 8+ (Deferred)**:
- Group Triggers: 4-5 days
- CMMS Module: 5-7 days (Parts Inventory + 4 UI pages)
- **Deferred Total**: 9-12 days

### Updated Phase 7 Timeline

**Original**: 10 weeks
**Updated**: **10.5 weeks** (only Asset Profiles added to Phase 7.2)

**Breakdown**:
- Phase 7.1: Base Types (2 weeks) ✅
- Phase 7.2: Relationships + **Asset Profiles** (1.5 weeks) 🎯 +0.5 week
- Phase 7.3-7.7: As originally planned (7 weeks) ✅

**Deferred to Phase 8**: Group Triggers (1 week) + CMMS (2 weeks) = **3 weeks**

---

## Next Steps

1. ✅ **Asset Profiles architecture defined** - 4-tab behavior policy system
2. 📋 **Update phase-7-iot-meta-model.md** with Asset Profiles schema
3. 📋 **Begin Phase 7.1 implementation** (Base Types + Type Hierarchy UI)
4. 📋 **Implement Asset Profiles in Phase 7.2** (4-5 days)
5. ⏭️ **Defer Group Triggers and CMMS to Phase 8** (schema ready for future implementation)

**Document Version:** 1.0
**Last Updated:** January 27, 2026
