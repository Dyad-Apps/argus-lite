/**
 * Sentry error tracking plugin for Fastify
 * Only initializes if SENTRY_DSN environment variable is set
 */

import { FastifyInstance } from 'fastify';
import * as Sentry from '@sentry/node';

export interface SentryPluginOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
}

let sentryInitialized = false;

/**
 * Initializes Sentry if DSN is configured
 */
export function initSentry(options: SentryPluginOptions): boolean {
  if (!options.dsn) {
    console.log('Sentry DSN not configured, error tracking disabled');
    return false;
  }

  if (sentryInitialized) {
    return true;
  }

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment ?? process.env.NODE_ENV ?? 'development',
    release: options.release ?? process.env.SERVICE_VERSION ?? '0.0.1',
    tracesSampleRate: options.sampleRate ?? 1.0,
    integrations: [
      // Add any additional integrations here
    ],
  });

  sentryInitialized = true;
  console.log(`Sentry initialized for environment: ${options.environment}`);
  return true;
}

/**
 * Fastify plugin that adds Sentry error tracking
 */
export async function sentryPlugin(
  app: FastifyInstance,
  options: SentryPluginOptions
): Promise<void> {
  // Initialize Sentry
  const enabled = initSentry(options);

  if (!enabled) {
    return;
  }

  // Add request context to Sentry
  app.addHook('onRequest', async (request) => {
    Sentry.setContext('request', {
      id: request.id,
      method: request.method,
      url: request.url,
      hostname: request.hostname,
      ip: request.ip,
    });

    // Set user context if available (after auth middleware)
    // This can be extended when authentication is implemented
    Sentry.setUser({
      ip_address: request.ip,
    });
  });

  // Capture errors in Sentry
  app.addHook('onError', async (request, reply, error) => {
    Sentry.captureException(error, {
      tags: {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      extra: {
        statusCode: reply.statusCode,
      },
    });
  });

  // Clear context after response
  app.addHook('onResponse', async () => {
    Sentry.setUser(null);
    Sentry.setContext('request', null);
  });
}

/**
 * Manually capture an exception in Sentry
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!sentryInitialized) {
    return;
  }
  Sentry.captureException(error, { extra: context });
}

/**
 * Manually capture a message in Sentry
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (!sentryInitialized) {
    return;
  }
  Sentry.captureMessage(message, level);
}

/**
 * Flush Sentry events (call before shutdown)
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!sentryInitialized) {
    return true;
  }
  return Sentry.flush(timeout);
}

/**
 * Check if Sentry is initialized
 */
export function isSentryEnabled(): boolean {
  return sentryInitialized;
}
