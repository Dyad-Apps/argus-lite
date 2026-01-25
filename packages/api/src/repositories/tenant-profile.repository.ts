/**
 * Tenant Profile repository for data access
 */

import { eq, and, sql } from 'drizzle-orm';
import {
  PaginatedResult,
  PaginationOptions,
  buildPaginatedResult,
  calculateOffset,
  getPageSize,
  getExecutor,
  withTransaction,
} from './base.repository.js';
import { tenantProfiles, type ProfileCapabilities, type ProfileLimits } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';

// Infer types from Drizzle schema
export type TenantProfile = typeof tenantProfiles.$inferSelect;
export type NewTenantProfile = typeof tenantProfiles.$inferInsert;

export class TenantProfileRepository {
  /**
   * Creates a new tenant profile
   */
  async create(data: NewTenantProfile, trx?: Transaction): Promise<TenantProfile> {
    const executor = getExecutor(trx);
    const result = await executor.insert(tenantProfiles).values(data).returning();
    return result[0];
  }

  /**
   * Finds a tenant profile by ID
   */
  async findById(id: string, trx?: Transaction): Promise<TenantProfile | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(tenantProfiles)
      .where(eq(tenantProfiles.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a tenant profile by name
   */
  async findByName(name: string, trx?: Transaction): Promise<TenantProfile | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(tenantProfiles)
      .where(eq(tenantProfiles.name, name))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all tenant profiles with pagination
   */
  async findAll(
    options?: PaginationOptions & { activeOnly?: boolean; type?: string },
    trx?: Transaction
  ): Promise<PaginatedResult<TenantProfile>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);
    const activeOnly = options?.activeOnly ?? false;
    const profileType = options?.type;

    // Build where conditions
    const conditions = [];
    if (activeOnly) {
      conditions.push(eq(tenantProfiles.isActive, true));
    }
    if (profileType) {
      conditions.push(sql`${tenantProfiles.type} = ${profileType}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(tenantProfiles)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(tenantProfiles)
      .where(whereClause)
      .orderBy(tenantProfiles.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Updates a tenant profile by ID
   */
  async update(
    id: string,
    data: Partial<Omit<NewTenantProfile, 'id' | 'createdAt' | 'isSystem'>>,
    trx?: Transaction
  ): Promise<TenantProfile | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(tenantProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenantProfiles.id, id))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Deletes a tenant profile by ID (only non-system profiles)
   */
  async delete(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);

    // Check if it's a system profile
    const profile = await this.findById(id, trx);
    if (profile?.isSystem) {
      return false;
    }

    const result = await executor
      .delete(tenantProfiles)
      .where(and(eq(tenantProfiles.id, id), eq(tenantProfiles.isSystem, false)))
      .returning({ id: tenantProfiles.id });
    return result.length > 0;
  }

  /**
   * Checks if a profile name is available
   */
  async isNameAvailable(name: string, excludeId?: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const conditions = [eq(tenantProfiles.name, name)];
    if (excludeId) {
      conditions.push(sql`${tenantProfiles.id} != ${excludeId}`);
    }

    const result = await executor
      .select({ count: sql<number>`1` })
      .from(tenantProfiles)
      .where(and(...conditions))
      .limit(1);
    return result.length === 0;
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let tenantProfileRepository: TenantProfileRepository | null = null;

export function getTenantProfileRepository(): TenantProfileRepository {
  if (!tenantProfileRepository) {
    tenantProfileRepository = new TenantProfileRepository();
  }
  return tenantProfileRepository;
}
