/**
 * Generic type definition repository
 * Handles all 5 type definition tables with a unified interface
 */

import { eq, and, sql, ilike, isNull } from 'drizzle-orm';
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
  deviceTypes,
  assetTypes,
  personTypes,
  activityTypes,
  spaceTypes,
} from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import type { OrganizationId } from '@argus/shared';

// Type table union
type TypeTable =
  | typeof deviceTypes
  | typeof assetTypes
  | typeof personTypes
  | typeof activityTypes
  | typeof spaceTypes;

// Infer types from Drizzle schema
export type TypeDefinition =
  | typeof deviceTypes.$inferSelect
  | typeof assetTypes.$inferSelect
  | typeof personTypes.$inferSelect
  | typeof activityTypes.$inferSelect
  | typeof spaceTypes.$inferSelect;

export type NewTypeDefinition =
  | typeof deviceTypes.$inferInsert
  | typeof assetTypes.$inferInsert
  | typeof personTypes.$inferInsert
  | typeof activityTypes.$inferInsert
  | typeof spaceTypes.$inferInsert;

// Type kind enum
export type TypeKind = 'device' | 'asset' | 'person' | 'activity' | 'space';

// Map type kind to table
function getTypeTable(kind: TypeKind): TypeTable {
  switch (kind) {
    case 'device':
      return deviceTypes;
    case 'asset':
      return assetTypes;
    case 'person':
      return personTypes;
    case 'activity':
      return activityTypes;
    case 'space':
      return spaceTypes;
  }
}

export class TypeDefinitionRepository {
  /**
   * Creates a new type definition
   */
  async create(
    kind: TypeKind,
    data: any,
    trx?: Transaction
  ): Promise<TypeDefinition> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const result = await executor.insert(table).values(data).returning();
    return result[0];
  }

  /**
   * Finds a type definition by ID within a tenant
   */
  async findById(
    kind: TypeKind,
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<TypeDefinition | null> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.organizationId, organizationId)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all type definitions within a tenant with pagination
   */
  async findAllInTenant(
    kind: TypeKind,
    organizationId: OrganizationId,
    options?: PaginationOptions & { includeSystem?: boolean },
    trx?: Transaction
  ): Promise<PaginatedResult<TypeDefinition>> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);
    const includeSystem = options?.includeSystem ?? true;

    const whereClause = includeSystem
      ? eq(table.organizationId, organizationId)
      : and(
          eq(table.organizationId, organizationId),
          eq(table.isSystem, false)
        );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(table)
      .where(whereClause)
      .orderBy(table.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds type definitions by category
   */
  async findByCategory(
    kind: TypeKind,
    organizationId: OrganizationId,
    category: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<TypeDefinition>> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(table.organizationId, organizationId),
      eq(table.category, category)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(table)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds child type definitions of a parent type
   */
  async findChildren(
    kind: TypeKind,
    organizationId: OrganizationId,
    parentTypeId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<TypeDefinition>> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(table.organizationId, organizationId),
      eq(table.parentTypeId, parentTypeId)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(table)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds type definitions by name (case-insensitive)
   */
  async findByName(
    kind: TypeKind,
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<TypeDefinition | null> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.organizationId, organizationId),
          ilike(table.name, name)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Searches type definitions by name (case-insensitive)
   */
  async searchByName(
    kind: TypeKind,
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<TypeDefinition[]> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.organizationId, organizationId),
          ilike(table.name, `%${name}%`)
        )
      );
  }

  /**
   * Updates a type definition by ID within a tenant
   */
  async update(
    kind: TypeKind,
    id: string,
    organizationId: OrganizationId,
    data: any,
    trx?: Transaction
  ): Promise<TypeDefinition | null> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const result = await executor
      .update(table)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(table.id, id), eq(table.organizationId, organizationId))
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Hard deletes a type definition by ID within a tenant
   */
  async delete(
    kind: TypeKind,
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const result = await executor
      .delete(table)
      .where(
        and(eq(table.id, id), eq(table.organizationId, organizationId))
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Checks if a type definition exists by ID within a tenant
   */
  async exists(
    kind: TypeKind,
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(table)
      .where(
        and(eq(table.id, id), eq(table.organizationId, organizationId))
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Counts type definitions within a tenant
   */
  async count(
    kind: TypeKind,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<number> {
    const table = getTypeTable(kind);
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.organizationId, organizationId));
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
let typeDefinitionRepository: TypeDefinitionRepository | null = null;

export function getTypeDefinitionRepository(): TypeDefinitionRepository {
  if (!typeDefinitionRepository) {
    typeDefinitionRepository = new TypeDefinitionRepository();
  }
  return typeDefinitionRepository;
}
