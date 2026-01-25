/**
 * Group repository for data access
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
import { userGroups, userGroupMemberships, users } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type OrganizationId, type UserId } from '@argus/shared';

// Infer types from Drizzle schema
export type UserGroup = typeof userGroups.$inferSelect;
export type NewUserGroup = typeof userGroups.$inferInsert;
export type UserGroupMembership = typeof userGroupMemberships.$inferSelect;
export type NewUserGroupMembership = typeof userGroupMemberships.$inferInsert;

export interface GroupMemberWithUser {
  userId: string;
  groupId: string;
  addedAt: Date;
  addedBy: string | null;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export class GroupRepository {
  /**
   * Creates a new group
   */
  async create(data: NewUserGroup, trx?: Transaction): Promise<UserGroup> {
    const executor = getExecutor(trx);
    const result = await executor.insert(userGroups).values(data).returning();
    return result[0];
  }

  /**
   * Finds a group by ID
   */
  async findById(id: string, trx?: Transaction): Promise<UserGroup | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a group by name within an organization
   */
  async findByName(
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<UserGroup | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(userGroups)
      .where(
        and(eq(userGroups.organizationId, organizationId), eq(userGroups.name, name))
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all groups in an organization with pagination
   */
  async findByOrganization(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<UserGroup & { memberCount: number }>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(userGroups)
      .where(eq(userGroups.organizationId, organizationId));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data with member counts
    const data = await executor
      .select({
        id: userGroups.id,
        organizationId: userGroups.organizationId,
        name: userGroups.name,
        description: userGroups.description,
        createdAt: userGroups.createdAt,
        updatedAt: userGroups.updatedAt,
        createdBy: userGroups.createdBy,
        memberCount: sql<number>`(
          SELECT count(*) FROM user_group_memberships
          WHERE group_id = ${userGroups.id}
        )`,
      })
      .from(userGroups)
      .where(eq(userGroups.organizationId, organizationId))
      .orderBy(userGroups.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Updates a group by ID
   */
  async update(
    id: string,
    data: Partial<Omit<NewUserGroup, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>,
    trx?: Transaction
  ): Promise<UserGroup | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(userGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userGroups.id, id))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Deletes a group by ID
   */
  async delete(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(userGroups)
      .where(eq(userGroups.id, id))
      .returning({ id: userGroups.id });
    return result.length > 0;
  }

  /**
   * Checks if a group name is available within an organization
   */
  async isNameAvailable(
    organizationId: OrganizationId,
    name: string,
    excludeId?: string,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const conditions = [
      eq(userGroups.organizationId, organizationId),
      eq(userGroups.name, name),
    ];
    if (excludeId) {
      conditions.push(sql`${userGroups.id} != ${excludeId}`);
    }

    const result = await executor
      .select({ count: sql<number>`1` })
      .from(userGroups)
      .where(and(...conditions))
      .limit(1);
    return result.length === 0;
  }

  // ===========================================
  // Member Management
  // ===========================================

  /**
   * Adds a user to a group
   */
  async addMember(data: NewUserGroupMembership, trx?: Transaction): Promise<UserGroupMembership> {
    const executor = getExecutor(trx);
    const result = await executor
      .insert(userGroupMemberships)
      .values(data)
      .returning();
    return result[0];
  }

  /**
   * Removes a user from a group
   */
  async removeMember(groupId: string, userId: UserId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(userGroupMemberships)
      .where(
        and(
          eq(userGroupMemberships.groupId, groupId),
          eq(userGroupMemberships.userId, userId)
        )
      )
      .returning({ userId: userGroupMemberships.userId });
    return result.length > 0;
  }

  /**
   * Checks if a user is a member of a group
   */
  async isMember(groupId: string, userId: UserId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(userGroupMemberships)
      .where(
        and(
          eq(userGroupMemberships.groupId, groupId),
          eq(userGroupMemberships.userId, userId)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Gets members of a group with user details
   */
  async getGroupMembers(
    groupId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<GroupMemberWithUser>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(userGroupMemberships)
      .where(eq(userGroupMemberships.groupId, groupId));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data with user info
    const data = await executor
      .select({
        userId: userGroupMemberships.userId,
        groupId: userGroupMemberships.groupId,
        addedAt: userGroupMemberships.addedAt,
        addedBy: userGroupMemberships.addedBy,
        user: {
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(userGroupMemberships)
      .innerJoin(users, eq(userGroupMemberships.userId, users.id))
      .where(eq(userGroupMemberships.groupId, groupId))
      .orderBy(users.email)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Gets all groups a user belongs to
   */
  async getUserGroups(
    userId: UserId,
    organizationId?: OrganizationId,
    trx?: Transaction
  ): Promise<UserGroup[]> {
    const executor = getExecutor(trx);
    const conditions = [eq(userGroupMemberships.userId, userId)];
    if (organizationId) {
      conditions.push(eq(userGroups.organizationId, organizationId));
    }

    const result = await executor
      .select({
        id: userGroups.id,
        organizationId: userGroups.organizationId,
        name: userGroups.name,
        description: userGroups.description,
        createdAt: userGroups.createdAt,
        updatedAt: userGroups.updatedAt,
        createdBy: userGroups.createdBy,
      })
      .from(userGroupMemberships)
      .innerJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id))
      .where(and(...conditions))
      .orderBy(userGroups.name);

    return result;
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let groupRepository: GroupRepository | null = null;

export function getGroupRepository(): GroupRepository {
  if (!groupRepository) {
    groupRepository = new GroupRepository();
  }
  return groupRepository;
}
