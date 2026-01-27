/**
 * Asset routes - CRUD operations for physical/logical assets
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createAssetSchema,
  updateAssetSchema,
  assetResponseSchema,
  assetListResponseSchema,
  assetQuerySchema,
  nearbyAssetsQuerySchema,
  Errors,
  type OrganizationId,
} from '@argus/shared';
import { getAssetRepository } from '../../repositories/index.js';
import { auditService } from '../../services/audit.service.js';
import { sql } from 'drizzle-orm';

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  const assetRepo = getAssetRepository();

  // All asset routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /assets - List all assets in current organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: assetQuerySchema,
        response: {
          200: assetListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, status, assetTypeId, parentAssetId, rootOnly, search } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      let result;

      if (status) {
        result = await assetRepo.findByStatus(
          organizationId,
          status,
          { page, pageSize }
        );
      } else if (assetTypeId) {
        result = await assetRepo.findByAssetType(
          organizationId,
          assetTypeId,
          { page, pageSize }
        );
      } else if (parentAssetId) {
        result = await assetRepo.findChildren(
          organizationId,
          parentAssetId,
          { page, pageSize }
        );
      } else if (rootOnly) {
        result = await assetRepo.findRootAssets(
          organizationId,
          { page, pageSize }
        );
      } else if (search) {
        // For search, get all results then manually paginate
        const assets = await assetRepo.searchByName(organizationId, search);
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = assets.slice(start, end);

        result = {
          data: paginatedData,
          pagination: {
            page,
            pageSize,
            totalCount: assets.length,
            totalPages: Math.ceil(assets.length / pageSize),
            hasNext: end < assets.length,
            hasPrevious: page > 1,
          },
        };
      } else {
        result = await assetRepo.findAllInTenant(
          organizationId,
          { page, pageSize }
        );
      }

      return {
        data: result.data.map((asset) => ({
          id: asset.id,
          organizationId: asset.organizationId,
          assetTypeId: asset.assetTypeId,
          parentAssetId: asset.parentAssetId,
          name: asset.name,
          description: asset.description,
          serialNumber: asset.serialNumber,
          model: asset.model,
          manufacturer: asset.manufacturer,
          status: asset.status,
          healthScore: asset.healthScore,
          geolocation: asset.geolocation
            ? {
                lat: parseFloat(asset.geolocation.split(',')[0]),
                lng: parseFloat(asset.geolocation.split(',')[1]),
              }
            : null,
          lastLocationUpdate: asset.lastLocationUpdate?.toISOString() ?? null,
          customAttributes: asset.customAttributes,
          createdBy: asset.createdBy,
          createdAt: asset.createdAt.toISOString(),
          updatedAt: asset.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /assets/nearby - Find assets near a location
  app.withTypeProvider<ZodTypeProvider>().get(
    '/nearby',
    {
      schema: {
        querystring: nearbyAssetsQuerySchema,
        response: {
          200: z.object({
            data: z.array(assetResponseSchema),
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

      const assets = await assetRepo.findNearby(
        organizationId,
        lat,
        lng,
        radiusMeters
      );

      return {
        data: assets.map((asset) => ({
          id: asset.id,
          organizationId: asset.organizationId,
          assetTypeId: asset.assetTypeId,
          parentAssetId: asset.parentAssetId,
          name: asset.name,
          description: asset.description,
          serialNumber: asset.serialNumber,
          model: asset.model,
          manufacturer: asset.manufacturer,
          status: asset.status,
          healthScore: asset.healthScore,
          geolocation: asset.geolocation
            ? {
                lat: parseFloat(asset.geolocation.split(',')[0]),
                lng: parseFloat(asset.geolocation.split(',')[1]),
              }
            : null,
          lastLocationUpdate: asset.lastLocationUpdate?.toISOString() ?? null,
          customAttributes: asset.customAttributes,
          createdBy: asset.createdBy,
          createdAt: asset.createdAt.toISOString(),
          updatedAt: asset.updatedAt.toISOString(),
        })),
        query: { lat, lng, radiusMeters },
      };
    }
  );

  // GET /assets/:id - Get a specific asset
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: assetResponseSchema,
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

      const asset = await assetRepo.findById(id, organizationId);

      if (!asset) {
        throw Errors.notFound('Asset', id);
      }

      return {
        id: asset.id,
        organizationId: asset.organizationId,
        assetTypeId: asset.assetTypeId,
        parentAssetId: asset.parentAssetId,
        name: asset.name,
        description: asset.description,
        serialNumber: asset.serialNumber,
        model: asset.model,
        manufacturer: asset.manufacturer,
        status: asset.status,
        healthScore: asset.healthScore,
        geolocation: asset.geolocation
          ? {
              lat: parseFloat(asset.geolocation.split(',')[0]),
              lng: parseFloat(asset.geolocation.split(',')[1]),
            }
          : null,
        lastLocationUpdate: asset.lastLocationUpdate?.toISOString() ?? null,
        customAttributes: asset.customAttributes,
        createdBy: asset.createdBy,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      };
    }
  );

  // GET /assets/:id/children - Get child assets
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
          200: assetListResponseSchema,
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

      // Check if parent asset exists
      const parentExists = await assetRepo.exists(id, organizationId);
      if (!parentExists) {
        throw Errors.notFound('Asset', id);
      }

      const result = await assetRepo.findChildren(
        organizationId,
        id,
        { page, pageSize }
      );

      return {
        data: result.data.map((asset) => ({
          id: asset.id,
          organizationId: asset.organizationId,
          assetTypeId: asset.assetTypeId,
          parentAssetId: asset.parentAssetId,
          name: asset.name,
          description: asset.description,
          serialNumber: asset.serialNumber,
          model: asset.model,
          manufacturer: asset.manufacturer,
          status: asset.status,
          healthScore: asset.healthScore,
          geolocation: asset.geolocation
            ? {
                lat: parseFloat(asset.geolocation.split(',')[0]),
                lng: parseFloat(asset.geolocation.split(',')[1]),
              }
            : null,
          lastLocationUpdate: asset.lastLocationUpdate?.toISOString() ?? null,
          customAttributes: asset.customAttributes,
          createdBy: asset.createdBy,
          createdAt: asset.createdAt.toISOString(),
          updatedAt: asset.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // POST /assets - Create a new asset
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createAssetSchema,
        response: {
          201: assetResponseSchema,
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
        assetTypeId,
        parentAssetId,
        name,
        description,
        serialNumber,
        model,
        manufacturer,
        status,
        healthScore,
        geolocation,
        customAttributes,
      } = request.body;

      // Check if serial number is unique (if provided)
      if (serialNumber) {
        const existing = await assetRepo.findBySerialNumber(
          organizationId,
          serialNumber
        );
        if (existing) {
          throw Errors.conflict('Asset with this serial number already exists');
        }
      }

      // Verify parent asset exists (if provided)
      if (parentAssetId) {
        const parentExists = await assetRepo.exists(parentAssetId, organizationId);
        if (!parentExists) {
          throw Errors.notFound('Parent asset', parentAssetId);
        }
      }

      const asset = await assetRepo.create({
        organizationId,
        assetTypeId,
        parentAssetId: parentAssetId ?? null,
        name,
        description: description ?? null,
        serialNumber: serialNumber ?? null,
        model: model ?? null,
        manufacturer: manufacturer ?? null,
        status,
        healthScore: healthScore?.toString() ?? null,
        geolocation: geolocation
          ? `SRID=4326;POINT(${geolocation.lng} ${geolocation.lat})`
          : null,
        lastLocationUpdate: geolocation ? new Date() : null,
        customAttributes,
        createdBy: userId,
      });

      // Audit log
      await auditService.log({
        organizationId,
        userId,
        action: 'asset.created',
        resourceType: 'asset',
        resourceId: asset.id,
        metadata: { name: asset.name },
      });

      return reply.status(201).send({
        id: asset.id,
        organizationId: asset.organizationId,
        assetTypeId: asset.assetTypeId,
        parentAssetId: asset.parentAssetId,
        name: asset.name,
        description: asset.description,
        serialNumber: asset.serialNumber,
        model: asset.model,
        manufacturer: asset.manufacturer,
        status: asset.status,
        healthScore: asset.healthScore,
        geolocation: asset.geolocation
          ? {
              lat: parseFloat(asset.geolocation.split(',')[0]),
              lng: parseFloat(asset.geolocation.split(',')[1]),
            }
          : null,
        lastLocationUpdate: asset.lastLocationUpdate?.toISOString() ?? null,
        customAttributes: asset.customAttributes,
        createdBy: asset.createdBy,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /assets/:id - Update an asset
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateAssetSchema,
        response: {
          200: assetResponseSchema,
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

      // Check if asset exists
      const exists = await assetRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Asset', id);
      }

      // Verify parent asset exists (if provided and not null)
      if (request.body.parentAssetId) {
        const parentExists = await assetRepo.exists(
          request.body.parentAssetId,
          organizationId
        );
        if (!parentExists) {
          throw Errors.notFound('Parent asset', request.body.parentAssetId);
        }

        // Prevent setting parent to self
        if (request.body.parentAssetId === id) {
          throw Errors.badRequest('Asset cannot be its own parent');
        }
      }

      const updateData: any = { ...request.body };

      // Handle geolocation update
      if (request.body.geolocation) {
        const { lat, lng } = request.body.geolocation;
        updateData.geolocation = `SRID=4326;POINT(${lng} ${lat})`;
        updateData.lastLocationUpdate = new Date();
      } else if (request.body.geolocation === null) {
        updateData.geolocation = null;
        updateData.lastLocationUpdate = null;
      }

      // Handle health score (convert to string for numeric column)
      if (request.body.healthScore !== undefined) {
        updateData.healthScore = request.body.healthScore?.toString();
      }

      const asset = await assetRepo.update(id, organizationId, updateData);

      // Audit log
      await auditService.log({
        organizationId,
        userId,
        action: 'asset.updated',
        resourceType: 'asset',
        resourceId: id,
        metadata: { changes: Object.keys(request.body) },
      });

      return {
        id: asset!.id,
        organizationId: asset!.organizationId,
        assetTypeId: asset!.assetTypeId,
        parentAssetId: asset!.parentAssetId,
        name: asset!.name,
        description: asset!.description,
        serialNumber: asset!.serialNumber,
        model: asset!.model,
        manufacturer: asset!.manufacturer,
        status: asset!.status,
        healthScore: asset!.healthScore,
        geolocation: asset!.geolocation
          ? {
              lat: parseFloat(asset!.geolocation.split(',')[0]),
              lng: parseFloat(asset!.geolocation.split(',')[1]),
            }
          : null,
        lastLocationUpdate: asset!.lastLocationUpdate?.toISOString() ?? null,
        customAttributes: asset!.customAttributes,
        createdBy: asset!.createdBy,
        createdAt: asset!.createdAt.toISOString(),
        updatedAt: asset!.updatedAt.toISOString(),
      };
    }
  );

  // PATCH /assets/:id/location - Update asset geolocation
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id/location',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            geolocation: z.object({
              lat: z.number(),
              lng: z.number(),
            }),
            lastLocationUpdate: z.string().datetime(),
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
    async (request) => {
      const { id } = request.params;
      const { lat, lng } = request.body;
      const organizationId = request.user!.organizationId as OrganizationId;

      // Check if asset exists
      const exists = await assetRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Asset', id);
      }

      const asset = await assetRepo.updateGeolocation(id, organizationId, lat, lng);

      return {
        success: true,
        geolocation: { lat, lng },
        lastLocationUpdate: asset!.lastLocationUpdate!.toISOString(),
      };
    }
  );

  // DELETE /assets/:id - Soft delete an asset
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

      // Check if asset exists
      const asset = await assetRepo.findById(id, organizationId);
      if (!asset) {
        throw Errors.notFound('Asset', id);
      }

      await assetRepo.softDelete(id, organizationId);

      // Audit log
      await auditService.log({
        organizationId,
        userId,
        action: 'asset.deleted',
        resourceType: 'asset',
        resourceId: id,
        metadata: { name: asset.name },
      });

      return reply.status(204).send();
    }
  );
}
