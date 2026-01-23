/**
 * Pino logger configuration for Argus IQ
 * Provides structured JSON logging with context support
 */

import pino, { type Logger, type LoggerOptions } from 'pino';

export type { Logger } from 'pino';

export interface LogContext {
  organizationId?: string;
  entityId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

const isDevelopment = process.env.NODE_ENV !== 'production';

const defaultOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || 'argus-api',
    version: process.env.SERVICE_VERSION || '0.0.1',
  },
};

/**
 * Creates a configured Pino logger instance
 */
export function createLogger(options?: Partial<LoggerOptions>): Logger {
  const mergedOptions: LoggerOptions = {
    ...defaultOptions,
    ...options,
    base: {
      ...defaultOptions.base,
      ...options?.base,
    },
  };

  // In development, use pino-pretty transport if available
  if (isDevelopment && !options?.transport) {
    mergedOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(mergedOptions);
}

/**
 * Creates a child logger with additional context
 */
export function createChildLogger(
  parent: Logger,
  context: LogContext
): Logger {
  return parent.child(context);
}

// Default logger instance for convenience
let defaultLogger: Logger | null = null;

/**
 * Gets the default logger instance, creating it if necessary
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * Sets a custom default logger instance
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}

// Fastify-compatible logger options for direct integration
export const fastifyLoggerOptions: LoggerOptions = {
  ...defaultOptions,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      hostname: req.hostname,
      remoteAddress: req.ip,
      remotePort: req.socket?.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
};

/**
 * Gets Fastify-compatible logger configuration
 * Returns pino options that work with Fastify's built-in logger
 */
export function getFastifyLoggerConfig(): LoggerOptions | boolean {
  if (isDevelopment) {
    return {
      ...fastifyLoggerOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    };
  }
  return fastifyLoggerOptions;
}
