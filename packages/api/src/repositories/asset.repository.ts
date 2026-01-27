/**
 * Asset repository for physical/logical assets
 * Provides data access for assets with geospatial support and hierarchical queries
 */

import { eq, and, sql, inArray, ilike, isNull } from 'drizzle-orm';
import {
  PaginatedResult,
  PaginationOptions,
  buildPaginatedResult,
  calculateOffset,
  getPageSize,
  getExecutor,
  withTransaction,
} from './base.repository.js';
import { assets, assetTypes } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import type { OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'retired' | 'pending';

export class AssetRepository {
  /**
   * Creates a new asset
   */
  async create(data: NewAsset, trx?: Transaction): Promise<Asset> {
    const executor = getExecutor(trx);
    const result = await executor.insert(assets).values(data).returning();
    return result[0];
  }

  /**
   * Creates multiple assets
   */
  async createMany(data: NewAsset[], trx?: Transaction): Promise<Asset[]> {
    if (data.length === 0) return [];
    const executor = getExecutor(trx);
    return executor.insert(assets).values(data).returning();
  }

  /**
   * Finds an asset by ID within a tenant
   */
  async findById(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Asset | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.id, id),
          eq(assets.organizationId, organizationId),
          isNull(assets.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all assets within a tenant with pagination
   */
  async findAllInTenant(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Asset>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(assets.organizationId, organizationId),
      isNull(assets.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(assets)
      .where(whereClause)
      .orderBy(assets.createdAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds assets by asset type within a tenant
   */
  async findByAssetType(
    organizationId: OrganizationId,
    assetTypeId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Asset>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(assets.organizationId, organizationId),
      eq(assets.assetTypeId, assetTypeId),
      isNull(assets.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(assets)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds assets by status within a tenant
   */
  async findByStatus(
    organizationId: OrganizationId,
    status: AssetStatus,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Asset>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(assets.organizationId, organizationId),
      eq(assets.status, status),
      isNull(assets.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(assets)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds child assets of a parent asset
   */
  async findChildren(
    organizationId: OrganizationId,
    parentAssetId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Asset>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(assets.organizationId, organizationId),
      eq(assets.parentAssetId, parentAssetId),
      isNull(assets.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(assets)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds root-level assets (no parent) within a tenant
   */
  async findRootAssets(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Asset>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(assets.organizationId, organizationId),
      isNull(assets.parentAssetId),
      isNull(assets.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(assets)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds assets by serial number within a tenant
   */
  async findBySerialNumber(
    organizationId: OrganizationId,
    serialNumber: string,
    trx?: Transaction
  ): Promise<Asset | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.organizationId, organizationId),
          eq(assets.serialNumber, serialNumber),
          isNull(assets.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Searches assets by name (case-insensitive) within a tenant
   */
  async searchByName(
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<Asset[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.organizationId, organizationId),
          ilike(assets.name, `%${name}%`),
          isNull(assets.deletedAt)
        )
      );
  }

  /**
   * Finds assets within a radius of a point (geospatial query)
   * @param lat Latitude
   * @param lng Longitude
   * @param radiusMeters Radius in meters
   */
  async findNearby(
    organizationId: OrganizationId,
    lat: number,
    lng: number,
    radiusMeters: number,
    trx?: Transaction
  ): Promise<Asset[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.organizationId, organizationId),
          isNull(assets.deletedAt),
          sql`ST_DWithin(
            ${assets.geolocation}::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )`
        )
      );
  }

  /**
   * Finds multiple assets by their IDs within a tenant
   */
  async findManyByIds(
    organizationId: OrganizationId,
    ids: string[],
    trx?: Transaction
  ): Promise<Asset[]> {
    if (ids.length === 0) return [];
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.organizationId, organizationId),
          inArray(assets.id, ids),
          isNull(assets.deletedAt)
        )
      );
  }

  /**
   * Updates an asset by ID within a tenant
   */
  async update(
    id: string,
    organizationId: OrganizationId,
    data: Partial<NewAsset>,
    trx?: Transaction
  ): Promise<Asset | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(assets)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(assets.id, id),
          eq(assets.organizationId, organizationId),
          isNull(assets.deletedAt)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Soft deletes an asset by setting deletedAt timestamp
   */
  async softDelete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Asset | null> {
    return this.update(id, organizationId, { deletedAt: new Date() }, trx);
  }

  /**
   * Hard deletes an asset by ID within a tenant
   */
  async delete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(assets)
      .where(
        and(eq(assets.id, id), eq(assets.organizationId, organizationId))
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Checks if an asset exists by ID within a tenant
   */
  async exists(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(assets)
      .where(
        and(
          eq(assets.id, id),
          eq(assets.organizationId, organizationId),
          isNull(assets.deletedAt)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Counts assets within a tenant
   */
  async count(organizationId: OrganizationId, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(
        and(eq(assets.organizationId, organizationId), isNull(assets.deletedAt))
      );
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Updates asset geolocation
   */
  async updateGeolocation(
    id: string,
    organizationId: OrganizationId,
    lat: number,
    lng: number,
    trx?: Transaction
  ): Promise<Asset | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(assets)
      .set({
        geolocation: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
        lastLocationUpdate: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assets.id, id),
          eq(assets.organizationId, organizationId),
          isNull(assets.deletedAt)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let assetRepository: AssetRepository | null = null;

export function getAssetRepository(): AssetRepository {
  if (!assetRepository) {
    assetRepository = new AssetRepository();
  }
  return assetRepository;
}
