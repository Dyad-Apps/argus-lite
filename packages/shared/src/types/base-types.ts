/**
 * Meta-Model Base Types
 *
 * The system is anchored by five immutable Abstract Base Types.
 * Every user-defined object must inherit from one of these to ensure
 * cross-application relatability.
 *
 * @see META_MODEL_SPECIFICATION.md
 */

// ============================================================
// Base Type Enum
// ============================================================

/**
 * The five immutable base types that all entities must inherit from.
 */
export const BaseType = {
  /** Physical or logical entities with state that can be monitored */
  Asset: 'Asset',
  /** Hardware entities that produce telemetry data */
  Device: 'Device',
  /** Human actors and organizational roles */
  Person: 'Person',
  /** Units of work or ephemeral events with lifecycle */
  Activity: 'Activity',
  /** Hierarchical containers for physical positioning */
  Space: 'Space',
} as const;

export type BaseType = (typeof BaseType)[keyof typeof BaseType];

// ============================================================
// Relationship Types
// ============================================================

/**
 * Typed edges connecting entities in the graph model.
 */
export const RelationshipType = {
  // Spatial Relationships
  /** Asset/Device in Space */
  CONTAINED_IN: 'CONTAINED_IN',
  /** Space hierarchy (parent-child) */
  CHILD_OF: 'CHILD_OF',
  /** Neighboring spaces */
  ADJACENT_TO: 'ADJACENT_TO',

  // Operational Relationships
  /** Device monitors Asset */
  MONITORED_BY: 'MONITORED_BY',
  /** Device controls Asset */
  CONTROLLED_BY: 'CONTROLLED_BY',
  /** Asset feeds Asset (fluid/power flow) */
  FED_BY: 'FED_BY',
  /** Electrical dependency */
  POWERED_BY: 'POWERED_BY',

  // Organizational Relationships
  /** Entity ownership */
  OWNED_BY: 'OWNED_BY',
  /** Activity to Person */
  ASSIGNED_TO: 'ASSIGNED_TO',
  /** Person manages Asset */
  RESPONSIBLE_FOR: 'RESPONSIBLE_FOR',

  // Logical Relationships
  /** Operational dependency */
  DEPENDS_ON: 'DEPENDS_ON',
  /** Redundancy relationship */
  BACKUP_FOR: 'BACKUP_FOR',
  /** Component relationship */
  PART_OF: 'PART_OF',
} as const;

export type RelationshipType =
  (typeof RelationshipType)[keyof typeof RelationshipType];

// ============================================================
// Lifecycle & Status Enums
// ============================================================

/** Asset lifecycle status */
export const LifecycleStatus = {
  COMMISSIONING: 'commissioning',
  ACTIVE: 'active',
  MAINTENANCE: 'maintenance',
  DECOMMISSIONED: 'decommissioned',
} as const;

export type LifecycleStatus =
  (typeof LifecycleStatus)[keyof typeof LifecycleStatus];

/** Device connectivity status */
export const ConnectivityStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  DEGRADED: 'degraded',
} as const;

export type ConnectivityStatus =
  (typeof ConnectivityStatus)[keyof typeof ConnectivityStatus];

/** Activity execution status */
export const ActivityStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ActivityStatus =
  (typeof ActivityStatus)[keyof typeof ActivityStatus];

/** Person shift status */
export const ShiftStatus = {
  ON_SHIFT: 'on_shift',
  OFF_SHIFT: 'off_shift',
  ON_BREAK: 'on_break',
} as const;

export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

/** Space type categories */
export const SpaceType = {
  SITE: 'site',
  BUILDING: 'building',
  FLOOR: 'floor',
  ROOM: 'room',
  ZONE: 'zone',
  LINE: 'line',
} as const;

export type SpaceType = (typeof SpaceType)[keyof typeof SpaceType];

// ============================================================
// Permission Levels (RBAC)
// ============================================================

/**
 * Permission levels for entity access control.
 * Higher levels include all lower level permissions.
 */
export const PermissionLevel = {
  /** Can see entity and telemetry */
  VIEW: 'view',
  /** Can trigger actions (start/stop, acknowledge alarms) */
  OPERATE: 'operate',
  /** Can modify thresholds, setpoints, parameters */
  CONFIGURE: 'configure',
  /** Can modify entity structure, relationships, delete */
  ADMIN: 'admin',
} as const;

export type PermissionLevel =
  (typeof PermissionLevel)[keyof typeof PermissionLevel];

/**
 * Permission hierarchy (higher includes all lower)
 */
export const PERMISSION_HIERARCHY: Record<PermissionLevel, PermissionLevel[]> =
  {
    [PermissionLevel.VIEW]: [],
    [PermissionLevel.OPERATE]: [PermissionLevel.VIEW],
    [PermissionLevel.CONFIGURE]: [PermissionLevel.VIEW, PermissionLevel.OPERATE],
    [PermissionLevel.ADMIN]: [
      PermissionLevel.VIEW,
      PermissionLevel.OPERATE,
      PermissionLevel.CONFIGURE,
    ],
  };

// ============================================================
// Telemetry Quality
// ============================================================

export const TelemetryQuality = {
  GOOD: 'good',
  UNCERTAIN: 'uncertain',
  BAD: 'bad',
} as const;

export type TelemetryQuality =
  (typeof TelemetryQuality)[keyof typeof TelemetryQuality];

// ============================================================
// System Event Types
// ============================================================

export const SystemEventType = {
  // Entity Events
  ENTITY_CREATED: 'ENTITY_CREATED',
  ENTITY_UPDATED: 'ENTITY_UPDATED',
  ENTITY_DELETED: 'ENTITY_DELETED',
  ENTITY_STATE_CHANGED: 'ENTITY_STATE_CHANGED',

  // Telemetry Events
  TELEMETRY_RECEIVED: 'TELEMETRY_RECEIVED',
  THRESHOLD_BREACHED: 'THRESHOLD_BREACHED',
  THRESHOLD_CLEARED: 'THRESHOLD_CLEARED',

  // Relationship Events
  EDGE_CREATED: 'EDGE_CREATED',
  EDGE_DELETED: 'EDGE_DELETED',

  // Activity Events
  ACTIVITY_STARTED: 'ACTIVITY_STARTED',
  ACTIVITY_COMPLETED: 'ACTIVITY_COMPLETED',

  // System Events
  DEVICE_CONNECTED: 'DEVICE_CONNECTED',
  DEVICE_DISCONNECTED: 'DEVICE_DISCONNECTED',

  // User Events
  USER_ACTION: 'USER_ACTION',

  // Scheduled Events
  SCHEDULED_TRIGGER: 'SCHEDULED_TRIGGER',
} as const;

export type SystemEventType =
  (typeof SystemEventType)[keyof typeof SystemEventType];

// ============================================================
// Aggregation Methods
// ============================================================

export const AggregationMethod = {
  AVG: 'AVG',
  MAX: 'MAX',
  MIN: 'MIN',
  SUM: 'SUM',
  COUNT: 'COUNT',
  LAST: 'LAST',
} as const;

export type AggregationMethod =
  (typeof AggregationMethod)[keyof typeof AggregationMethod];
