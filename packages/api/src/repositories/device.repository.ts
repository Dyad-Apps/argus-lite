/**
 * Device repository for IoT devices
 * Provides data access for devices with multi-tenant isolation
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
import { devices, deviceTypes } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import type { OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'offline' | 'error';

export class DeviceRepository {
  /**
   * Creates a new device
   */
  async create(data: NewDevice, trx?: Transaction): Promise<Device> {
    const executor = getExecutor(trx);
    const result = await executor.insert(devices).values(data).returning();
    return result[0];
  }

  /**
   * Creates multiple devices
   */
  async createMany(data: NewDevice[], trx?: Transaction): Promise<Device[]> {
    if (data.length === 0) return [];
    const executor = getExecutor(trx);
    return executor.insert(devices).values(data).returning();
  }

  /**
   * Finds a device by ID within a tenant
   */
  async findById(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Device | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.id, id),
          eq(devices.organizationId, organizationId),
          isNull(devices.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all devices within a tenant with pagination
   */
  async findAllInTenant(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Device>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(devices.organizationId, organizationId),
      isNull(devices.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(devices)
      .where(whereClause)
      .orderBy(devices.createdAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds devices by device type within a tenant
   */
  async findByDeviceType(
    organizationId: OrganizationId,
    deviceTypeId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Device>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(devices.organizationId, organizationId),
      eq(devices.deviceTypeId, deviceTypeId),
      isNull(devices.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(devices)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds devices by status within a tenant
   */
  async findByStatus(
    organizationId: OrganizationId,
    status: DeviceStatus,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Device>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(devices.organizationId, organizationId),
      eq(devices.status, status),
      isNull(devices.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(devices)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds devices by serial number within a tenant
   */
  async findBySerialNumber(
    organizationId: OrganizationId,
    serialNumber: string,
    trx?: Transaction
  ): Promise<Device | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.organizationId, organizationId),
          eq(devices.serialNumber, serialNumber),
          isNull(devices.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds devices by MAC address
   */
  async findByMacAddress(
    organizationId: OrganizationId,
    macAddress: string,
    trx?: Transaction
  ): Promise<Device | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.organizationId, organizationId),
          eq(devices.macAddress, macAddress),
          isNull(devices.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Searches devices by name (case-insensitive) within a tenant
   */
  async searchByName(
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<Device[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.organizationId, organizationId),
          ilike(devices.name, `%${name}%`),
          isNull(devices.deletedAt)
        )
      );
  }

  /**
   * Finds multiple devices by their IDs within a tenant
   */
  async findManyByIds(
    organizationId: OrganizationId,
    ids: string[],
    trx?: Transaction
  ): Promise<Device[]> {
    if (ids.length === 0) return [];
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.organizationId, organizationId),
          inArray(devices.id, ids),
          isNull(devices.deletedAt)
        )
      );
  }

  /**
   * Updates a device by ID within a tenant
   */
  async update(
    id: string,
    organizationId: OrganizationId,
    data: Partial<NewDevice>,
    trx?: Transaction
  ): Promise<Device | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(devices)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(devices.id, id),
          eq(devices.organizationId, organizationId),
          isNull(devices.deletedAt)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Soft deletes a device by setting deletedAt timestamp
   */
  async softDelete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Device | null> {
    return this.update(id, organizationId, { deletedAt: new Date() }, trx);
  }

  /**
   * Hard deletes a device by ID within a tenant
   */
  async delete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(devices)
      .where(
        and(eq(devices.id, id), eq(devices.organizationId, organizationId))
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Checks if a device exists by ID within a tenant
   */
  async exists(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(devices)
      .where(
        and(
          eq(devices.id, id),
          eq(devices.organizationId, organizationId),
          isNull(devices.deletedAt)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Counts devices within a tenant
   */
  async count(organizationId: OrganizationId, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(
        and(eq(devices.organizationId, organizationId), isNull(devices.deletedAt))
      );
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Updates device last_seen_at timestamp
   */
  async updateLastSeen(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Device | null> {
    return this.update(id, organizationId, { lastSeenAt: new Date() }, trx);
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let deviceRepository: DeviceRepository | null = null;

export function getDeviceRepository(): DeviceRepository {
  if (!deviceRepository) {
    deviceRepository = new DeviceRepository();
  }
  return deviceRepository;
}
