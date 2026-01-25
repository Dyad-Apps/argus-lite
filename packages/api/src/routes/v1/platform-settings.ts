/**
 * Platform Settings API Routes
 *
 * Manages platform-wide settings and branding configuration.
 * Only accessible by Super Admins.
 */

import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { platformSettingsRepository } from '../../repositories/platform-settings.repository.js';
import { systemAdminRepository } from '../../repositories/system-admin.repository.js';
import { type UserId } from '@argus/shared';

// Schemas
const settingSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  value: z.unknown(),
  description: z.string().nullable(),
  isSecret: z.boolean(),
  updatedBy: z.string().uuid().nullable(),
  updatedAt: z.string(),
});

const brandingSchema = z.object({
  id: z.string().uuid(),
  logoUrl: z.string().nullable(),
  logoDarkUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  loginBackgroundType: z.string(),
  loginBackgroundUrl: z.string().nullable(),
  loginWelcomeText: z.string().nullable(),
  loginSubtitle: z.string().nullable(),
  termsOfServiceUrl: z.string().nullable(),
  privacyPolicyUrl: z.string().nullable(),
  supportUrl: z.string().nullable(),
  updatedAt: z.string(),
  updatedBy: z.string().uuid().nullable(),
});

const upsertSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  description: z.string().optional(),
  isSecret: z.boolean().optional(),
});

const updateBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  logoDarkUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  loginBackgroundType: z.enum(['particles', 'image', 'gradient', 'solid']).optional(),
  loginBackgroundUrl: z.string().url().nullable().optional(),
  loginWelcomeText: z.string().max(100).nullable().optional(),
  loginSubtitle: z.string().max(200).nullable().optional(),
  termsOfServiceUrl: z.string().url().nullable().optional(),
  privacyPolicyUrl: z.string().url().nullable().optional(),
  supportUrl: z.string().url().nullable().optional(),
});

// Helper to check if user is a Super Admin
async function requireSuperAdmin(userId: UserId): Promise<void> {
  const admin = await systemAdminRepository.getByUserId(userId);
  if (!admin || admin.role !== 'super_admin' || !admin.isActive) {
    const error = new Error('Access denied. Super Admin privileges required.');
    (error as any).statusCode = 403;
    throw error;
  }
}

export const platformSettingsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /platform/settings - List all platform settings
  fastify.get(
    '/platform/settings',
    {
      schema: {
        tags: ['Platform'],
        summary: 'List all platform settings',
        response: {
          200: z.object({
            data: z.array(settingSchema),
          }),
        },
      },
    },
    async (request) => {
      await requireSuperAdmin(request.user!.id);

      const settings = await platformSettingsRepository.getAllSettings();

      // Mask secret values
      const maskedSettings = settings.map((s) => ({
        ...s,
        value: s.isSecret ? '••••••••' : s.value,
        updatedAt: s.updatedAt.toISOString(),
      }));

      return { data: maskedSettings };
    }
  );

  // GET /platform/settings/:key - Get a specific setting
  fastify.get(
    '/platform/settings/:key',
    {
      schema: {
        tags: ['Platform'],
        summary: 'Get a specific platform setting',
        params: z.object({
          key: z.string(),
        }),
        response: {
          200: settingSchema,
          404: z.object({
            error: z.object({
              code: z.string(),
              message: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      await requireSuperAdmin(request.user!.id);

      const { key } = request.params;
      const setting = await platformSettingsRepository.getSetting(key);

      if (!setting) {
        return reply.status(404).send({
          error: {
            code: 'SETTING_NOT_FOUND',
            message: `Setting '${key}' not found`,
          },
        });
      }

      return {
        ...setting,
        value: setting.isSecret ? '••••••••' : setting.value,
        updatedAt: setting.updatedAt.toISOString(),
      };
    }
  );

  // PUT /platform/settings - Create or update a setting
  fastify.put(
    '/platform/settings',
    {
      schema: {
        tags: ['Platform'],
        summary: 'Create or update a platform setting',
        body: upsertSettingSchema,
        response: {
          200: settingSchema,
        },
      },
    },
    async (request) => {
      await requireSuperAdmin(request.user!.id);

      const { key, value, description, isSecret } = request.body;

      const setting = await platformSettingsRepository.upsertSetting(key, value, {
        description,
        isSecret,
        updatedBy: request.user!.id,
      });

      return {
        ...setting,
        value: setting.isSecret ? '••••••••' : setting.value,
        updatedAt: setting.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /platform/settings/:key - Delete a setting
  fastify.delete(
    '/platform/settings/:key',
    {
      schema: {
        tags: ['Platform'],
        summary: 'Delete a platform setting',
        params: z.object({
          key: z.string(),
        }),
        response: {
          204: z.null(),
          404: z.object({
            error: z.object({
              code: z.string(),
              message: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      await requireSuperAdmin(request.user!.id);

      const { key } = request.params;
      const deleted = await platformSettingsRepository.deleteSetting(key);

      if (!deleted) {
        return reply.status(404).send({
          error: {
            code: 'SETTING_NOT_FOUND',
            message: `Setting '${key}' not found`,
          },
        });
      }

      return reply.status(204).send(null);
    }
  );

  // GET /platform/branding - Get platform branding
  fastify.get(
    '/platform/branding',
    {
      schema: {
        tags: ['Platform'],
        summary: 'Get platform branding configuration',
        response: {
          200: brandingSchema.nullable(),
        },
      },
    },
    async (request) => {
      await requireSuperAdmin(request.user!.id);

      const branding = await platformSettingsRepository.getBranding();

      if (!branding) {
        return null;
      }

      return {
        ...branding,
        updatedAt: branding.updatedAt.toISOString(),
      };
    }
  );

  // PATCH /platform/branding - Update platform branding
  fastify.patch(
    '/platform/branding',
    {
      schema: {
        tags: ['Platform'],
        summary: 'Update platform branding configuration',
        body: updateBrandingSchema,
        response: {
          200: brandingSchema,
        },
      },
    },
    async (request) => {
      await requireSuperAdmin(request.user!.id);

      const branding = await platformSettingsRepository.upsertBranding(
        request.body,
        request.user!.id
      );

      return {
        ...branding,
        updatedAt: branding.updatedAt.toISOString(),
      };
    }
  );
};
