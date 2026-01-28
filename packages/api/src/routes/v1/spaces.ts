/**
 * Space routes - CRUD operations for hierarchical locations
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createSpaceSchema,
  updateSpaceSchema,
  spaceResponseSchema,
  spaceListResponseSchema,
  spaceQuerySchema,
  nearbySpacesQuerySchema,
  pointInSpaceQuerySchema,
  Errors,
  type OrganizationId,
} from '@argus/shared';
import { getSpaceRepository } from '../../repositories/index.js';
import { auditService } from '../../services/audit.service.js';

export async function spaceRoutes(app: FastifyInstance): Promise<void> {
  const spaceRepo = getSpaceRepository();

  // All space routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /spaces - List all spaces in current organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: spaceQuerySchema,
        response: {
          200: spaceListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, spaceTypeId, parentSpaceId, floorLevel, rootOnly, search } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      let result;

      if (spaceTypeId) {
        result = await spaceRepo.findBySpaceType(
          organizationId,
          spaceTypeId,
          { page, pageSize }
        );
      } else if (parentSpaceId) {
        result = await spaceRepo.findChildren(
          organizationId,
          parentSpaceId,
          { page, pageSize }
        );
      } else if (floorLevel !== undefined) {
        result = await spaceRepo.findByFloorLevel(
          organizationId,
          floorLevel,
          { page, pageSize }
        );
      } else if (rootOnly) {
        result = await spaceRepo.findRootSpaces(
          organizationId,
          { page, pageSize }
        );
      } else if (search) {
        // For search, get all results then manually paginate
        const spaces = await spaceRepo.searchByName(organizationId, search);
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = spaces.slice(start, end);

        result = {
          data: paginatedData,
          pagination: {
            page,
            pageSize,
            totalCount: spaces.length,
            totalPages: Math.ceil(spaces.length / pageSize),
            hasNext: end < spaces.length,
            hasPrevious: page > 1,
          },
        };
      } else {
        result = await spaceRepo.findAllInTenant(
          organizationId,
          { page, pageSize }
        );
      }

      return {
        data: result.data.map((space) => ({
          id: space.id,
          organizationId: space.organizationId,
          spaceTypeId: space.spaceTypeId,
          parentSpaceId: space.parentSpaceId,
          name: space.name,
          description: space.description,
          spaceCode: space.spaceCode,
          floorLevel: space.floorLevel,
          areaSqm: space.areaSqm,
          capacity: space.capacity,
          geolocation: space.geolocation
            ? {
                lat: parseFloat(space.geolocation.split(',')[0]),
                lng: parseFloat(space.geolocation.split(',')[1]),
              }
            : null,
          geofence: space.geofence
            ? JSON.parse(space.geofence) // Parse GeoJSON from DB
            : null,
          isActive: space.isActive ?? false,
          customAttributes: space.customAttributes as Record<string, unknown>,
          createdBy: space.createdBy,
          createdAt: space.createdAt.toISOString(),
          updatedAt: space.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /spaces/nearby - Find spaces near a location
  app.withTypeProvider<ZodTypeProvider>().get(
    '/nearby',
    {
      schema: {
        querystring: nearbySpacesQuerySchema,
        response: {
          200: z.object({
            data: z.array(spaceResponseSchema),
            query: z.object({
              lat: z.number(),
              lng: z.number(),
              radiusMeters: z.number(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { lat, lng, radiusMeters } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      const spaces = await spaceRepo.findNearby(
        organizationId,
        lat,
        lng,
        radiusMeters
      );

      return {
        data: spaces.map((space) => ({
          id: space.id,
          organizationId: space.organizationId,
          spaceTypeId: space.spaceTypeId,
          parentSpaceId: space.parentSpaceId,
          name: space.name,
          description: space.description,
          spaceCode: space.spaceCode,
          floorLevel: space.floorLevel,
          areaSqm: space.areaSqm,
          capacity: space.capacity,
          geolocation: space.geolocation
            ? {
                lat: parseFloat(space.geolocation.split(',')[0]),
                lng: parseFloat(space.geolocation.split(',')[1]),
              }
            : null,
          geofence: space.geofence
            ? JSON.parse(space.geofence)
            : null,
          isActive: space.isActive ?? false,
          customAttributes: space.customAttributes as Record<string, unknown>,
          createdBy: space.createdBy,
          createdAt: space.createdAt.toISOString(),
          updatedAt: space.updatedAt.toISOString(),
        })),
        query: { lat, lng, radiusMeters },
      };
    }
  );

  // GET /spaces/containing - Find spaces containing a point (point-in-polygon)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/containing',
    {
      schema: {
        querystring: pointInSpaceQuerySchema,
        response: {
          200: z.object({
            data: z.array(spaceResponseSchema),
            query: z.object({
              lat: z.number(),
              lng: z.number(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { lat, lng } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      const spaces = await spaceRepo.findContainingPoint(
        organizationId,
        lat,
        lng
      );

      return {
        data: spaces.map((space) => ({
          id: space.id,
          organizationId: space.organizationId,
          spaceTypeId: space.spaceTypeId,
          parentSpaceId: space.parentSpaceId,
          name: space.name,
          description: space.description,
          spaceCode: space.spaceCode,
          floorLevel: space.floorLevel,
          areaSqm: space.areaSqm,
          capacity: space.capacity,
          geolocation: space.geolocation
            ? {
                lat: parseFloat(space.geolocation.split(',')[0]),
                lng: parseFloat(space.geolocation.split(',')[1]),
              }
            : null,
          geofence: space.geofence
            ? JSON.parse(space.geofence)
            : null,
          isActive: space.isActive ?? false,
          customAttributes: space.customAttributes as Record<string, unknown>,
          createdBy: space.createdBy,
          createdAt: space.createdAt.toISOString(),
          updatedAt: space.updatedAt.toISOString(),
        })),
        query: { lat, lng },
      };
    }
  );

  // GET /spaces/:id - Get a specific space
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: spaceResponseSchema,
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
      const { id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;

      const space = await spaceRepo.findById(id, organizationId);

      if (!space) {
        throw Errors.notFound('Space', id);
      }

      return {
        id: space.id,
        organizationId: space.organizationId,
        spaceTypeId: space.spaceTypeId,
        parentSpaceId: space.parentSpaceId,
        name: space.name,
        description: space.description,
        spaceCode: space.spaceCode,
        floorLevel: space.floorLevel,
        areaSqm: space.areaSqm,
        capacity: space.capacity,
        geolocation: space.geolocation
          ? {
              lat: parseFloat(space.geolocation.split(',')[0]),
              lng: parseFloat(space.geolocation.split(',')[1]),
            }
          : null,
        geofence: space.geofence
          ? JSON.parse(space.geofence)
          : null,
        isActive: space.isActive ?? false,
        customAttributes: space.customAttributes as Record<string, unknown>,
        createdBy: space.createdBy,
        createdAt: space.createdAt.toISOString(),
        updatedAt: space.updatedAt.toISOString(),
      };
    }
  );

  // GET /spaces/:id/children - Get child spaces
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id/children',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: spaceListResponseSchema,
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
      const { id } = request.params;
      const { page, pageSize } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      // Check if parent space exists
      const parentExists = await spaceRepo.exists(id, organizationId);
      if (!parentExists) {
        throw Errors.notFound('Space', id);
      }

      const result = await spaceRepo.findChildren(
        organizationId,
        id,
        { page, pageSize }
      );

      return {
        data: result.data.map((space) => ({
          id: space.id,
          organizationId: space.organizationId,
          spaceTypeId: space.spaceTypeId,
          parentSpaceId: space.parentSpaceId,
          name: space.name,
          description: space.description,
          spaceCode: space.spaceCode,
          floorLevel: space.floorLevel,
          areaSqm: space.areaSqm,
          capacity: space.capacity,
          geolocation: space.geolocation
            ? {
                lat: parseFloat(space.geolocation.split(',')[0]),
                lng: parseFloat(space.geolocation.split(',')[1]),
              }
            : null,
          geofence: space.geofence
            ? JSON.parse(space.geofence)
            : null,
          isActive: space.isActive ?? false,
          customAttributes: space.customAttributes as Record<string, unknown>,
          createdBy: space.createdBy,
          createdAt: space.createdAt.toISOString(),
          updatedAt: space.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // POST /spaces - Create a new space
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createSpaceSchema,
        response: {
          201: spaceResponseSchema,
          400: z.object({
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
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      const {
        spaceTypeId,
        parentSpaceId,
        name,
        description,
        spaceCode,
        floorLevel,
        areaSqm,
        capacity,
        geolocation,
        geofence,
        isActive,
        customAttributes,
      } = request.body;

      // Check if space code is unique (if provided)
      if (spaceCode) {
        const existing = await spaceRepo.findBySpaceCode(
          organizationId,
          spaceCode
        );
        if (existing) {
          throw Errors.conflict('Space with this code already exists');
        }
      }

      // Verify parent space exists (if provided)
      if (parentSpaceId) {
        const parentExists = await spaceRepo.exists(parentSpaceId, organizationId);
        if (!parentExists) {
          throw Errors.notFound('Parent space', parentSpaceId);
        }
      }

      const space = await spaceRepo.create({
        organizationId,
        spaceTypeId,
        parentSpaceId: parentSpaceId ?? null,
        name,
        description: description ?? null,
        spaceCode: spaceCode ?? null,
        floorLevel: floorLevel ?? null,
        areaSqm: areaSqm?.toString() ?? null,
        capacity: capacity ?? null,
        geolocation: geolocation
          ? `SRID=4326;POINT(${geolocation.lng} ${geolocation.lat})`
          : null,
        geofence: geofence
          ? JSON.stringify(geofence) // Store as GeoJSON
          : null,
        isActive,
        customAttributes,
        createdBy: userId,
      });

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'space.created',
        resourceType: 'space',
        resourceId: space.id,
        details: { name: space.name },
      });

      return reply.status(201).send({
        id: space.id,
        organizationId: space.organizationId,
        spaceTypeId: space.spaceTypeId,
        parentSpaceId: space.parentSpaceId,
        name: space.name,
        description: space.description,
        spaceCode: space.spaceCode,
        floorLevel: space.floorLevel,
        areaSqm: space.areaSqm,
        capacity: space.capacity,
        geolocation: space.geolocation
          ? {
              lat: parseFloat(space.geolocation.split(',')[0]),
              lng: parseFloat(space.geolocation.split(',')[1]),
            }
          : null,
        geofence: space.geofence
          ? JSON.parse(space.geofence)
          : null,
        isActive: space.isActive ?? false,
        customAttributes: space.customAttributes as Record<string, unknown>,
        createdBy: space.createdBy,
        createdAt: space.createdAt.toISOString(),
        updatedAt: space.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /spaces/:id - Update a space
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateSpaceSchema,
        response: {
          200: spaceResponseSchema,
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
      const { id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      // Check if space exists
      const exists = await spaceRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Space', id);
      }

      // Verify parent space exists (if provided and not null)
      if (request.body.parentSpaceId) {
        const parentExists = await spaceRepo.exists(
          request.body.parentSpaceId,
          organizationId
        );
        if (!parentExists) {
          throw Errors.notFound('Parent space', request.body.parentSpaceId);
        }

        // Prevent setting parent to self
        if (request.body.parentSpaceId === id) {
          throw Errors.badRequest('Space cannot be its own parent');
        }
      }

      const updateData: any = { ...request.body };

      // Handle geolocation update
      if (request.body.geolocation) {
        const { lat, lng } = request.body.geolocation;
        updateData.geolocation = `SRID=4326;POINT(${lng} ${lat})`;
      } else if (request.body.geolocation === null) {
        updateData.geolocation = null;
      }

      // Handle geofence update
      if (request.body.geofence) {
        updateData.geofence = JSON.stringify(request.body.geofence);
      } else if (request.body.geofence === null) {
        updateData.geofence = null;
      }

      // Handle areaSqm (convert to string for numeric column)
      if (request.body.areaSqm !== undefined) {
        updateData.areaSqm = request.body.areaSqm?.toString();
      }

      const space = await spaceRepo.update(id, organizationId, updateData);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'space.updated',
        resourceType: 'space',
        resourceId: id,
        details: { changes: Object.keys(request.body) },
      });

      return {
        id: space!.id,
        organizationId: space!.organizationId,
        spaceTypeId: space!.spaceTypeId,
        parentSpaceId: space!.parentSpaceId,
        name: space!.name,
        description: space!.description,
        spaceCode: space!.spaceCode,
        floorLevel: space!.floorLevel,
        areaSqm: space!.areaSqm,
        capacity: space!.capacity,
        geolocation: space!.geolocation
          ? {
              lat: parseFloat(space!.geolocation.split(',')[0]),
              lng: parseFloat(space!.geolocation.split(',')[1]),
            }
          : null,
        geofence: space!.geofence
          ? JSON.parse(space!.geofence)
          : null,
        isActive: space!.isActive ?? false,
        customAttributes: space!.customAttributes as Record<string, unknown>,
        createdBy: space!.createdBy,
        createdAt: space!.createdAt.toISOString(),
        updatedAt: space!.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /spaces/:id - Soft delete a space
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.undefined(),
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
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      // Check if space exists
      const space = await spaceRepo.findById(id, organizationId);
      if (!space) {
        throw Errors.notFound('Space', id);
      }

      await spaceRepo.softDelete(id, organizationId);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'space.deleted',
        resourceType: 'space',
        resourceId: id,
        details: { name: space.name },
      });

      return reply.status(204).send();
    }
  );
}
