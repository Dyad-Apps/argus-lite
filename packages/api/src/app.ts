import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { getFastifyLoggerConfig } from '@argus/shared';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './plugins/error-handler.js';
import { sentryPlugin } from './plugins/sentry.js';

export type App = FastifyInstance;

export async function buildApp(): Promise<App> {
  const app = Fastify({
    logger: getFastifyLoggerConfig(),
    genReqId: () => crypto.randomUUID(), // Request ID generation
  });

  // CRITICAL: Set Zod compilers BEFORE registering routes
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Security plugins (order matters: helmet before cors)
  await app.register(helmet, {
    contentSecurityPolicy: false, // Configure properly in production
  });

  await app.register(cors, {
    origin: true, // Configure properly in production
    credentials: true,
  });

  // Register error handler
  await app.register(errorHandler);

  // Register Sentry error tracking (if configured)
  await app.register(sentryPlugin, {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SERVICE_VERSION,
    sampleRate: process.env.SENTRY_SAMPLE_RATE
      ? parseFloat(process.env.SENTRY_SAMPLE_RATE)
      : 1.0,
  });

  // Add request ID to response headers
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Health endpoints (unversioned)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/health/live',
    {
      schema: {
        response: {
          200: z.object({ status: z.literal('ok') }),
        },
      },
    },
    async () => ({ status: 'ok' as const })
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/health/ready',
    {
      schema: {
        response: {
          200: z.object({
            status: z.enum(['healthy', 'unhealthy']),
            version: z.string(),
            uptime: z.number(),
          }),
        },
      },
    },
    async () => ({
      status: 'healthy' as const,
      version: process.env.npm_package_version ?? 'unknown',
      uptime: process.uptime(),
    })
  );

  // Register versioned API routes
  await registerRoutes(app);

  return app;
}
