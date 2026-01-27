/**
 * Space repository for hierarchical locations
 * Provides data access for spaces with geospatial support
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
import { spaces, spaceTypes } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import type { OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;

export class SpaceRepository {
  /**
   * Creates a new space
   */
  async create(data: NewSpace, trx?: Transaction): Promise<Space> {
    const executor = getExecutor(trx);
    const result = await executor.insert(spaces).values(data).returning();
    return result[0];
  }

  /**
   * Creates multiple spaces
   */
  async createMany(data: NewSpace[], trx?: Transaction): Promise<Space[]> {
    if (data.length === 0) return [];
    const executor = getExecutor(trx);
    return executor.insert(spaces).values(data).returning();
  }

  /**
   * Finds a space by ID within a tenant
   */
  async findById(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Space | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(spaces)
      .where(
        and(
          eq(spaces.id, id),
          eq(spaces.organizationId, organizationId),
          isNull(spaces.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all spaces within a tenant with pagination
   */
  async findAllInTenant(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Space>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(spaces.organizationId, organizationId),
      isNull(spaces.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(spaces)
      .where(whereClause)
      .orderBy(spaces.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds spaces by space type within a tenant
   */
  async findBySpaceType(
    organizationId: OrganizationId,
    spaceTypeId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Space>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(spaces.organizationId, organizationId),
      eq(spaces.spaceTypeId, spaceTypeId),
      isNull(spaces.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(spaces)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds child spaces of a parent space
   */
  async findChildren(
    organizationId: OrganizationId,
    parentSpaceId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Space>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(spaces.organizationId, organizationId),
      eq(spaces.parentSpaceId, parentSpaceId),
      isNull(spaces.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(spaces)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds root-level spaces (no parent) within a tenant
   */
  async findRootSpaces(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Space>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(spaces.organizationId, organizationId),
      isNull(spaces.parentSpaceId),
      isNull(spaces.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(spaces)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds spaces by floor level within a tenant
   */
  async findByFloorLevel(
    organizationId: OrganizationId,
    floorLevel: number,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Space>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(spaces.organizationId, organizationId),
      eq(spaces.floorLevel, floorLevel),
      isNull(spaces.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(spaces)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds spaces by space code within a tenant
   */
  async findBySpaceCode(
    organizationId: OrganizationId,
    spaceCode: string,
    trx?: Transaction
  ): Promise<Space | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(spaces)
      .where(
        and(
          eq(spaces.organizationId, organizationId),
          eq(spaces.spaceCode, spaceCode),
          isNull(spaces.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Searches spaces by name (case-insensitive) within a tenant
   */
  async searchByName(
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<Space[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(spaces)
      .where(
        and(
          eq(spaces.organizationId, organizationId),
          ilike(spaces.name, `%${name}%`),
          isNull(spaces.deletedAt)
        )
      );
  }

  /**
   * Finds spaces within a radius of a point (geospatial query)
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
  ): Promise<Space[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(spaces)
      .where(
        and(
          eq(spaces.organizationId, organizationId),
          isNull(spaces.deletedAt),
          sql`ST_DWithin(
            ${spaces.geolocation}::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )`
        )
      );
  }

  /**
   * Finds spaces containing a point within their geofence (point-in-polygon query)
   * @param lat Latitude
   * @param lng Longitude
   */
  async findContainingPoint(
    organizationId: OrganizationId,
    lat: number,
    lng: number,
    trx?: Transaction
  ): Promise<Space[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(spaces)
      .where(
        and(
          eq(spaces.organizationId, organizationId),
          isNull(spaces.deletedAt),
          sql`ST_Contains(
            ${spaces.geofence},
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
          )`
        )
      );
  }

  /**
   * Finds multiple spaces by their IDs within a tenant
   */
  async findManyByIds(
    organizationId: OrganizationId,
    ids: string[],
    trx?: Transaction
  ): Promise<Space[]> {
    if (ids.length === 0) return [];
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(spaces)
      .where(
        and(
          eq(spaces.organizationId, organizationId),
          inArray(spaces.id, ids),
          isNull(spaces.deletedAt)
        )
      );
  }

  /**
   * Updates a space by ID within a tenant
   */
  async update(
    id: string,
    organizationId: OrganizationId,
    data: Partial<NewSpace>,
    trx?: Transaction
  ): Promise<Space | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(spaces)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(spaces.id, id),
          eq(spaces.organizationId, organizationId),
          isNull(spaces.deletedAt)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Soft deletes a space by setting deletedAt timestamp
   */
  async softDelete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Space | null> {
    return this.update(id, organizationId, { deletedAt: new Date() }, trx);
  }

  /**
   * Hard deletes a space by ID within a tenant
   */
  async delete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(spaces)
      .where(
        and(eq(spaces.id, id), eq(spaces.organizationId, organizationId))
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Checks if a space exists by ID within a tenant
   */
  async exists(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(spaces)
      .where(
        and(
          eq(spaces.id, id),
          eq(spaces.organizationId, organizationId),
          isNull(spaces.deletedAt)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Counts spaces within a tenant
   */
  async count(organizationId: OrganizationId, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(
        and(eq(spaces.organizationId, organizationId), isNull(spaces.deletedAt))
      );
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Updates space geolocation
   */
  async updateGeolocation(
    id: string,
    organizationId: OrganizationId,
    lat: number,
    lng: number,
    trx?: Transaction
  ): Promise<Space | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(spaces)
      .set({
        geolocation: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(spaces.id, id),
          eq(spaces.organizationId, organizationId),
          isNull(spaces.deletedAt)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Updates space geofence (polygon boundary)
   * @param coordinates Array of [lng, lat] coordinate pairs forming the polygon
   */
  async updateGeofence(
    id: string,
    organizationId: OrganizationId,
    coordinates: [number, number][],
    trx?: Transaction
  ): Promise<Space | null> {
    const executor = getExecutor(trx);

    // Convert coordinates array to WKT format: POLYGON((lng1 lat1, lng2 lat2, ...))
    // PostGIS requires first and last points to be the same to close the polygon
    const coordsString = coordinates
      .map(([lng, lat]) => `${lng} ${lat}`)
      .join(', ');
    const closedCoordsString = `${coordsString}, ${coordinates[0][0]} ${coordinates[0][1]}`;

    const result = await executor
      .update(spaces)
      .set({
        geofence: sql`ST_SetSRID(ST_GeomFromText('POLYGON((${sql.raw(closedCoordsString)}))'), 4326)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(spaces.id, id),
          eq(spaces.organizationId, organizationId),
          isNull(spaces.deletedAt)
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
let spaceRepository: SpaceRepository | null = null;

export function getSpaceRepository(): SpaceRepository {
  if (!spaceRepository) {
    spaceRepository = new SpaceRepository();
  }
  return spaceRepository;
}
