/**
 * System Admin Repository
 *
 * Manages system administrators with platform-wide access.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { systemAdmins, users, type SystemAdmin } from '../db/schema/index.js';
import { type UserId } from '@argus/shared';

export interface SystemAdminWithUser extends SystemAdmin {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export type SystemRole = 'super_admin' | 'org_admin' | 'support' | 'billing';

export interface SystemAdminRepository {
  getByUserId(userId: UserId): Promise<SystemAdmin | undefined>;
  getAll(): Promise<SystemAdminWithUser[]>;
  getActive(): Promise<SystemAdminWithUser[]>;
  create(
    userId: UserId,
    role: SystemRole,
    createdBy?: UserId
  ): Promise<SystemAdmin>;
  updateRole(
    userId: UserId,
    role: SystemRole
  ): Promise<SystemAdmin | undefined>;
  deactivate(userId: UserId): Promise<SystemAdmin | undefined>;
  activate(userId: UserId): Promise<SystemAdmin | undefined>;
  delete(userId: UserId): Promise<boolean>;
  isSuperAdmin(userId: UserId): Promise<boolean>;
  isOrgAdmin(userId: UserId): Promise<boolean>;
  getRole(userId: UserId): Promise<SystemRole | null>;
}

export function createSystemAdminRepository(): SystemAdminRepository {
  return {
    async getByUserId(userId: UserId): Promise<SystemAdmin | undefined> {
      const result = await db
        .select()
        .from(systemAdmins)
        .where(eq(systemAdmins.userId, userId))
        .limit(1);
      return result[0];
    },

    async getAll(): Promise<SystemAdminWithUser[]> {
      const result = await db
        .select({
          id: systemAdmins.id,
          userId: systemAdmins.userId,
          role: systemAdmins.role,
          isActive: systemAdmins.isActive,
          createdAt: systemAdmins.createdAt,
          createdBy: systemAdmins.createdBy,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(systemAdmins)
        .innerJoin(users, eq(systemAdmins.userId, users.id))
        .orderBy(systemAdmins.createdAt);

      return result;
    },

    async getActive(): Promise<SystemAdminWithUser[]> {
      const result = await db
        .select({
          id: systemAdmins.id,
          userId: systemAdmins.userId,
          role: systemAdmins.role,
          isActive: systemAdmins.isActive,
          createdAt: systemAdmins.createdAt,
          createdBy: systemAdmins.createdBy,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(systemAdmins)
        .innerJoin(users, eq(systemAdmins.userId, users.id))
        .where(eq(systemAdmins.isActive, true))
        .orderBy(systemAdmins.createdAt);

      return result;
    },

    async create(
      userId: UserId,
      role: SystemRole,
      createdBy?: UserId
    ): Promise<SystemAdmin> {
      const result = await db
        .insert(systemAdmins)
        .values({
          userId,
          role,
          createdBy,
        })
        .returning();
      return result[0];
    },

    async updateRole(
      userId: UserId,
      role: SystemRole
    ): Promise<SystemAdmin | undefined> {
      const result = await db
        .update(systemAdmins)
        .set({ role })
        .where(eq(systemAdmins.userId, userId))
        .returning();
      return result[0];
    },

    async deactivate(userId: UserId): Promise<SystemAdmin | undefined> {
      const result = await db
        .update(systemAdmins)
        .set({ isActive: false })
        .where(eq(systemAdmins.userId, userId))
        .returning();
      return result[0];
    },

    async activate(userId: UserId): Promise<SystemAdmin | undefined> {
      const result = await db
        .update(systemAdmins)
        .set({ isActive: true })
        .where(eq(systemAdmins.userId, userId))
        .returning();
      return result[0];
    },

    async delete(userId: UserId): Promise<boolean> {
      const result = await db
        .delete(systemAdmins)
        .where(eq(systemAdmins.userId, userId))
        .returning();
      return result.length > 0;
    },

    async isSuperAdmin(userId: UserId): Promise<boolean> {
      const admin = await this.getByUserId(userId);
      return admin?.role === 'super_admin' && admin?.isActive === true;
    },

    async isOrgAdmin(userId: UserId): Promise<boolean> {
      const admin = await this.getByUserId(userId);
      return admin?.role === 'org_admin' && admin?.isActive === true;
    },

    async getRole(userId: UserId): Promise<SystemRole | null> {
      const admin = await this.getByUserId(userId);
      if (!admin || !admin.isActive) return null;
      return admin.role as SystemRole;
    },
  };
}

export const systemAdminRepository = createSystemAdminRepository();
