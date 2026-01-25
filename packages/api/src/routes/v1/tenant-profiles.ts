/**
 * Tenant Profile routes - CRUD operations for tenant profiles
 * Tenant profiles define capabilities and limits for organizations
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createTenantProfileSchema,
  updateTenantProfileSchema,
  tenantProfileResponseSchema,
  tenantProfileListResponseSchema,
  profileTypeSchema,
  Errors,
} from '@argus/shared';
import { getTenantProfileRepository } from '../../repositories/index.js';

export async function tenantProfileRoutes(app: FastifyInstance): Promise<void> {
  const profileRepo = getTenantProfileRepository();

  // All tenant profile routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /tenant-profiles - List all tenant profiles
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
          200: tenantProfileListResponseSchema,
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

  // GET /tenant-profiles/:id - Get tenant profile by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: tenantProfileResponseSchema,
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
        throw Errors.notFound('TenantProfile', request.params.id);
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

  // POST /tenant-profiles - Create a new tenant profile
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createTenantProfileSchema,
        response: {
          201: tenantProfileResponseSchema,
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
        throw Errors.conflict('Tenant profile with this name already exists');
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

  // PATCH /tenant-profiles/:id - Update tenant profile
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateTenantProfileSchema,
        response: {
          200: tenantProfileResponseSchema,
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
        throw Errors.notFound('TenantProfile', id);
      }

      // Check if trying to modify a system profile's core properties
      if (existing.isSystem && (name || updateData.type)) {
        throw Errors.forbidden('Cannot modify name or type of system profiles');
      }

      // If name is being changed, check availability
      if (name && name !== existing.name) {
        const isAvailable = await profileRepo.isNameAvailable(name, id);
        if (!isAvailable) {
          throw Errors.conflict('Tenant profile with this name already exists');
        }
      }

      const profile = await profileRepo.update(id, { name, ...updateData });

      if (!profile) {
        throw Errors.notFound('TenantProfile', id);
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

  // DELETE /tenant-profiles/:id - Delete tenant profile
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
        throw Errors.notFound('TenantProfile', id);
      }

      // Check if it's a system profile
      if (existing.isSystem) {
        throw Errors.forbidden('Cannot delete system profiles');
      }

      // TODO: Check if profile is in use by any organizations

      const deleted = await profileRepo.delete(id);
      if (!deleted) {
        throw Errors.notFound('TenantProfile', id);
      }

      return reply.status(204).send(null);
    }
  );
}
