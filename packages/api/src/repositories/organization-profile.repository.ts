/**
 * Organization Profile repository for data access
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
import { organizationProfiles, type ProfileCapabilities, type ProfileLimits } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';

// Infer types from Drizzle schema
export type OrganizationProfile = typeof organizationProfiles.$inferSelect;
export type NewOrganizationProfile = typeof organizationProfiles.$inferInsert;

export class OrganizationProfileRepository {
  /**
   * Creates a new organization profile
   */
  async create(data: NewOrganizationProfile, trx?: Transaction): Promise<OrganizationProfile> {
    const executor = getExecutor(trx);
    const result = await executor.insert(organizationProfiles).values(data).returning();
    return result[0];
  }

  /**
   * Finds an organization profile by ID
   */
  async findById(id: string, trx?: Transaction): Promise<OrganizationProfile | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(organizationProfiles)
      .where(eq(organizationProfiles.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds an organization profile by name
   */
  async findByName(name: string, trx?: Transaction): Promise<OrganizationProfile | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(organizationProfiles)
      .where(eq(organizationProfiles.name, name))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all organization profiles with pagination
   */
  async findAll(
    options?: PaginationOptions & { activeOnly?: boolean; type?: string },
    trx?: Transaction
  ): Promise<PaginatedResult<OrganizationProfile>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);
    const activeOnly = options?.activeOnly ?? false;
    const profileType = options?.type;

    // Build where conditions
    const conditions = [];
    if (activeOnly) {
      conditions.push(eq(organizationProfiles.isActive, true));
    }
    if (profileType) {
      conditions.push(sql`${organizationProfiles.type} = ${profileType}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(organizationProfiles)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(organizationProfiles)
      .where(whereClause)
      .orderBy(organizationProfiles.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Updates an organization profile by ID
   */
  async update(
    id: string,
    data: Partial<Omit<NewOrganizationProfile, 'id' | 'createdAt' | 'isSystem'>>,
    trx?: Transaction
  ): Promise<OrganizationProfile | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(organizationProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizationProfiles.id, id))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Deletes an organization profile by ID (only non-system profiles)
   */
  async delete(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);

    // Check if it's a system profile
    const profile = await this.findById(id, trx);
    if (profile?.isSystem) {
      return false;
    }

    const result = await executor
      .delete(organizationProfiles)
      .where(and(eq(organizationProfiles.id, id), eq(organizationProfiles.isSystem, false)))
      .returning({ id: organizationProfiles.id });
    return result.length > 0;
  }

  /**
   * Checks if a profile name is available
   */
  async isNameAvailable(name: string, excludeId?: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const conditions = [eq(organizationProfiles.name, name)];
    if (excludeId) {
      conditions.push(sql`${organizationProfiles.id} != ${excludeId}`);
    }

    const result = await executor
      .select({ count: sql<number>`1` })
      .from(organizationProfiles)
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
let organizationProfileRepository: OrganizationProfileRepository | null = null;

export function getOrganizationProfileRepository(): OrganizationProfileRepository {
  if (!organizationProfileRepository) {
    organizationProfileRepository = new OrganizationProfileRepository();
  }
  return organizationProfileRepository;
}
