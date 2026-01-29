/**
 * Logger Utility
 *
 * Provides structured logging with Pino.
 */

import pino from 'pino';
import type { Config } from './config.js';

export function createLogger(config: Config) {
  return pino({
    level: config.logging.level,
    transport: config.logging.pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    base: {
      service: config.serviceName,
      env: config.nodeEnv,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
