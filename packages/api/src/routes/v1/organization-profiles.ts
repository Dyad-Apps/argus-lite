/**
 * Organization Profile routes - CRUD operations for organization profiles
 * Organization profiles define capabilities and limits for organizations
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createOrganizationProfileSchema,
  updateOrganizationProfileSchema,
  organizationProfileResponseSchema,
  organizationProfileListResponseSchema,
  profileTypeSchema,
  Errors,
} from '@argus/shared';
import { getOrganizationProfileRepository } from '../../repositories/index.js';

export async function organizationProfileRoutes(app: FastifyInstance): Promise<void> {
  const profileRepo = getOrganizationProfileRepository();

  // Authentication with dev bypass for GET requests
  app.addHook('preHandler', async (request, reply) => {
    // Allow unauthenticated GET requests in development (for profile selection in forms)
    if (process.env.NODE_ENV !== 'production' && request.method === 'GET') {
      try {
        await app.authenticate(request, reply);
      } catch {
        // Allow through in dev mode for GET requests
        return;
      }
    } else {
      await app.authenticate(request, reply);
    }
  });

  // GET /organization-profiles - List all organization profiles
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          activeOnly: z.coerce.boolean().default(false),
          type: profileTypeSchema.optional(),
        }),
        response: {
          200: organizationProfileListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, activeOnly, type } = request.query;
      const result = await profileRepo.findAll({ page, pageSize, activeOnly, type });

      return {
        data: result.data.map((profile) => ({
          id: profile.id,
          name: profile.name,
          description: profile.description,
          type: profile.type,
          isSystem: profile.isSystem,
          capabilities: profile.capabilities ?? {},
          limits: profile.limits ?? {},
          isActive: profile.isActive,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /organization-profiles/:id - Get organization profile by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: organizationProfileResponseSchema,
          404: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const profile = await profileRepo.findById(request.params.id);

      if (!profile) {
        throw Errors.notFound('OrganizationProfile', request.params.id);
      }

      return {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        type: profile.type,
        isSystem: profile.isSystem,
        capabilities: profile.capabilities ?? {},
        limits: profile.limits ?? {},
        isActive: profile.isActive,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      };
    }
  );

  // POST /organization-profiles - Create a new organization profile
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createOrganizationProfileSchema,
        response: {
          201: organizationProfileResponseSchema,
          409: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, description, type, capabilities, limits } = request.body;

      // Check if name is available
      const isAvailable = await profileRepo.isNameAvailable(name);
      if (!isAvailable) {
        throw Errors.conflict('Organization profile with this name already exists');
      }

      const profile = await profileRepo.create({
        name,
        description,
        type,
        capabilities: capabilities ?? {},
        limits: limits ?? {},
        isSystem: false,
      });

      return reply.status(201).send({
        id: profile.id,
        name: profile.name,
        description: profile.description,
        type: profile.type,
        isSystem: profile.isSystem,
        capabilities: profile.capabilities ?? {},
        limits: profile.limits ?? {},
        isActive: profile.isActive,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /organization-profiles/:id - Update organization profile
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateOrganizationProfileSchema,
        response: {
          200: organizationProfileResponseSchema,
          403: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
          404: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
          409: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { name, ...updateData } = request.body;

      // Check if profile exists
      const existing = await profileRepo.findById(id);
      if (!existing) {
        throw Errors.notFound('OrganizationProfile', id);
      }

      // Check if trying to modify a system profile's core properties
      if (existing.isSystem && (name || updateData.type)) {
        throw Errors.forbidden('Cannot modify name or type of system profiles');
      }

      // If name is being changed, check availability
      if (name && name !== existing.name) {
        const isAvailable = await profileRepo.isNameAvailable(name, id);
        if (!isAvailable) {
          throw Errors.conflict('Organization profile with this name already exists');
        }
      }

      const profile = await profileRepo.update(id, { name, ...updateData });

      if (!profile) {
        throw Errors.notFound('OrganizationProfile', id);
      }

      return {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        type: profile.type,
        isSystem: profile.isSystem,
        capabilities: profile.capabilities ?? {},
        limits: profile.limits ?? {},
        isActive: profile.isActive,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /organization-profiles/:id - Delete organization profile
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.null(),
          403: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
          404: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.string(),
              message: z.string(),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Check if profile exists
      const existing = await profileRepo.findById(id);
      if (!existing) {
        throw Errors.notFound('OrganizationProfile', id);
      }

      // Check if it's a system profile
      if (existing.isSystem) {
        throw Errors.forbidden('Cannot delete system profiles');
      }

      // TODO: Check if profile is in use by any organizations

      const deleted = await profileRepo.delete(id);
      if (!deleted) {
        throw Errors.notFound('OrganizationProfile', id);
      }

      return reply.status(204).send(null);
    }
  );
}
