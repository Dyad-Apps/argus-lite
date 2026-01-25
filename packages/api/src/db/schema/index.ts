/**
 * Database Schema Index
 *
 * Re-exports all schema definitions for use with Drizzle ORM.
 * This file is the entry point for drizzle.config.ts.
 */

// Enums
export * from './enums.js';

// Core tables
export * from './users.js';
export * from './refresh-tokens.js';
export * from './password-reset-tokens.js';
export * from './organizations.js';
export * from './user-organizations.js';
export * from './organization-invitations.js';
export * from './type-definitions.js';
export * from './entities.js';
export * from './entity-edges.js';
export * from './telemetry.js';
export * from './system-events.js';
export * from './audit-logs.js';
export * from './identity-providers.js';
export * from './user-identities.js';
export * from './platform-settings.js';

// Tenant management and RBAC
export * from './tenant-profiles.js';
export * from './user-groups.js';
export * from './roles.js';

// Relations (must be last to avoid circular deps)
export * from './relations.js';
