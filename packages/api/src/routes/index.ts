/**
 * API route registration
 * Manages versioned route registration for the API
 */

import { FastifyInstance } from 'fastify';
import { registerV1Routes } from './v1/index.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Register v1 API routes under /api/v1
  await app.register(
    async (v1App) => {
      await registerV1Routes(v1App);
    },
    { prefix: '/api/v1' }
  );

  // Future versions can be added here:
  // await app.register(registerV2Routes, { prefix: '/api/v2' });
}
