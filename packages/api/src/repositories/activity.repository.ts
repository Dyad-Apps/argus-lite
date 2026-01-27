/**
 * Activity repository for work items and workflows
 * Provides data access for activities with 4-category system support
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
import { activities, activityTypes } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import type { OrganizationId, UserId } from '@argus/shared';

// Infer types from Drizzle schema
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type ActivityStatus =
  | 'pending'
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'failed';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'critical';
export type InitiatorType = 'person' | 'system' | 'rule' | 'alarm';
export type TargetType = 'asset' | 'device' | 'space' | 'person' | 'organization';

export class ActivityRepository {
  /**
   * Creates a new activity
   */
  async create(data: NewActivity, trx?: Transaction): Promise<Activity> {
    const executor = getExecutor(trx);
    const result = await executor.insert(activities).values(data).returning();
    return result[0];
  }

  /**
   * Creates multiple activities
   */
  async createMany(data: NewActivity[], trx?: Transaction): Promise<Activity[]> {
    if (data.length === 0) return [];
    const executor = getExecutor(trx);
    return executor.insert(activities).values(data).returning();
  }

  /**
   * Finds an activity by ID within a tenant
   */
  async findById(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Activity | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.id, id),
          eq(activities.organizationId, organizationId),
          isNull(activities.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all activities within a tenant with pagination
   */
  async findAllInTenant(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .orderBy(activities.createdAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds activities by status within a tenant
   */
  async findByStatus(
    organizationId: OrganizationId,
    status: ActivityStatus,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      eq(activities.status, status),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds activities by priority within a tenant
   */
  async findByPriority(
    organizationId: OrganizationId,
    priority: ActivityPriority,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      eq(activities.priority, priority),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds activities assigned to a user
   */
  async findAssignedToUser(
    organizationId: OrganizationId,
    userId: UserId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      eq(activities.assignedToUserId, userId),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .orderBy(activities.priority, activities.dueAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds activities initiated by a user
   */
  async findInitiatedByUser(
    organizationId: OrganizationId,
    userId: UserId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      eq(activities.initiatorUserId, userId),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds activities by target (what the activity is about)
   */
  async findByTarget(
    organizationId: OrganizationId,
    targetType: TargetType,
    targetId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      eq(activities.targetType, targetType),
      eq(activities.targetId, targetId),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .orderBy(activities.createdAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds child activities of a parent activity
   */
  async findChildren(
    organizationId: OrganizationId,
    parentActivityId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      eq(activities.parentActivityId, parentActivityId),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds activities requiring approval
   */
  async findPendingApproval(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Activity>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(activities.organizationId, organizationId),
      eq(activities.requiresApproval, true),
      eq(activities.approvalStatus, 'pending_approval'),
      isNull(activities.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(activities)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Searches activities by name (case-insensitive) within a tenant
   */
  async searchByName(
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<Activity[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.organizationId, organizationId),
          ilike(activities.name, `%${name}%`),
          isNull(activities.deletedAt)
        )
      );
  }

  /**
   * Finds multiple activities by their IDs within a tenant
   */
  async findManyByIds(
    organizationId: OrganizationId,
    ids: string[],
    trx?: Transaction
  ): Promise<Activity[]> {
    if (ids.length === 0) return [];
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.organizationId, organizationId),
          inArray(activities.id, ids),
          isNull(activities.deletedAt)
        )
      );
  }

  /**
   * Updates an activity by ID within a tenant
   */
  async update(
    id: string,
    organizationId: OrganizationId,
    data: Partial<NewActivity>,
    trx?: Transaction
  ): Promise<Activity | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(activities)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(activities.id, id),
          eq(activities.organizationId, organizationId),
          isNull(activities.deletedAt)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Soft deletes an activity by setting deletedAt timestamp
   */
  async softDelete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Activity | null> {
    return this.update(id, organizationId, { deletedAt: new Date() }, trx);
  }

  /**
   * Hard deletes an activity by ID within a tenant
   */
  async delete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(activities)
      .where(
        and(eq(activities.id, id), eq(activities.organizationId, organizationId))
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Checks if an activity exists by ID within a tenant
   */
  async exists(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(activities)
      .where(
        and(
          eq(activities.id, id),
          eq(activities.organizationId, organizationId),
          isNull(activities.deletedAt)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Counts activities within a tenant
   */
  async count(organizationId: OrganizationId, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(
        and(eq(activities.organizationId, organizationId), isNull(activities.deletedAt))
      );
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
let activityRepository: ActivityRepository | null = null;

export function getActivityRepository(): ActivityRepository {
  if (!activityRepository) {
    activityRepository = new ActivityRepository();
  }
  return activityRepository;
}
