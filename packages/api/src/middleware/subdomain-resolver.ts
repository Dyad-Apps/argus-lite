/**
 * Subdomain Resolver Middleware
 *
 * Extracts subdomain from request host and resolves to root organization ID
 * per ADR-002: Subdomain-Based Root Tenant Identification.
 *
 * This middleware must run BEFORE authentication middleware to establish
 * the organization context for subsequent operations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { getOrganizationRepository } from '../repositories/organization.repository.js';
import type { OrganizationId } from '@argus/shared';
import { createOrganizationId } from '@argus/shared';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * The subdomain extracted from the request host
     */
    subdomain?: string;

    /**
     * The resolved root organization ID
     */
    rootOrganizationId?: OrganizationId;

    /**
     * The full root organization object (for additional context like branding)
     */
    rootOrganization?: {
      id: OrganizationId;
      name: string;
      subdomain: string;
      isActive: boolean;
    };
  }
}

export interface SubdomainResolverOptions {
  /**
   * The base domain for the application (e.g., 'argusiq.com')
   * Subdomains will be extracted relative to this domain.
   */
  baseDomain: string;

  /**
   * Default subdomain to use when no subdomain is present (e.g., 'app')
   * If not provided, requests without subdomain will be rejected.
   */
  defaultSubdomain?: string;

  /**
   * Subdomains to ignore (e.g., ['www', 'api'])
   * These will be treated as if no subdomain is present.
   */
  ignoreSubdomains?: string[];

  /**
   * Routes to exclude from subdomain resolution
   * Useful for health checks, metrics, etc.
   */
  excludeRoutes?: string[];

  /**
   * Whether to require a valid organization for all requests
   * If true, requests with invalid subdomains will be rejected.
   * Default: true
   */
  requireOrganization?: boolean;
}

/**
 * Extracts subdomain from hostname
 * Examples:
 *   - acme.argusiq.com -> acme
 *   - app.argusiq.com -> app
 *   - argusiq.com -> null
 *   - localhost:3040 -> null
 */
function extractSubdomain(
  hostname: string,
  baseDomain: string,
  ignoreSubdomains: string[]
): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Handle localhost and IP addresses
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return null;
  }

  // Check if host ends with base domain
  if (!host.endsWith(baseDomain)) {
    return null;
  }

  // Extract subdomain part
  const subdomainPart = host.slice(0, -baseDomain.length - 1); // -1 for the dot

  // If no subdomain part, return null
  if (!subdomainPart) {
    return null;
  }

  // Handle multi-level subdomains (e.g., admin.acme.argusiq.com)
  // We only care about the leftmost subdomain
  const parts = subdomainPart.split('.');
  const subdomain = parts[parts.length - 1]; // Take the last part (rightmost)

  // Check if subdomain should be ignored
  if (ignoreSubdomains.includes(subdomain.toLowerCase())) {
    return null;
  }

  return subdomain.toLowerCase();
}

async function subdomainResolverPlugin(
  fastify: FastifyInstance,
  options: SubdomainResolverOptions
): Promise<void> {
  const {
    baseDomain,
    defaultSubdomain,
    ignoreSubdomains = ['www', 'api'],
    excludeRoutes = ['/health', '/ready', '/metrics'],
    requireOrganization = true,
  } = options;

  if (!baseDomain) {
    throw new Error('baseDomain is required for subdomain resolver');
  }

  const orgRepo = getOrganizationRepository();

  // Add hook to resolve subdomain before handler
  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip excluded routes
      if (excludeRoutes.some((route) => request.url.startsWith(route))) {
        return;
      }

      // Extract hostname from headers
      const hostname = request.hostname;
      if (!hostname) {
        if (requireOrganization) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Host header is required',
          });
        }
        return;
      }

      // Extract subdomain
      let subdomain = extractSubdomain(hostname, baseDomain, ignoreSubdomains);

      // Use default subdomain if none provided
      if (!subdomain && defaultSubdomain) {
        subdomain = defaultSubdomain;
      }

      // If still no subdomain and organization is required, reject
      if (!subdomain) {
        if (requireOrganization) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Organization subdomain is required',
          });
        }
        return;
      }

      // Attach subdomain to request
      request.subdomain = subdomain;

      // Resolve subdomain to organization
      try {
        const organization = await orgRepo.findBySubdomain(subdomain);

        if (!organization) {
          if (requireOrganization) {
            return reply.code(404).send({
              error: 'Not Found',
              message: `Organization with subdomain '${subdomain}' not found`,
            });
          }
          return;
        }

        // Check if organization is active
        if (!organization.isActive) {
          return reply.code(403).send({
            error: 'Forbidden',
            message: 'This organization is not active',
          });
        }

        // Attach organization context to request
        request.rootOrganizationId = createOrganizationId(organization.id);
        request.rootOrganization = {
          id: createOrganizationId(organization.id),
          name: organization.name,
          subdomain: organization.subdomain!,
          isActive: organization.isActive,
        };

        // Log subdomain resolution for debugging
        request.log.debug({
          subdomain,
          rootOrganizationId: organization.id,
          organizationName: organization.name,
        }, 'Subdomain resolved');
      } catch (error) {
        request.log.error({ error, subdomain }, 'Error resolving subdomain');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to resolve organization',
        });
      }
    }
  );
}

export default fp(subdomainResolverPlugin, {
  name: 'subdomain-resolver',
  fastify: '5.x',
});
