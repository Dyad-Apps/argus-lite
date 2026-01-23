/**
 * API v1 routes
 * All versioned routes are registered under /api/v1
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

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

  // Placeholder for entity routes (to be implemented in Sprint 1)
  // await app.register(entityRoutes, { prefix: '/entities' });

  // Placeholder for type definition routes (to be implemented in Sprint 1)
  // await app.register(typeRoutes, { prefix: '/types' });
}
