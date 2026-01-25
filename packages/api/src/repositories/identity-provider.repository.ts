/**
 * Identity Provider repository for data access
 * Manages SSO connection configurations
 */

import { eq, and, sql, isNull, or } from 'drizzle-orm';
import {
  PaginatedResult,
  PaginationOptions,
  buildPaginatedResult,
  calculateOffset,
  getPageSize,
  getExecutor,
  withTransaction,
} from './base.repository.js';
import {
  identityProviders,
  userIdentities,
  type ProviderConfig,
} from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type IdentityProvider = typeof identityProviders.$inferSelect;
export type NewIdentityProvider = typeof identityProviders.$inferInsert;

export interface IdentityProviderWithStats extends IdentityProvider {
  linkedUsersCount: number;
}

export class IdentityProviderRepository {
  /**
   * Creates a new identity provider
   */
  async create(data: NewIdentityProvider, trx?: Transaction): Promise<IdentityProvider> {
    const executor = getExecutor(trx);
    const result = await executor.insert(identityProviders).values(data).returning();
    return result[0];
  }

  /**
   * Finds an identity provider by ID
   */
  async findById(id: string, trx?: Transaction): Promise<IdentityProvider | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(identityProviders)
      .where(eq(identityProviders.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds an identity provider by ID with usage stats
   */
  async findByIdWithStats(id: string, trx?: Transaction): Promise<IdentityProviderWithStats | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({
        provider: identityProviders,
        linkedUsersCount: sql<number>`COALESCE((
          SELECT COUNT(DISTINCT ${userIdentities.userId})
          FROM ${userIdentities}
          WHERE ${userIdentities.providerId} = ${identityProviders.id}
        ), 0)`,
      })
      .from(identityProviders)
      .where(eq(identityProviders.id, id))
      .limit(1);

    if (!result[0]) return null;
    return {
      ...result[0].provider,
      linkedUsersCount: Number(result[0].linkedUsersCount),
    };
  }

  /**
   * Finds all identity providers for an organization
   * Includes global providers (organizationId = null) by default
   */
  async findByOrganization(
    organizationId: OrganizationId,
    options?: PaginationOptions & { includeGlobal?: boolean; enabledOnly?: boolean },
    trx?: Transaction
  ): Promise<PaginatedResult<IdentityProviderWithStats>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);
    const includeGlobal = options?.includeGlobal ?? true;
    const enabledOnly = options?.enabledOnly ?? false;

    // Build where conditions
    const orgCondition = includeGlobal
      ? or(eq(identityProviders.organizationId, organizationId), isNull(identityProviders.organizationId))
      : eq(identityProviders.organizationId, organizationId);

    const conditions = [orgCondition];
    if (enabledOnly) {
      conditions.push(eq(identityProviders.enabled, true));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(identityProviders)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data with stats
    const data = await executor
      .select({
        provider: identityProviders,
        linkedUsersCount: sql<number>`COALESCE((
          SELECT COUNT(DISTINCT ${userIdentities.userId})
          FROM ${userIdentities}
          WHERE ${userIdentities.providerId} = ${identityProviders.id}
        ), 0)`,
      })
      .from(identityProviders)
      .where(whereClause)
      .orderBy(identityProviders.name)
      .limit(pageSize)
      .offset(offset);

    const result = data.map((d) => ({
      ...d.provider,
      linkedUsersCount: Number(d.linkedUsersCount),
    }));

    return buildPaginatedResult(result, totalCount, options);
  }

  /**
   * Finds all global identity providers (no organization restriction)
   */
  async findGlobalProviders(
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<IdentityProvider>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(identityProviders)
      .where(isNull(identityProviders.organizationId));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(identityProviders)
      .where(isNull(identityProviders.organizationId))
      .orderBy(identityProviders.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Updates an identity provider by ID
   */
  async update(
    id: string,
    data: Partial<Omit<NewIdentityProvider, 'id' | 'createdAt'>>,
    trx?: Transaction
  ): Promise<IdentityProvider | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(identityProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(identityProviders.id, id))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Deletes an identity provider by ID
   * Returns false if provider has linked users
   */
  async delete(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);

    // Check if provider has linked users
    const linkedUsers = await executor
      .select({ count: sql<number>`count(*)` })
      .from(userIdentities)
      .where(eq(userIdentities.providerId, id));

    if (Number(linkedUsers[0]?.count ?? 0) > 0) {
      return false;
    }

    const result = await executor
      .delete(identityProviders)
      .where(eq(identityProviders.id, id))
      .returning({ id: identityProviders.id });
    return result.length > 0;
  }

  /**
   * Force deletes an identity provider, unlinking all users
   */
  async forceDelete(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);

    // Delete all linked identities first
    await executor
      .delete(userIdentities)
      .where(eq(userIdentities.providerId, id));

    // Then delete the provider
    const result = await executor
      .delete(identityProviders)
      .where(eq(identityProviders.id, id))
      .returning({ id: identityProviders.id });
    return result.length > 0;
  }

  /**
   * Checks if a provider name is available within an organization
   */
  async isNameAvailable(
    organizationId: OrganizationId | null,
    name: string,
    excludeId?: string,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);

    const conditions = [];
    if (organizationId) {
      conditions.push(eq(identityProviders.organizationId, organizationId));
    } else {
      conditions.push(isNull(identityProviders.organizationId));
    }
    conditions.push(eq(identityProviders.name, name));

    if (excludeId) {
      conditions.push(sql`${identityProviders.id} != ${excludeId}`);
    }

    const result = await executor
      .select({ count: sql<number>`1` })
      .from(identityProviders)
      .where(and(...conditions))
      .limit(1);
    return result.length === 0;
  }

  /**
   * Gets the count of linked users for a provider
   */
  async getLinkedUsersCount(providerId: string, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(DISTINCT ${userIdentities.userId})` })
      .from(userIdentities)
      .where(eq(userIdentities.providerId, providerId));
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let identityProviderRepository: IdentityProviderRepository | null = null;

export function getIdentityProviderRepository(): IdentityProviderRepository {
  if (!identityProviderRepository) {
    identityProviderRepository = new IdentityProviderRepository();
  }
  return identityProviderRepository;
}
