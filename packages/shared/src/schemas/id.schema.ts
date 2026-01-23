import { z } from 'zod';
import {
  type OrganizationId,
  type TenantId,
  type ProjectId,
  type UserId,
  type TypeDefinitionId,
  type EntityId,
  type EntityEdgeId,
  type DeviceId,
  type AssetId,
  type SpaceId,
  type ActivityId,
  type PersonId,
  type AlarmId,
  type RuleId,
  type DashboardId,
  type TelemetryId,
  type InvitationId,
  type RefreshTokenId,
  type RoleDefinitionId,
  createOrganizationId,
  createTenantId,
  createProjectId,
  createUserId,
  createTypeDefinitionId,
  createEntityId,
  createEntityEdgeId,
  createDeviceId,
  createAssetId,
  createSpaceId,
  createActivityId,
  createPersonId,
  createAlarmId,
  createRuleId,
  createDashboardId,
  createTelemetryId,
  createInvitationId,
  createRefreshTokenId,
  createRoleDefinitionId,
} from '../types/ids.js';
import type { Brand } from '../types/brand.js';

// ============================================================
// Core Entity ID Schemas
// ============================================================

export const OrganizationIdSchema = z
  .string()
  .uuid()
  .transform((id): OrganizationId => createOrganizationId(id));

export const TenantIdSchema = z
  .string()
  .uuid()
  .transform((id): TenantId => createTenantId(id));

export const ProjectIdSchema = z
  .string()
  .uuid()
  .transform((id): ProjectId => createProjectId(id));

export const UserIdSchema = z
  .string()
  .uuid()
  .transform((id): UserId => createUserId(id));

// ============================================================
// Meta-Model ID Schemas
// ============================================================

export const TypeDefinitionIdSchema = z
  .string()
  .uuid()
  .transform((id): TypeDefinitionId => createTypeDefinitionId(id));

export const EntityIdSchema = z
  .string()
  .uuid()
  .transform((id): EntityId => createEntityId(id));

export const EntityEdgeIdSchema = z
  .string()
  .uuid()
  .transform((id): EntityEdgeId => createEntityEdgeId(id));

// ============================================================
// Domain Entity ID Schemas
// ============================================================

export const DeviceIdSchema = z
  .string()
  .uuid()
  .transform((id): DeviceId => createDeviceId(id));

export const AssetIdSchema = z
  .string()
  .uuid()
  .transform((id): AssetId => createAssetId(id));

export const SpaceIdSchema = z
  .string()
  .uuid()
  .transform((id): SpaceId => createSpaceId(id));

export const ActivityIdSchema = z
  .string()
  .uuid()
  .transform((id): ActivityId => createActivityId(id));

export const PersonIdSchema = z
  .string()
  .uuid()
  .transform((id): PersonId => createPersonId(id));

export const AlarmIdSchema = z
  .string()
  .uuid()
  .transform((id): AlarmId => createAlarmId(id));

export const RuleIdSchema = z
  .string()
  .uuid()
  .transform((id): RuleId => createRuleId(id));

export const DashboardIdSchema = z
  .string()
  .uuid()
  .transform((id): DashboardId => createDashboardId(id));

export const TelemetryIdSchema = z
  .string()
  .uuid()
  .transform((id): TelemetryId => createTelemetryId(id));

export const InvitationIdSchema = z
  .string()
  .uuid()
  .transform((id): InvitationId => createInvitationId(id));

export const RefreshTokenIdSchema = z
  .string()
  .uuid()
  .transform((id): RefreshTokenId => createRefreshTokenId(id));

export const RoleDefinitionIdSchema = z
  .string()
  .uuid()
  .transform((id): RoleDefinitionId => createRoleDefinitionId(id));

// ============================================================
// Factory for creating new branded ID schemas
// ============================================================

/**
 * Creates a Zod schema for a branded ID type.
 *
 * @example
 * const CustomIdSchema = createIdSchema('CustomId', (id) => id as CustomId);
 */
export function createIdSchema<T extends string>(
  _brandName: T,
  factory: (id: string) => Brand<string, T>
) {
  return z.string().uuid().transform(factory);
}
