/**
 * Device routes - CRUD operations for IoT devices
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createDeviceSchema,
  updateDeviceSchema,
  deviceResponseSchema,
  deviceListResponseSchema,
  deviceQuerySchema,
  Errors,
  type OrganizationId,
} from '@argus/shared';
import { getDeviceRepository } from '../../repositories/index.js';
import { auditService } from '../../services/audit.service.js';

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  const deviceRepo = getDeviceRepository();

  // All device routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /devices - List all devices in current organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: deviceQuerySchema,
        response: {
          200: deviceListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, status, deviceTypeId, search } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      let result;

      if (status) {
        result = await deviceRepo.findByStatus(
          organizationId,
          status,
          { page, pageSize }
        );
      } else if (deviceTypeId) {
        result = await deviceRepo.findByDeviceType(
          organizationId,
          deviceTypeId,
          { page, pageSize }
        );
      } else if (search) {
        // For search, get all results then manually paginate
        const devices = await deviceRepo.searchByName(organizationId, search);
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = devices.slice(start, end);

        result = {
          data: paginatedData,
          pagination: {
            page,
            pageSize,
            totalCount: devices.length,
            totalPages: Math.ceil(devices.length / pageSize),
            hasNext: end < devices.length,
            hasPrevious: page > 1,
          },
        };
      } else {
        result = await deviceRepo.findAllInTenant(
          organizationId,
          { page, pageSize }
        );
      }

      return {
        data: result.data.map((device) => ({
          id: device.id,
          organizationId: device.organizationId,
          deviceTypeId: device.deviceTypeId,
          name: device.name,
          description: device.description,
          serialNumber: device.serialNumber,
          model: device.model,
          manufacturer: device.manufacturer,
          firmwareVersion: device.firmwareVersion,
          status: device.status,
          lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          ipAddress: device.ipAddress,
          macAddress: device.macAddress,
          geolocation: device.geolocation
            ? {
                lat: parseFloat(device.geolocation.split(',')[0]),
                lng: parseFloat(device.geolocation.split(',')[1]),
              }
            : null,
          customAttributes: device.customAttributes as Record<string, unknown>,
          createdBy: device.createdBy,
          createdAt: device.createdAt.toISOString(),
          updatedAt: device.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /devices/:id - Get a specific device
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: deviceResponseSchema,
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

      const device = await deviceRepo.findById(id, organizationId);

      if (!device) {
        throw Errors.notFound('Device', id);
      }

      return {
        id: device.id,
        organizationId: device.organizationId,
        deviceTypeId: device.deviceTypeId,
        name: device.name,
        description: device.description,
        serialNumber: device.serialNumber,
        model: device.model,
        manufacturer: device.manufacturer,
        firmwareVersion: device.firmwareVersion,
        status: device.status,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        geolocation: device.geolocation
          ? {
              lat: parseFloat(device.geolocation.split(',')[0]),
              lng: parseFloat(device.geolocation.split(',')[1]),
            }
          : null,
        customAttributes: device.customAttributes as Record<string, unknown>,
        createdBy: device.createdBy,
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString(),
      };
    }
  );

  // POST /devices - Create a new device
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createDeviceSchema,
        response: {
          201: deviceResponseSchema,
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
        deviceTypeId,
        name,
        description,
        serialNumber,
        model,
        manufacturer,
        firmwareVersion,
        status,
        ipAddress,
        macAddress,
        geolocation,
        customAttributes,
      } = request.body;

      // Check if serial number is unique (if provided)
      if (serialNumber) {
        const existing = await deviceRepo.findBySerialNumber(
          organizationId,
          serialNumber
        );
        if (existing) {
          throw Errors.conflict('Device with this serial number already exists');
        }
      }

      // Check if MAC address is unique (if provided)
      if (macAddress) {
        const existing = await deviceRepo.findByMacAddress(
          organizationId,
          macAddress
        );
        if (existing) {
          throw Errors.conflict('Device with this MAC address already exists');
        }
      }

      const device = await deviceRepo.create({
        organizationId,
        deviceTypeId,
        name,
        description: description ?? null,
        serialNumber: serialNumber ?? null,
        model: model ?? null,
        manufacturer: manufacturer ?? null,
        firmwareVersion: firmwareVersion ?? null,
        status,
        ipAddress: ipAddress ?? null,
        macAddress: macAddress ?? null,
        geolocation: geolocation
          ? `SRID=4326;POINT(${geolocation.lng} ${geolocation.lat})`
          : null,
        customAttributes,
        createdBy: userId,
      });

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'device.created',
        resourceType: 'device',
        resourceId: device.id,
        details: { name: device.name },
      });

      return reply.status(201).send({
        id: device.id,
        organizationId: device.organizationId,
        deviceTypeId: device.deviceTypeId,
        name: device.name,
        description: device.description,
        serialNumber: device.serialNumber,
        model: device.model,
        manufacturer: device.manufacturer,
        firmwareVersion: device.firmwareVersion,
        status: device.status,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        geolocation: device.geolocation
          ? {
              lat: parseFloat(device.geolocation.split(',')[0]),
              lng: parseFloat(device.geolocation.split(',')[1]),
            }
          : null,
        customAttributes: device.customAttributes as Record<string, unknown>,
        createdBy: device.createdBy,
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /devices/:id - Update a device
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateDeviceSchema,
        response: {
          200: deviceResponseSchema,
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

      // Check if device exists
      const exists = await deviceRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Device', id);
      }

      const updateData: any = { ...request.body };

      // Handle geolocation update
      if (request.body.geolocation) {
        const { lat, lng } = request.body.geolocation;
        updateData.geolocation = `SRID=4326;POINT(${lng} ${lat})`;
      }

      const device = await deviceRepo.update(id, organizationId, updateData);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'device.updated',
        resourceType: 'device',
        resourceId: id,
        details: { changes: Object.keys(request.body) },
      });

      return {
        id: device!.id,
        organizationId: device!.organizationId,
        deviceTypeId: device!.deviceTypeId,
        name: device!.name,
        description: device!.description,
        serialNumber: device!.serialNumber,
        model: device!.model,
        manufacturer: device!.manufacturer,
        firmwareVersion: device!.firmwareVersion,
        status: device!.status,
        lastSeenAt: device!.lastSeenAt?.toISOString() ?? null,
        ipAddress: device!.ipAddress,
        macAddress: device!.macAddress,
        geolocation: device!.geolocation
          ? {
              lat: parseFloat(device!.geolocation.split(',')[0]),
              lng: parseFloat(device!.geolocation.split(',')[1]),
            }
          : null,
        customAttributes: device!.customAttributes as Record<string, unknown>,
        createdBy: device!.createdBy,
        createdAt: device!.createdAt.toISOString(),
        updatedAt: device!.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /devices/:id - Soft delete a device
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

      // Check if device exists
      const device = await deviceRepo.findById(id, organizationId);
      if (!device) {
        throw Errors.notFound('Device', id);
      }

      await deviceRepo.softDelete(id, organizationId);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'device.deleted',
        resourceType: 'device',
        resourceId: id,
        details: { name: device.name },
      });

      return reply.status(204).send();
    }
  );

  // POST /devices/:id/heartbeat - Update device last_seen_at timestamp
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:id/heartbeat',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            lastSeenAt: z.string().datetime(),
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
      const organizationId = request.user!.organizationId as OrganizationId;

      // Check if device exists
      const exists = await deviceRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Device', id);
      }

      const device = await deviceRepo.updateLastSeen(id, organizationId);

      return {
        success: true,
        lastSeenAt: device!.lastSeenAt!.toISOString(),
      };
    }
  );
}
