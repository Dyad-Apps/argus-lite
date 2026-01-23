/**
 * Entity repository for meta-model entities
 * Provides data access for the core entity table with base type awareness
 */

import { eq, and, sql, inArray, ilike } from 'drizzle-orm';
import {
  PaginatedResult,
  PaginationOptions,
  buildPaginatedResult,
  calculateOffset,
  getPageSize,
  getExecutor,
  withTransaction,
} from './base.repository.js';
import { entities } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import {
  type EntityId,
  type OrganizationId,
  type TypeDefinitionId,
  type BaseType,
} from '@argus/shared';

// Infer types from Drizzle schema
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export class EntityRepository {
  /**
   * Creates a new entity
   */
  async create(data: NewEntity, trx?: Transaction): Promise<Entity> {
    const executor = getExecutor(trx);
    const result = await executor.insert(entities).values(data).returning();
    return result[0];
  }

  /**
   * Creates multiple entities
   */
  async createMany(data: NewEntity[], trx?: Transaction): Promise<Entity[]> {
    if (data.length === 0) return [];
    const executor = getExecutor(trx);
    return executor.insert(entities).values(data).returning();
  }

  /**
   * Finds an entity by ID
   */
  async findById(id: EntityId, trx?: Transaction): Promise<Entity | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds an entity by ID within a tenant
   */
  async findByIdInTenant(
    id: EntityId,
    tenantId: OrganizationId,
    trx?: Transaction
  ): Promise<Entity | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(entities)
      .where(and(eq(entities.id, id), eq(entities.tenantId, tenantId)))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all entities within a tenant with pagination
   */
  async findAllInTenant(
    tenantId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Entity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(entities)
      .where(eq(entities.tenantId, tenantId));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(entities)
      .where(eq(entities.tenantId, tenantId))
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds all entities of a specific base type within a tenant
   */
  async findByBaseType(
    tenantId: OrganizationId,
    baseType: BaseType,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Entity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(entities.tenantId, tenantId),
      eq(entities.baseType, baseType)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(entities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(entities)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds all entities of a specific type definition within a tenant
   */
  async findByTypeDefinition(
    tenantId: OrganizationId,
    typeDefinitionId: TypeDefinitionId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Entity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(entities.tenantId, tenantId),
      eq(entities.typeDefinitionId, typeDefinitionId)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(entities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(entities)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds entities by name within a tenant (case-insensitive)
   */
  async findByName(
    tenantId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<Entity[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.tenantId, tenantId),
          ilike(entities.name, `%${name}%`)
        )
      );
  }

  /**
   * Finds multiple entities by their IDs within a tenant
   */
  async findManyByIds(
    tenantId: OrganizationId,
    ids: EntityId[],
    trx?: Transaction
  ): Promise<Entity[]> {
    if (ids.length === 0) return [];
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(entities)
      .where(
        and(eq(entities.tenantId, tenantId), inArray(entities.id, ids))
      );
  }

  /**
   * Updates an entity by ID within a tenant
   */
  async update(
    id: EntityId,
    tenantId: OrganizationId,
    data: Partial<NewEntity>,
    trx?: Transaction
  ): Promise<Entity | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(entities)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(entities.id, id), eq(entities.tenantId, tenantId)))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Soft deletes an entity by setting its lifecycle status to decommissioned
   */
  async softDelete(
    id: EntityId,
    tenantId: OrganizationId,
    trx?: Transaction
  ): Promise<Entity | null> {
    return this.update(id, tenantId, { lifecycleStatus: 'decommissioned' }, trx);
  }

  /**
   * Hard deletes an entity by ID within a tenant
   */
  async delete(
    id: EntityId,
    tenantId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(entities)
      .where(and(eq(entities.id, id), eq(entities.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  /**
   * Checks if an entity exists by ID within a tenant
   */
  async exists(
    id: EntityId,
    tenantId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(entities)
      .where(and(eq(entities.id, id), eq(entities.tenantId, tenantId)))
      .limit(1);
    return result.length > 0;
  }

  /**
   * Counts entities within a tenant
   */
  async count(tenantId: OrganizationId, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(entities)
      .where(eq(entities.tenantId, tenantId));
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
let entityRepository: EntityRepository | null = null;

export function getEntityRepository(): EntityRepository {
  if (!entityRepository) {
    entityRepository = new EntityRepository();
  }
  return entityRepository;
}
