/**
 * Database Schema Index
 *
 * Re-exports all schema definitions for use with Drizzle ORM.
 * This file is the entry point for drizzle.config.ts.
 */

// Enums
export * from './enums.js';

// Core tables
export * from './organizations.js';
export * from './type-definitions.js';
export * from './entities.js';
export * from './entity-edges.js';
export * from './telemetry.js';
export * from './system-events.js';
