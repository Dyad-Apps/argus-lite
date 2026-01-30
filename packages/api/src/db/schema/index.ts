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

// Organization profiles and RBAC
export * from './organization-profiles.js';
export * from './user-groups.js';
export * from './roles.js';

// Security features
export * from './impersonation-sessions.js';

// System configuration
export * from './system-settings.js';

// Phase 7: IoT Meta-Model - Type Definitions
export * from './device-types.js';
export * from './asset-types.js';
export * from './person-types.js';
export * from './activity-types.js';
export * from './space-types.js';

// Phase 7: IoT Meta-Model - Base Types
export * from './devices.js';
export * from './assets.js';
export * from './persons.js';
export * from './activities.js';
export * from './spaces.js';

// Phase 7: IoT Platform - Telemetry Tables
export * from './telemetry-history.js';
export * from './telemetry-raw.js';
export * from './telemetry-chunks.js';
export * from './telemetry-transactions.js';
export * from './threshold-rules.js';

// Relations (must be last to avoid circular deps)
export * from './relations.js';
