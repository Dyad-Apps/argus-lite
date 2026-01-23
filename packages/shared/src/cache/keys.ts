import type { OrganizationId } from '../types/ids.js';

/**
 * Cache key conventions following multi-organization rules.
 * ALL cache keys MUST include organization ID to prevent cross-org data leaks.
 *
 * Pattern: org:{organizationId}:{entity}:{identifier}
 */

export const cacheKeys = {
  // Entity keys
  entity: (orgId: OrganizationId, entityId: string) =>
    `org:${orgId}:entity:${entityId}`,

  entityList: (orgId: OrganizationId, baseType: string) =>
    `org:${orgId}:entities:${baseType}:list`,

  typeDefinition: (orgId: OrganizationId, typeDefId: string) =>
    `org:${orgId}:typedef:${typeDefId}`,

  device: (orgId: OrganizationId, deviceId: string) =>
    `org:${orgId}:device:${deviceId}`,

  deviceList: (orgId: OrganizationId) => `org:${orgId}:devices:list`,

  user: (orgId: OrganizationId, userId: string) =>
    `org:${orgId}:user:${userId}`,

  // Session keys
  session: (orgId: OrganizationId, sessionId: string) =>
    `org:${orgId}:session:${sessionId}`,

  // Rate limiting keys
  rateLimit: (orgId: OrganizationId, userId: string, endpoint: string) =>
    `org:${orgId}:ratelimit:${userId}:${endpoint}`,

  // Telemetry cache keys
  telemetryLatest: (orgId: OrganizationId, entityId: string, metricKey: string) =>
    `org:${orgId}:telemetry:${entityId}:${metricKey}:latest`,

  // Generic pattern helper
  forOrg: (orgId: OrganizationId, ...parts: string[]) =>
    `org:${orgId}:${parts.join(':')}`,
} as const;

/**
 * TTL constants (in seconds)
 */
export const cacheTTL = {
  /** 1 minute - frequently updated data */
  short: 60,
  /** 5 minutes - device lists, quotas */
  medium: 300,
  /** 1 hour - organization config */
  long: 3600,
  /** 15 minutes - match JWT access token */
  session: 900,
  /** 30 seconds - telemetry data */
  telemetry: 30,
} as const;
