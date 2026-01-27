/**
 * Type management routes - CRUD operations for all type definitions
 * Handles device_types, asset_types, person_types, activity_types, space_types
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createTypeSchema,
  updateTypeSchema,
  typeResponseSchema,
  typeListResponseSchema,
  typeQuerySchema,
  Errors,
  type OrganizationId,
} from '@argus/shared';
import {
  getTypeDefinitionRepository,
  type TypeKind,
} from '../../repositories/type-definition.repository.js';
import { auditService } from '../../services/audit.service.js';

export async function typeManagementRoutes(app: FastifyInstance): Promise<void> {
  const typeRepo = getTypeDefinitionRepository();

  // All type routes require authentication
  app.addHook('preHandler', app.authenticate);

  // Validate type kind parameter
  const typeKindSchema = z.enum(['device', 'asset', 'person', 'activity', 'space']);

  // GET /types/:kind - List all type definitions of a specific kind
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:kind',
    {
      schema: {
        params: z.object({
          kind: typeKindSchema,
        }),
        querystring: typeQuerySchema,
        response: {
          200: typeListResponseSchema,
        },
      },
    },
    async (request) => {
      const { kind } = request.params;
      const { page, pageSize, category, parentTypeId, includeSystem, search } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      let result;

      if (category) {
        result = await typeRepo.findByCategory(
          kind as TypeKind,
          organizationId,
          category,
          { page, pageSize }
        );
      } else if (parentTypeId) {
        result = await typeRepo.findChildren(
          kind as TypeKind,
          organizationId,
          parentTypeId,
          { page, pageSize }
        );
      } else if (search) {
        // For search, get all results then manually paginate
        const types = await typeRepo.searchByName(
          kind as TypeKind,
          organizationId,
          search
        );
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = types.slice(start, end);

        result = {
          data: paginatedData,
          pagination: {
            page,
            pageSize,
            totalCount: types.length,
            totalPages: Math.ceil(types.length / pageSize),
            hasNext: end < types.length,
            hasPrevious: page > 1,
          },
        };
      } else {
        result = await typeRepo.findAllInTenant(
          kind as TypeKind,
          organizationId,
          { page, pageSize, includeSystem }
        );
      }

      return {
        data: result.data.map((type) => ({
          id: type.id,
          organizationId: type.organizationId,
          name: type.name,
          description: type.description,
          icon: type.icon,
          category: type.category,
          attributeSchema: type.attributeSchema,
          telemetrySchema: type.telemetrySchema,
          presentationConfig: type.presentationConfig,
          parentTypeId: type.parentTypeId,
          isSystem: type.isSystem,
          createdBy: type.createdBy,
          createdAt: type.createdAt.toISOString(),
          updatedAt: type.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /types/:kind/:id - Get a specific type definition
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:kind/:id',
    {
      schema: {
        params: z.object({
          kind: typeKindSchema,
          id: z.string().uuid(),
        }),
        response: {
          200: typeResponseSchema,
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
      const { kind, id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;

      const type = await typeRepo.findById(
        kind as TypeKind,
        id,
        organizationId
      );

      if (!type) {
        throw Errors.notFound(`${kind} type`, id);
      }

      return {
        id: type.id,
        organizationId: type.organizationId,
        name: type.name,
        description: type.description,
        icon: type.icon,
        category: type.category,
        attributeSchema: type.attributeSchema,
        telemetrySchema: type.telemetrySchema,
        presentationConfig: type.presentationConfig,
        parentTypeId: type.parentTypeId,
        isSystem: type.isSystem,
        createdBy: type.createdBy,
        createdAt: type.createdAt.toISOString(),
        updatedAt: type.updatedAt.toISOString(),
      };
    }
  );

  // POST /types/:kind - Create a new type definition
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:kind',
    {
      schema: {
        params: z.object({
          kind: typeKindSchema,
        }),
        body: createTypeSchema,
        response: {
          201: typeResponseSchema,
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
      const { kind } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      const {
        name,
        description,
        icon,
        category,
        attributeSchema,
        telemetrySchema,
        presentationConfig,
        parentTypeId,
      } = request.body;

      // Check if name is unique within organization
      const existing = await typeRepo.findByName(
        kind as TypeKind,
        organizationId,
        name
      );
      if (existing) {
        throw Errors.conflict(`${kind} type with this name already exists`);
      }

      // Verify parent type exists (if provided)
      if (parentTypeId) {
        const parentExists = await typeRepo.exists(
          kind as TypeKind,
          parentTypeId,
          organizationId
        );
        if (!parentExists) {
          throw Errors.notFound(`Parent ${kind} type`, parentTypeId);
        }
      }

      const type = await typeRepo.create(kind as TypeKind, {
        organizationId,
        name,
        description: description ?? null,
        icon: icon ?? null,
        category: category ?? null,
        attributeSchema: attributeSchema ?? null,
        telemetrySchema: telemetrySchema ?? null,
        presentationConfig: presentationConfig ?? null,
        parentTypeId: parentTypeId ?? null,
        isSystem: false,
        createdBy: userId,
      });

      // Audit log
      await auditService.log({
        organizationId,
        userId,
        action: `${kind}_type.created`,
        resourceType: `${kind}_type`,
        resourceId: type.id,
        metadata: { name: type.name },
      });

      return reply.status(201).send({
        id: type.id,
        organizationId: type.organizationId,
        name: type.name,
        description: type.description,
        icon: type.icon,
        category: type.category,
        attributeSchema: type.attributeSchema,
        telemetrySchema: type.telemetrySchema,
        presentationConfig: type.presentationConfig,
        parentTypeId: type.parentTypeId,
        isSystem: type.isSystem,
        createdBy: type.createdBy,
        createdAt: type.createdAt.toISOString(),
        updatedAt: type.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /types/:kind/:id - Update a type definition
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:kind/:id',
    {
      schema: {
        params: z.object({
          kind: typeKindSchema,
          id: z.string().uuid(),
        }),
        body: updateTypeSchema,
        response: {
          200: typeResponseSchema,
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
      const { kind, id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      // Check if type exists
      const existing = await typeRepo.findById(
        kind as TypeKind,
        id,
        organizationId
      );
      if (!existing) {
        throw Errors.notFound(`${kind} type`, id);
      }

      // Prevent modification of system types
      if (existing.isSystem) {
        throw Errors.forbidden('Cannot modify system type definitions');
      }

      // Check if name is unique (if changed)
      if (request.body.name && request.body.name !== existing.name) {
        const nameExists = await typeRepo.findByName(
          kind as TypeKind,
          organizationId,
          request.body.name
        );
        if (nameExists) {
          throw Errors.conflict(`${kind} type with this name already exists`);
        }
      }

      // Verify parent type exists (if provided and not null)
      if (request.body.parentTypeId) {
        const parentExists = await typeRepo.exists(
          kind as TypeKind,
          request.body.parentTypeId,
          organizationId
        );
        if (!parentExists) {
          throw Errors.notFound(`Parent ${kind} type`, request.body.parentTypeId);
        }

        // Prevent setting parent to self
        if (request.body.parentTypeId === id) {
          throw Errors.badRequest('Type cannot be its own parent');
        }
      }

      const type = await typeRepo.update(
        kind as TypeKind,
        id,
        organizationId,
        request.body
      );

      // Audit log
      await auditService.log({
        organizationId,
        userId,
        action: `${kind}_type.updated`,
        resourceType: `${kind}_type`,
        resourceId: id,
        metadata: { changes: Object.keys(request.body) },
      });

      return {
        id: type!.id,
        organizationId: type!.organizationId,
        name: type!.name,
        description: type!.description,
        icon: type!.icon,
        category: type!.category,
        attributeSchema: type!.attributeSchema,
        telemetrySchema: type!.telemetrySchema,
        presentationConfig: type!.presentationConfig,
        parentTypeId: type!.parentTypeId,
        isSystem: type!.isSystem,
        createdBy: type!.createdBy,
        createdAt: type!.createdAt.toISOString(),
        updatedAt: type!.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /types/:kind/:id - Delete a type definition
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:kind/:id',
    {
      schema: {
        params: z.object({
          kind: typeKindSchema,
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
      const { kind, id } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;
      const userId = request.user!.id;

      // Check if type exists
      const existing = await typeRepo.findById(
        kind as TypeKind,
        id,
        organizationId
      );
      if (!existing) {
        throw Errors.notFound(`${kind} type`, id);
      }

      // Prevent deletion of system types
      if (existing.isSystem) {
        throw Errors.forbidden('Cannot delete system type definitions');
      }

      await typeRepo.delete(kind as TypeKind, id, organizationId);

      // Audit log
      await auditService.log({
        organizationId,
        userId,
        action: `${kind}_type.deleted`,
        resourceType: `${kind}_type`,
        resourceId: id,
        metadata: { name: existing.name },
      });

      return reply.status(204).send();
    }
  );
}
