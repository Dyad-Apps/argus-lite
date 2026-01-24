/**
 * RLS Context Middleware
 *
 * Automatically sets PostgreSQL session variables for Row-Level Security
 * based on the authenticated user's context.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { setRlsContext, clearRlsContext } from '../db/rls-context.js';
import { db } from '../db/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    rlsContextSet?: boolean;
  }
}

export interface RlsContextOptions {
  /**
   * Whether to automatically set RLS context for all requests
   * Default: true
   */
  autoSet?: boolean;

  /**
   * Routes to exclude from automatic RLS context setting
   * Useful for public endpoints like health checks
   */
  excludeRoutes?: string[];
}

async function rlsContextPlugin(
  fastify: FastifyInstance,
  options: RlsContextOptions
): Promise<void> {
  const { autoSet = true, excludeRoutes = ['/health', '/ready'] } = options;

  if (!autoSet) {
    return;
  }

  // Add hook to set RLS context before handler
  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      // Skip excluded routes
      if (excludeRoutes.some((route) => request.url.startsWith(route))) {
        return;
      }

      // Get user context from session/JWT
      const user = (request as FastifyRequest & { user?: { id: string; organizationId?: string } }).user;

      if (user?.id) {
        await setRlsContext(db, user.id, user.organizationId ?? null);
        request.rlsContextSet = true;
      }
    }
  );

  // Add hook to clear RLS context after response
  fastify.addHook('onResponse', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.rlsContextSet) {
      await clearRlsContext(db);
    }
  });
}

export default fp(rlsContextPlugin, {
  name: 'rls-context',
  fastify: '5.x',
});
