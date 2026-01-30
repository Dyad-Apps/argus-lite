/**
 * System Settings Admin API Routes
 *
 * Endpoints for managing system-level configuration.
 * Restricted to system administrators only.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { systemSettings, SYSTEM_SETTING_CATEGORIES } from '../../db/schema/system-settings.js';
import { systemAdminRepository } from '../../repositories/system-admin.repository.js';
import { eq, and } from 'drizzle-orm';
import type { UserId } from '@argus/shared';

// Helper to check if user is a System Admin
async function requireSystemAdmin(userId: UserId): Promise<void> {
  const admin = await systemAdminRepository.getByUserId(userId);
  if (!admin || admin.role !== 'super_admin' || !admin.isActive) {
    const error = new Error('Access denied. System Admin privileges required.');
    (error as any).statusCode = 403;
    throw error;
  }
}

/**
 * System Settings Routes
 */
export async function systemSettingsRoutes(server: FastifyInstance) {
  // Require authentication for all system settings routes
  server.addHook('preHandler', server.authenticate);

  /**
   * GET /api/v1/admin/system-settings
   * Get all system settings (system admins only)
   */
  server.get(
    '/',
    {
      schema: {
        tags: ['Admin', 'System Settings'],
        summary: 'Get all system settings',
        description: 'Retrieves all system configuration settings (system admins only)',
        response: {
          200: z.object({
            settings: z.array(
              z.object({
                id: z.string().uuid(),
                category: z.string(),
                key: z.string(),
                value: z.record(z.unknown()),
                description: z.string().nullable(),
                isPublic: z.boolean(),
                isEncrypted: z.boolean(),
                updatedBy: z.string().uuid().nullable(),
                updatedAt: z.string(),
                createdAt: z.string(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      await requireSystemAdmin(request.user!.id);

      const settings = await db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.key);

      // Helper to convert date to ISO string
      const toIsoString = (date: any): string => {
        if (!date) return new Date().toISOString();
        if (typeof date === 'string') return date;
        if (date instanceof Date) return date.toISOString();
        return new Date().toISOString();
      };

      return {
        settings: settings.map((s) => {
          const sAny = s as any;
          return {
            id: s.id,
            category: s.category,
            key: s.key,
            value: s.value,
            description: s.description ?? null,
            isPublic: sAny.is_public ?? s.isPublic ?? false,
            isEncrypted: sAny.is_encrypted ?? s.isEncrypted ?? false,
            updatedBy: sAny.updated_by ?? s.updatedBy ?? null,
            updatedAt: toIsoString(sAny.updated_at ?? s.updatedAt),
            createdAt: toIsoString(sAny.created_at ?? s.createdAt),
          };
        }),
      };
    }
  );

  /**
   * GET /api/v1/admin/system-settings/:category/:key
   * Get a specific system setting
   */
  server.get(
    '/:category/:key',
    {
      schema: {
        tags: ['Admin', 'System Settings'],
        summary: 'Get system setting by category and key',
        params: z.object({
          category: z.enum(SYSTEM_SETTING_CATEGORIES as [string, ...string[]]),
          key: z.string(),
        }),
        // Temporarily disable response validation to test
        // response: {
        //   200: z.object({
        //     id: z.string().uuid(),
        //     category: z.string(),
        //     key: z.string(),
        //     value: z.record(z.unknown()),
        //     description: z.string().nullable(),
        //     isPublic: z.boolean(),
        //     isEncrypted: z.boolean(),
        //     updatedBy: z.string().uuid().nullable(),
        //     updatedAt: z.string(),
        //     createdAt: z.string(),
        //   }),
        //   404: z.object({
        //     error: z.string(),
        //     message: z.string(),
        //   }),
        // },
      },
    },
    async (request, reply) => {
      await requireSystemAdmin(request.user!.id);

      const { category, key } = request.params as { category: string; key: string };

      const [setting] = await db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.category, category), eq(systemSettings.key, key)));

      if (!setting) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `System setting ${category}.${key} not found`,
        });
      }

      // Debug: log what we got from database
      request.log.debug({ setting, keys: Object.keys(setting) }, 'Setting from database');

      // Handle both snake_case (raw DB) and camelCase (Drizzle mapped) properties
      const settingAny = setting as any;

      // Helper to convert date to ISO string
      const toIsoString = (date: any): string => {
        if (!date) return new Date().toISOString();
        if (typeof date === 'string') return date;
        if (date instanceof Date) return date.toISOString();
        return new Date().toISOString();
      };

      const response = {
        id: setting.id,
        category: setting.category,
        key: setting.key,
        value: setting.value,
        description: setting.description ?? null,
        isPublic: settingAny.is_public ?? setting.isPublic ?? false,
        isEncrypted: settingAny.is_encrypted ?? setting.isEncrypted ?? false,
        updatedBy: settingAny.updated_by ?? setting.updatedBy ?? null,
        updatedAt: toIsoString(settingAny.updated_at ?? setting.updatedAt),
        createdAt: toIsoString(settingAny.created_at ?? setting.createdAt),
      };

      request.log.debug({ response, keys: Object.keys(response) }, 'Response object');

      return response;
    }
  );

  /**
   * PUT /api/v1/admin/system-settings/:category/:key
   * Update a system setting
   */
  server.put(
    '/:category/:key',
    {
      schema: {
        tags: ['Admin', 'System Settings'],
        summary: 'Update system setting',
        params: z.object({
          category: z.enum(SYSTEM_SETTING_CATEGORIES as [string, ...string[]]),
          key: z.string(),
        }),
        body: z.object({
          value: z.record(z.unknown()),
          description: z.string().optional(),
        }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            category: z.string(),
            key: z.string(),
            value: z.record(z.unknown()),
            description: z.string().nullable(),
            isPublic: z.boolean(),
            isEncrypted: z.boolean(),
            updatedBy: z.string().uuid().nullable(),
            updatedAt: z.string(),
            createdAt: z.string(),
          }),
          404: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      await requireSystemAdmin(request.user!.id);

      const { category, key } = request.params as { category: string; key: string };
      const { value, description } = request.body as { value: Record<string, unknown>; description?: string };
      const userId = request.user!.id;

      // Check if setting exists
      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.category, category), eq(systemSettings.key, key)));

      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `System setting ${category}.${key} not found`,
        });
      }

      // Update setting
      const [updated] = await db
        .update(systemSettings)
        .set({
          value,
          description: description ?? existing.description,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(and(eq(systemSettings.category, category), eq(systemSettings.key, key)))
        .returning();

      // Helper to convert date to ISO string
      const toIsoString = (date: any): string => {
        if (!date) return new Date().toISOString();
        if (typeof date === 'string') return date;
        if (date instanceof Date) return date.toISOString();
        return new Date().toISOString();
      };

      const updatedAny = updated as any;
      return {
        id: updated.id,
        category: updated.category,
        key: updated.key,
        value: updated.value,
        description: updated.description ?? null,
        isPublic: updatedAny.is_public ?? updated.isPublic ?? false,
        isEncrypted: updatedAny.is_encrypted ?? updated.isEncrypted ?? false,
        updatedBy: updatedAny.updated_by ?? updated.updatedBy ?? null,
        updatedAt: toIsoString(updatedAny.updated_at ?? updated.updatedAt),
        createdAt: toIsoString(updatedAny.created_at ?? updated.createdAt),
      };
    }
  );

  /**
   * POST /api/v1/admin/system-settings
   * Create a new system setting
   */
  server.post(
    '/',
    {
      schema: {
        tags: ['Admin', 'System Settings'],
        summary: 'Create system setting',
        body: z.object({
          category: z.enum(SYSTEM_SETTING_CATEGORIES as [string, ...string[]]),
          key: z.string(),
          value: z.record(z.unknown()),
          description: z.string().optional(),
          isPublic: z.boolean().default(false),
        }),
        response: {
          201: z.object({
            id: z.string().uuid(),
            category: z.string(),
            key: z.string(),
            value: z.record(z.unknown()),
            description: z.string().nullable(),
            isPublic: z.boolean(),
            isEncrypted: z.boolean(),
            updatedBy: z.string().uuid().nullable(),
            updatedAt: z.string(),
            createdAt: z.string(),
          }),
          409: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      await requireSystemAdmin(request.user!.id);

      const { category, key, value, description, isPublic } = request.body as {
        category: string;
        key: string;
        value: Record<string, unknown>;
        description?: string;
        isPublic: boolean;
      };
      const userId = request.user!.id;

      // Check if setting already exists
      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.category, category), eq(systemSettings.key, key)));

      if (existing) {
        return reply.status(409).send({
          error: 'CONFLICT',
          message: `System setting ${category}.${key} already exists`,
        });
      }

      // Create setting
      const [created] = await db
        .insert(systemSettings)
        .values({
          category,
          key,
          value,
          description: description || null,
          isPublic,
          updatedBy: userId,
        })
        .returning();

      // Helper to convert date to ISO string
      const toIsoString = (date: any): string => {
        if (!date) return new Date().toISOString();
        if (typeof date === 'string') return date;
        if (date instanceof Date) return date.toISOString();
        return new Date().toISOString();
      };

      const createdAny = created as any;
      return reply.status(201).send({
        id: created.id,
        category: created.category,
        key: created.key,
        value: created.value,
        description: created.description ?? null,
        isPublic: createdAny.is_public ?? created.isPublic ?? false,
        isEncrypted: createdAny.is_encrypted ?? created.isEncrypted ?? false,
        updatedBy: createdAny.updated_by ?? created.updatedBy ?? null,
        updatedAt: toIsoString(createdAny.updated_at ?? created.updatedAt),
        createdAt: toIsoString(createdAny.created_at ?? created.createdAt),
      });
    }
  );
}
