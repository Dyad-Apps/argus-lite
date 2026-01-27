/**
 * Authentication plugin for JWT verification
 * Adds a preHandler hook that verifies access tokens
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { Errors, type UserId, type OrganizationId } from '@argus/shared';
import { verifyAccessToken, type DecodedAccessToken, type OrganizationContext } from '../utils/index.js';

/** Authenticated user data attached to request */
export interface AuthUser {
  id: UserId;
  email: string;

  /**
   * Organization context from JWT (ADR-002)
   * Provides tenant context for all authenticated requests
   */
  organizationContext?: OrganizationContext;
}

/** Extend FastifyRequest to include user */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Extracts Bearer token from Authorization header
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Auth plugin that adds authentication helpers
 */
async function authPlugin(app: FastifyInstance): Promise<void> {
  /**
   * Decorator to require authentication on a route
   * Use by adding { preHandler: app.authenticate } to route options
   */
  app.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const token = extractBearerToken(request);

      if (!token) {
        throw Errors.unauthorized('Missing access token');
      }

      const decoded = verifyAccessToken(token);
      if (!decoded) {
        throw Errors.unauthorized('Invalid or expired access token');
      }

      // Attach user to request with organization context
      request.user = {
        id: decoded.sub,
        email: decoded.email,
        organizationContext: decoded.org,
      };
    }
  );

  /**
   * Optional authentication - attaches user if token is valid, but doesn't fail
   */
  app.decorate(
    'optionalAuth',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const token = extractBearerToken(request);

      if (token) {
        const decoded = verifyAccessToken(token);
        if (decoded) {
          request.user = {
            id: decoded.sub,
            email: decoded.email,
            organizationContext: decoded.org,
          };
        }
      }
    }
  );
}

/** Extend FastifyInstance to include auth decorators */
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authPlugin, {
  name: 'auth',
  fastify: '5.x',
});
