import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Base types for the meta-model.
 * Every entity must inherit from one of these.
 */
export const baseTypeEnum = pgEnum('base_type', [
  'Asset',
  'Device',
  'Person',
  'Activity',
  'Space',
]);

/**
 * Relationship types for entity edges.
 */
export const relationshipTypeEnum = pgEnum('relationship_type', [
  // Spatial Relationships
  'CONTAINED_IN',
  'CHILD_OF',
  'ADJACENT_TO',
  // Operational Relationships
  'MONITORED_BY',
  'CONTROLLED_BY',
  'FED_BY',
  'POWERED_BY',
  // Organizational Relationships
  'OWNED_BY',
  'ASSIGNED_TO',
  'RESPONSIBLE_FOR',
  // Logical Relationships
  'DEPENDS_ON',
  'BACKUP_FOR',
  'PART_OF',
]);

/**
 * Asset lifecycle status.
 */
export const lifecycleStatusEnum = pgEnum('lifecycle_status', [
  'commissioning',
  'active',
  'maintenance',
  'decommissioned',
]);

/**
 * Device connectivity status.
 */
export const connectivityStatusEnum = pgEnum('connectivity_status', [
  'online',
  'offline',
  'degraded',
]);

/**
 * Activity execution status.
 */
export const activityStatusEnum = pgEnum('activity_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

/**
 * Telemetry data quality indicator.
 */
export const telemetryQualityEnum = pgEnum('telemetry_quality', [
  'good',
  'uncertain',
  'bad',
]);

/**
 * Organization membership roles.
 */
export const organizationRoleEnum = pgEnum('organization_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);

/**
 * Identity provider types for SSO.
 */
export const identityProviderTypeEnum = pgEnum('identity_provider_type', [
  'oidc',      // OpenID Connect (generic)
  'saml',      // SAML 2.0
  'google',    // Google OAuth2
  'microsoft', // Microsoft/Azure AD
  'github',    // GitHub OAuth2
  'okta',      // Okta OIDC
]);
