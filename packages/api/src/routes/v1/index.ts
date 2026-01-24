/**
 * API v1 routes
 * All versioned routes are registered under /api/v1
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { userRoutes } from './users.js';
import { authRoutes } from './auth.js';
import { ssoRoutes } from './sso.js';
import { socialAuthRoutes } from './social-auth.js';
import { organizationRoutes } from './organizations.js';
import { invitationRoutes } from './invitations.js';
import { dashboardRoutes } from './dashboard.js';
import { auditLogRoutes } from './audit-logs.js';

export async function registerV1Routes(app: FastifyInstance): Promise<void> {
  // Version info endpoint
  app.withTypeProvider<ZodTypeProvider>().get(
    '/version',
    {
      schema: {
        response: {
          200: z.object({
            api: z.literal('v1'),
            version: z.string(),
          }),
        },
      },
    },
    async () => ({
      api: 'v1' as const,
      version: process.env.SERVICE_VERSION ?? '0.0.1',
    })
  );

  // Auth routes (email/password + social login)
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(socialAuthRoutes, { prefix: '/auth' });

  // SSO routes (enterprise identity providers)
  await app.register(ssoRoutes, { prefix: '/sso' });

  // User routes
  await app.register(userRoutes, { prefix: '/users' });

  // Organization routes
  await app.register(organizationRoutes, { prefix: '/organizations' });

  // Invitation routes (no prefix, routes include full paths)
  await app.register(invitationRoutes);

  // Dashboard routes (stats and metrics)
  await app.register(dashboardRoutes, { prefix: '/dashboard' });

  // Audit log routes (security and compliance)
  await app.register(auditLogRoutes, { prefix: '/audit-logs' });
}
