/**
 * Platform Settings Repository
 *
 * Manages platform-wide settings and branding configuration.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  platformSettings,
  platformBranding,
  type PlatformSetting,
  type NewPlatformSetting,
  type PlatformBrandingType,
} from '../db/schema/index.js';
import { type UserId } from '@argus/shared';

export interface PlatformSettingsRepository {
  // Settings
  getAllSettings(): Promise<PlatformSetting[]>;
  getSetting(key: string): Promise<PlatformSetting | undefined>;
  getSettingValue<T>(key: string): Promise<T | undefined>;
  upsertSetting(
    key: string,
    value: unknown,
    options?: { description?: string; isSecret?: boolean; updatedBy?: UserId }
  ): Promise<PlatformSetting>;
  deleteSetting(key: string): Promise<boolean>;

  // Branding
  getBranding(): Promise<PlatformBrandingType | undefined>;
  upsertBranding(
    branding: Partial<Omit<PlatformBrandingType, 'id' | 'updatedAt'>>,
    updatedBy?: UserId
  ): Promise<PlatformBrandingType>;
}

export function createPlatformSettingsRepository(): PlatformSettingsRepository {
  return {
    async getAllSettings(): Promise<PlatformSetting[]> {
      return db.select().from(platformSettings).orderBy(platformSettings.key);
    },

    async getSetting(key: string): Promise<PlatformSetting | undefined> {
      const result = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, key))
        .limit(1);
      return result[0];
    },

    async getSettingValue<T>(key: string): Promise<T | undefined> {
      const setting = await this.getSetting(key);
      return setting?.value as T | undefined;
    },

    async upsertSetting(
      key: string,
      value: unknown,
      options?: { description?: string; isSecret?: boolean; updatedBy?: UserId }
    ): Promise<PlatformSetting> {
      const existing = await this.getSetting(key);

      if (existing) {
        const result = await db
          .update(platformSettings)
          .set({
            value,
            description: options?.description ?? existing.description,
            isSecret: options?.isSecret ?? existing.isSecret,
            updatedBy: options?.updatedBy ?? existing.updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(platformSettings.key, key))
          .returning();
        return result[0];
      }

      const result = await db
        .insert(platformSettings)
        .values({
          key,
          value,
          description: options?.description,
          isSecret: options?.isSecret ?? false,
          updatedBy: options?.updatedBy,
        })
        .returning();
      return result[0];
    },

    async deleteSetting(key: string): Promise<boolean> {
      const result = await db
        .delete(platformSettings)
        .where(eq(platformSettings.key, key))
        .returning();
      return result.length > 0;
    },

    async getBranding(): Promise<PlatformBrandingType | undefined> {
      const result = await db.select().from(platformBranding).limit(1);
      return result[0];
    },

    async upsertBranding(
      branding: Partial<Omit<PlatformBrandingType, 'id' | 'updatedAt'>>,
      updatedBy?: UserId
    ): Promise<PlatformBrandingType> {
      const existing = await this.getBranding();

      if (existing) {
        const result = await db
          .update(platformBranding)
          .set({
            ...branding,
            updatedBy: updatedBy ?? existing.updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(platformBranding.id, existing.id))
          .returning();
        return result[0];
      }

      const result = await db
        .insert(platformBranding)
        .values({
          ...branding,
          updatedBy,
        })
        .returning();
      return result[0];
    },
  };
}

export const platformSettingsRepository = createPlatformSettingsRepository();
