/**
 * Request Context Plugin
 *
 * Sets up AsyncLocalStorage context for each request,
 * making request-scoped data available throughout the application.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  runWithContext,
  createRequestContext,
  type RequestContext,
} from '../context/index.js';

/**
 * Request context plugin
 * Wraps each request in an AsyncLocalStorage context
 */
async function requestContextPlugin(app: FastifyInstance): Promise<void> {
  // Wrap route handlers with request context
  app.addHook('onRequest', async (request, reply) => {
    const context = createRequestContext({
      requestId: request.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Store context reference on request for later updates
    (request as any).requestContext = context;
  });

  // Update context with user info after authentication
  app.addHook('preHandler', async (request, reply) => {
    const context = (request as any).requestContext as RequestContext | undefined;
    if (context && request.user) {
      context.userId = request.user.id;
      context.userEmail = request.user.email;
    }
  });

  // Decorator to run handler within context
  app.decorate('runInContext', function <T>(
    request: FastifyRequest,
    fn: () => T
  ): T {
    const context = (request as any).requestContext as RequestContext;
    if (!context) {
      return fn();
    }
    return runWithContext(context, fn);
  });
}

/** Extend FastifyInstance to include context decorator */
declare module 'fastify' {
  interface FastifyInstance {
    runInContext: <T>(request: FastifyRequest, fn: () => T) => T;
  }
}

export default fp(requestContextPlugin, {
  name: 'request-context',
  fastify: '5.x',
});
