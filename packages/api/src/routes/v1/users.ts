/**
 * User routes - CRUD operations for users
 * Note: Authentication will be added in subsequent issues
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createUserSchema,
  updateUserSchema,
  userResponseSchema,
  userListResponseSchema,
  Errors,
  createUserId,
} from '@argus/shared';
import { getUserRepository } from '../../repositories/index.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const userRepo = getUserRepository();

  // GET /users - List all users
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: userListResponseSchema,
        },
      },
    },
    async (request) => {
      const { page, pageSize } = request.query;
      const result = await userRepo.findAll({ page, pageSize });

      return {
        data: result.data.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      };
    }
  );

  // GET /users/:id - Get user by ID
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: userResponseSchema,
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
      const userId = createUserId(request.params.id);
      const user = await userRepo.findById(userId);

      if (!user) {
        throw Errors.notFound('User', request.params.id);
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
    }
  );

  // PATCH /users/:id - Update user
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateUserSchema,
        response: {
          200: userResponseSchema,
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
      const userId = createUserId(request.params.id);
      const user = await userRepo.update(userId, request.body);

      if (!user) {
        throw Errors.notFound('User', request.params.id);
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /users/:id - Soft delete user
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.null(),
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
      const userId = createUserId(request.params.id);
      const deleted = await userRepo.softDelete(userId);

      if (!deleted) {
        throw Errors.notFound('User', request.params.id);
      }

      return reply.status(204).send(null);
    }
  );
}
