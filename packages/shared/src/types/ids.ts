import { Brand } from './brand.js';

// ============================================================
// Core Entity ID Types
// ============================================================

/** Multi-tenant organization identifier */
export type OrganizationId = Brand<string, 'OrganizationId'>;

/** Tenant identifier (alias for OrganizationId for clarity) */
export type TenantId = Brand<string, 'TenantId'>;

/** Project within an organization */
export type ProjectId = Brand<string, 'ProjectId'>;

/** User identifier */
export type UserId = Brand<string, 'UserId'>;

// ============================================================
// Meta-Model Entity ID Types (from META_MODEL_SPECIFICATION)
// ============================================================

/** Type definition in the meta-model registry */
export type TypeDefinitionId = Brand<string, 'TypeDefinitionId'>;

/** Generic entity identifier (instances of TypeDefinitions) */
export type EntityId = Brand<string, 'EntityId'>;

/** Relationship edge between entities */
export type EntityEdgeId = Brand<string, 'EntityEdgeId'>;

// ============================================================
// Domain Entity ID Types
// ============================================================

/** Device (hardware that produces telemetry) */
export type DeviceId = Brand<string, 'DeviceId'>;

/** Asset (physical/logical entity with state) */
export type AssetId = Brand<string, 'AssetId'>;

/** Space (hierarchical location container) */
export type SpaceId = Brand<string, 'SpaceId'>;

/** Activity (work unit or event) */
export type ActivityId = Brand<string, 'ActivityId'>;

/** Person (human actor in the system) */
export type PersonId = Brand<string, 'PersonId'>;

/** Alarm instance */
export type AlarmId = Brand<string, 'AlarmId'>;

/** Rule/automation definition */
export type RuleId = Brand<string, 'RuleId'>;

/** Dashboard definition */
export type DashboardId = Brand<string, 'DashboardId'>;

/** Telemetry record identifier */
export type TelemetryId = Brand<string, 'TelemetryId'>;

/** Invitation for user onboarding */
export type InvitationId = Brand<string, 'InvitationId'>;

/** Refresh token for authentication */
export type RefreshTokenId = Brand<string, 'RefreshTokenId'>;

/** Role definition identifier */
export type RoleDefinitionId = Brand<string, 'RoleDefinitionId'>;

// ============================================================
// Validation
// ============================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id: string, typeName: string): asserts id is string {
  if (!UUID_REGEX.test(id)) {
    throw new Error(`Invalid ${typeName}: "${id}" is not a valid UUID`);
  }
}

// ============================================================
// Factory Functions (validate + brand in one step)
// ============================================================

// Core entities
export function createOrganizationId(id: string): OrganizationId {
  assertUuid(id, 'OrganizationId');
  return id as OrganizationId;
}

export function createTenantId(id: string): TenantId {
  assertUuid(id, 'TenantId');
  return id as TenantId;
}

export function createProjectId(id: string): ProjectId {
  assertUuid(id, 'ProjectId');
  return id as ProjectId;
}

export function createUserId(id: string): UserId {
  assertUuid(id, 'UserId');
  return id as UserId;
}

// Meta-model entities
export function createTypeDefinitionId(id: string): TypeDefinitionId {
  assertUuid(id, 'TypeDefinitionId');
  return id as TypeDefinitionId;
}

export function createEntityId(id: string): EntityId {
  assertUuid(id, 'EntityId');
  return id as EntityId;
}

export function createEntityEdgeId(id: string): EntityEdgeId {
  assertUuid(id, 'EntityEdgeId');
  return id as EntityEdgeId;
}

// Domain entities
export function createDeviceId(id: string): DeviceId {
  assertUuid(id, 'DeviceId');
  return id as DeviceId;
}

export function createAssetId(id: string): AssetId {
  assertUuid(id, 'AssetId');
  return id as AssetId;
}

export function createSpaceId(id: string): SpaceId {
  assertUuid(id, 'SpaceId');
  return id as SpaceId;
}

export function createActivityId(id: string): ActivityId {
  assertUuid(id, 'ActivityId');
  return id as ActivityId;
}

export function createPersonId(id: string): PersonId {
  assertUuid(id, 'PersonId');
  return id as PersonId;
}

export function createAlarmId(id: string): AlarmId {
  assertUuid(id, 'AlarmId');
  return id as AlarmId;
}

export function createRuleId(id: string): RuleId {
  assertUuid(id, 'RuleId');
  return id as RuleId;
}

export function createDashboardId(id: string): DashboardId {
  assertUuid(id, 'DashboardId');
  return id as DashboardId;
}

export function createTelemetryId(id: string): TelemetryId {
  assertUuid(id, 'TelemetryId');
  return id as TelemetryId;
}

export function createInvitationId(id: string): InvitationId {
  assertUuid(id, 'InvitationId');
  return id as InvitationId;
}

export function createRefreshTokenId(id: string): RefreshTokenId {
  assertUuid(id, 'RefreshTokenId');
  return id as RefreshTokenId;
}

export function createRoleDefinitionId(id: string): RoleDefinitionId {
  assertUuid(id, 'RoleDefinitionId');
  return id as RoleDefinitionId;
}

// ============================================================
// Convenience object for namespaced access
// ============================================================

export const ids = {
  // Core
  organization: createOrganizationId,
  tenant: createTenantId,
  project: createProjectId,
  user: createUserId,

  // Meta-model
  typeDefinition: createTypeDefinitionId,
  entity: createEntityId,
  entityEdge: createEntityEdgeId,

  // Domain
  device: createDeviceId,
  asset: createAssetId,
  space: createSpaceId,
  activity: createActivityId,
  person: createPersonId,
  alarm: createAlarmId,
  rule: createRuleId,
  dashboard: createDashboardId,
  telemetry: createTelemetryId,
  invitation: createInvitationId,
  refreshToken: createRefreshTokenId,
  roleDefinition: createRoleDefinitionId,
} as const;
