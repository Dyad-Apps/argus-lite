/**
 * @argus/shared - Shared types, schemas, and utilities
 *
 * This package contains shared code used across the Argus IQ platform:
 * - Zod schemas (single source of truth for types)
 * - Branded ID types
 * - Common utilities
 * - Meta-model type definitions
 */

export const SHARED_VERSION = '0.0.1';

// Types (branded IDs, enums, base types)
export * from './types/index.js';

// Zod schemas
export * from './schemas/index.js';

// Cache utilities
export * from './cache/index.js';

// Logger
export * from './logger/index.js';

// Configuration
export * from './config/index.js';

// Errors
export * from './errors/index.js';
