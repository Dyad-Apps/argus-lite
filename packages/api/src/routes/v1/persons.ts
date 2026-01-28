/**
 * Person routes - CRUD operations for individuals in the organization
 * All routes require authentication
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createPersonSchema,
  updatePersonSchema,
  personResponseSchema,
  personListResponseSchema,
  personQuerySchema,
  Errors,
  type OrganizationId,
  type UserId,
} from '@argus/shared';
import { getPersonRepository, getUserRepository } from '../../repositories/index.js';
import { auditService } from '../../services/audit.service.js';

export async function personRoutes(app: FastifyInstance): Promise<void> {
  const personRepo = getPersonRepository();
  const userRepo = getUserRepository();

  // All person routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /persons - List all persons in current organization
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: personQuerySchema,
        response: {
          200: personListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize, personTypeId, department, search } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      let result;

      if (personTypeId) {
        result = await personRepo.findByPersonType(
          organizationId,
          personTypeId,
          { page, pageSize }
        );
      } else if (department) {
        result = await personRepo.findByDepartment(
          organizationId,
          department,
          { page, pageSize }
        );
      } else if (search) {
        // For search, get all results then manually paginate
        const persons = await personRepo.searchByName(organizationId, search);
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = persons.slice(start, end);

        result = {
          data: paginatedData,
          pagination: {
            page,
            pageSize,
            totalCount: persons.length,
            totalPages: Math.ceil(persons.length / pageSize),
            hasNext: end < persons.length,
            hasPrevious: page > 1,
          },
        };
      } else {
        result = await personRepo.findAllInTenant(
          organizationId,
          { page, pageSize }
        );
      }

      return {
        data: result.data.map((person) => ({
          id: person.id,
          organizationId: person.organizationId,
          personTypeId: person.personTypeId,
          userId: person.userId,
          name: person.name,
          email: person.email,
          phone: person.phone,
          title: person.title,
          department: person.department,
          geolocation: person.geolocation,
          customAttributes: person.customAttributes as Record<string, unknown>,
          createdBy: person.createdBy,
          createdAt: person.createdAt.toISOString(),
          updatedAt: person.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /persons/by-user/:userId - Get person by user ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/by-user/:userId',
    {
      schema: {
        params: z.object({
          userId: z.string().uuid(),
        }),
        response: {
          200: personResponseSchema,
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
      const { userId } = request.params;
      const organizationId = request.user!.organizationId as OrganizationId;

      const person = await personRepo.findByUserId(userId as UserId, organizationId);

      if (!person) {
        throw Errors.notFound('Person for user', userId);
      }

      return {
        id: person.id,
        organizationId: person.organizationId,
        personTypeId: person.personTypeId,
        userId: person.userId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        title: person.title,
        department: person.department,
        geolocation: person.geolocation,
        customAttributes: person.customAttributes as Record<string, unknown>,
        createdBy: person.createdBy,
        createdAt: person.createdAt.toISOString(),
        updatedAt: person.updatedAt.toISOString(),
      };
    }
  );

  // GET /persons/nearby - Find persons within radius (geospatial query)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/nearby',
    {
      schema: {
        querystring: z.object({
          lat: z.coerce.number().min(-90).max(90),
          lng: z.coerce.number().min(-180).max(180),
          radiusMeters: z.coerce.number().positive().default(1000),
        }),
        response: {
          200: z.object({
            data: z.array(personResponseSchema),
          }),
        },
      },
    },
    async (request) => {
      const { lat, lng, radiusMeters } = request.query;
      const organizationId = request.user!.organizationId as OrganizationId;

      const persons = await personRepo.findNearby(
        organizationId,
        lat,
        lng,
        radiusMeters
      );

      return {
        data: persons.map((person) => ({
          id: person.id,
          organizationId: person.organizationId,
          personTypeId: person.personTypeId,
          userId: person.userId,
          name: person.name,
          email: person.email,
          phone: person.phone,
          title: person.title,
          department: person.department,
          geolocation: person.geolocation,
          customAttributes: person.customAttributes as Record<string, unknown>,
          createdBy: person.createdBy,
          createdAt: person.createdAt.toISOString(),
          updatedAt: person.updatedAt.toISOString(),
        })),
      };
    }
  );

  // GET /persons/:id - Get a specific person
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: personResponseSchema,
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

      const person = await personRepo.findById(id, organizationId);

      if (!person) {
        throw Errors.notFound('Person', id);
      }

      return {
        id: person.id,
        organizationId: person.organizationId,
        personTypeId: person.personTypeId,
        userId: person.userId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        title: person.title,
        department: person.department,
        geolocation: person.geolocation,
        customAttributes: person.customAttributes as Record<string, unknown>,
        createdBy: person.createdBy,
        createdAt: person.createdAt.toISOString(),
        updatedAt: person.updatedAt.toISOString(),
      };
    }
  );

  // POST /persons - Create a new person
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: createPersonSchema,
        response: {
          201: personResponseSchema,
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
      const currentUserId = request.user!.id;

      const {
        personTypeId,
        userId,
        name,
        email,
        phone,
        title,
        department,
        customAttributes,
      } = request.body;

      // Verify user exists in the system
      const user = await userRepo.findById(userId as UserId);
      if (!user) {
        throw Errors.notFound('User', userId);
      }

      // Check if person already exists for this user
      const existing = await personRepo.findByUserId(userId as UserId, organizationId);
      if (existing) {
        throw Errors.conflict('Person already exists for this user');
      }

      // Check if email is unique (if provided)
      if (email) {
        const emailExists = await personRepo.findByEmail(organizationId, email);
        if (emailExists) {
          throw Errors.conflict('Person with this email already exists');
        }
      }

      const person = await personRepo.create({
        organizationId,
        personTypeId,
        userId,
        name,
        email: email ?? null,
        phone: phone ?? null,
        title: title ?? null,
        department: department ?? null,
        customAttributes,
        createdBy: currentUserId,
      });

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId: currentUserId,
        action: 'person.created',
        resourceType: 'person',
        resourceId: person.id,
        details: { name: person.name, userId },
      });

      return reply.status(201).send({
        id: person.id,
        organizationId: person.organizationId,
        personTypeId: person.personTypeId,
        userId: person.userId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        title: person.title,
        department: person.department,
        geolocation: person.geolocation,
        customAttributes: person.customAttributes as Record<string, unknown>,
        createdBy: person.createdBy,
        createdAt: person.createdAt.toISOString(),
        updatedAt: person.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /persons/:id - Update a person
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updatePersonSchema,
        response: {
          200: personResponseSchema,
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

      // Check if person exists
      const exists = await personRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Person', id);
      }

      // Check if email is unique (if provided and changed)
      if (request.body.email) {
        const emailExists = await personRepo.findByEmail(
          organizationId,
          request.body.email
        );
        if (emailExists && emailExists.id !== id) {
          throw Errors.conflict('Person with this email already exists');
        }
      }

      const person = await personRepo.update(id, organizationId, request.body);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'person.updated',
        resourceType: 'person',
        resourceId: id,
        details: { changes: Object.keys(request.body) },
      });

      return {
        id: person!.id,
        organizationId: person!.organizationId,
        personTypeId: person!.personTypeId,
        userId: person!.userId,
        name: person!.name,
        email: person!.email,
        phone: person!.phone,
        title: person!.title,
        department: person!.department,
        geolocation: person!.geolocation,
        customAttributes: person!.customAttributes as Record<string, unknown>,
        createdBy: person!.createdBy,
        createdAt: person!.createdAt.toISOString(),
        updatedAt: person!.updatedAt.toISOString(),
      };
    }
  );

  // PATCH /persons/:id/location - Update person location
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
          200: personResponseSchema,
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
      const userId = request.user!.id;

      // Check if person exists
      const exists = await personRepo.exists(id, organizationId);
      if (!exists) {
        throw Errors.notFound('Person', id);
      }

      const person = await personRepo.updateLocation(id, organizationId, lat, lng);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'person.location_updated',
        resourceType: 'person',
        resourceId: id,
        details: { lat, lng },
      });

      return {
        id: person!.id,
        organizationId: person!.organizationId,
        personTypeId: person!.personTypeId,
        userId: person!.userId,
        name: person!.name,
        email: person!.email,
        phone: person!.phone,
        title: person!.title,
        department: person!.department,
        geolocation: person!.geolocation,
        customAttributes: person!.customAttributes as Record<string, unknown>,
        createdBy: person!.createdBy,
        createdAt: person!.createdAt.toISOString(),
        updatedAt: person!.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /persons/:id - Soft delete a person
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

      // Check if person exists
      const person = await personRepo.findById(id, organizationId);
      if (!person) {
        throw Errors.notFound('Person', id);
      }

      await personRepo.softDelete(id, organizationId);

      // Audit log
      await auditService.log({
        organizationId,
        category: 'data_modification',
        userId,
        action: 'person.deleted',
        resourceType: 'person',
        resourceId: id,
        details: { name: person.name },
      });

      return reply.status(204).send();
    }
  );
}
