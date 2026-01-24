/**
 * Rate Limiting Plugin
 *
 * Implements rate limiting with different limits for different endpoints.
 * Uses in-memory store by default, can be configured to use Redis/Valkey.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

/** Rate limit configuration */
interface RateLimitConfig {
  /** Global rate limit (requests per window) */
  global: number;
  /** Auth endpoints (login, register) - stricter limits */
  auth: number;
  /** Password reset - very strict */
  passwordReset: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/** Default rate limit configuration */
const defaultConfig: RateLimitConfig = {
  global: 100, // 100 requests per minute
  auth: 10, // 10 auth attempts per minute
  passwordReset: 3, // 3 password reset attempts per minute
  windowMs: 60 * 1000, // 1 minute window
};

/**
 * Determines rate limit based on request path
 */
function getMaxRequests(request: FastifyRequest, config: RateLimitConfig): number {
  const url = request.url;

  // Stricter limits for authentication endpoints
  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    return config.auth;
  }

  // Very strict limits for password reset
  if (url.includes('/auth/forgot-password') || url.includes('/auth/reset-password')) {
    return config.passwordReset;
  }

  return config.global;
}

/**
 * Key generator for rate limiting
 * Uses IP address for unauthenticated requests, user ID for authenticated
 */
function keyGenerator(request: FastifyRequest): string {
  // Use user ID if authenticated
  if (request.user?.id) {
    return `user:${request.user.id}`;
  }
  // Fall back to IP address
  return `ip:${request.ip}`;
}

/**
 * Rate limiting plugin
 */
async function rateLimitPlugin(
  app: FastifyInstance,
  options?: Partial<RateLimitConfig>
): Promise<void> {
  const config = { ...defaultConfig, ...options };

  await app.register(rateLimit, {
    global: true,
    max: (request) => getMaxRequests(request, config),
    timeWindow: config.windowMs,
    keyGenerator,
    // Custom error response
    errorResponseBuilder: (request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Please try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        timestamp: new Date().toISOString(),
      },
    }),
    // Allow list for health checks
    allowList: (request) => {
      return request.url.startsWith('/health');
    },
    // Skip rate limiting in development if needed
    // skip: () => process.env.NODE_ENV === 'development',
  });

  app.log.info('Rate limiting plugin registered');
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  fastify: '5.x',
});
