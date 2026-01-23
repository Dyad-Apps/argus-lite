/**
 * Configuration validation and management
 * Uses Zod schemas for type-safe environment configuration
 */

import { z } from 'zod';

// Environment mode
const envSchema = z.enum(['development', 'production', 'test']);
export type Environment = z.infer<typeof envSchema>;

// Database configuration
export const databaseConfigSchema = z.object({
  url: z.string().url().describe('PostgreSQL connection URL'),
  poolMin: z.coerce.number().int().min(0).default(2),
  poolMax: z.coerce.number().int().min(1).default(10),
  ssl: z.coerce.boolean().default(false),
});
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

// Cache (Valkey/Redis) configuration
export const cacheConfigSchema = z.object({
  url: z.string().url().describe('Valkey/Redis connection URL'),
  keyPrefix: z.string().default('argus:'),
  ttlSeconds: z.coerce.number().int().min(1).default(3600),
});
export type CacheConfig = z.infer<typeof cacheConfigSchema>;

// Server configuration
export const serverConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  trustProxy: z.coerce.boolean().default(false),
});
export type ServerConfig = z.infer<typeof serverConfigSchema>;

// CORS configuration
export const corsConfigSchema = z.object({
  origin: z.union([z.string(), z.array(z.string()), z.boolean()]).default(true),
  credentials: z.coerce.boolean().default(true),
});
export type CorsConfig = z.infer<typeof corsConfigSchema>;

// Logging configuration
export const logConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  pretty: z.coerce.boolean().default(false),
});
export type LogConfig = z.infer<typeof logConfigSchema>;

// Sentry configuration (optional)
export const sentryConfigSchema = z.object({
  dsn: z.string().optional(),
  environment: envSchema.optional(),
  sampleRate: z.coerce.number().min(0).max(1).default(1.0),
});
export type SentryConfig = z.infer<typeof sentryConfigSchema>;

// Complete API configuration
export const apiConfigSchema = z.object({
  env: envSchema.default('development'),
  serviceName: z.string().default('argus-api'),
  serviceVersion: z.string().default('0.0.1'),
  server: serverConfigSchema,
  database: databaseConfigSchema,
  cache: cacheConfigSchema,
  cors: corsConfigSchema,
  log: logConfigSchema,
  sentry: sentryConfigSchema.optional(),
});
export type ApiConfig = z.infer<typeof apiConfigSchema>;

/**
 * Loads and validates configuration from environment variables
 * Throws ZodError if validation fails
 */
export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const raw = {
    env: env.NODE_ENV,
    serviceName: env.SERVICE_NAME,
    serviceVersion: env.SERVICE_VERSION || env.npm_package_version,
    server: {
      port: env.PORT,
      host: env.HOST,
      trustProxy: env.TRUST_PROXY,
    },
    database: {
      url: env.DATABASE_URL,
      poolMin: env.DB_POOL_MIN,
      poolMax: env.DB_POOL_MAX,
      ssl: env.DB_SSL,
    },
    cache: {
      url: env.VALKEY_URL || env.REDIS_URL,
      keyPrefix: env.CACHE_KEY_PREFIX,
      ttlSeconds: env.CACHE_TTL_SECONDS,
    },
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: env.CORS_CREDENTIALS,
    },
    log: {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    },
    sentry: env.SENTRY_DSN
      ? {
          dsn: env.SENTRY_DSN,
          environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
          sampleRate: env.SENTRY_SAMPLE_RATE,
        }
      : undefined,
  };

  return apiConfigSchema.parse(raw);
}

/**
 * Validates configuration without loading from environment
 */
export function validateApiConfig(config: unknown): ApiConfig {
  return apiConfigSchema.parse(config);
}

/** Safe parse result type */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.core.$ZodError };

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeLoadApiConfig(
  env: NodeJS.ProcessEnv = process.env
): SafeParseResult<ApiConfig> {
  const raw = {
    env: env.NODE_ENV,
    serviceName: env.SERVICE_NAME,
    serviceVersion: env.SERVICE_VERSION || env.npm_package_version,
    server: {
      port: env.PORT,
      host: env.HOST,
      trustProxy: env.TRUST_PROXY,
    },
    database: {
      url: env.DATABASE_URL,
      poolMin: env.DB_POOL_MIN,
      poolMax: env.DB_POOL_MAX,
      ssl: env.DB_SSL,
    },
    cache: {
      url: env.VALKEY_URL || env.REDIS_URL,
      keyPrefix: env.CACHE_KEY_PREFIX,
      ttlSeconds: env.CACHE_TTL_SECONDS,
    },
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: env.CORS_CREDENTIALS,
    },
    log: {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    },
    sentry: env.SENTRY_DSN
      ? {
          dsn: env.SENTRY_DSN,
          environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
          sampleRate: env.SENTRY_SAMPLE_RATE,
        }
      : undefined,
  };

  return apiConfigSchema.safeParse(raw);
}

/**
 * Formats Zod errors into readable messages
 */
export function formatConfigErrors(error: z.core.$ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
}
