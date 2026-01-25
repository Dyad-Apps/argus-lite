/**
 * Role repository for data access
 */

import { eq, and, sql, or, isNull, ne } from 'drizzle-orm';
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
  roles,
  userRoleAssignments,
  groupRoleAssignments,
  users,
  type RolePermissions,
} from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type OrganizationId, type UserId, type RoleScope, type RoleSource } from '@argus/shared';

// Infer types from Drizzle schema
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type NewUserRoleAssignment = typeof userRoleAssignments.$inferInsert;
export type GroupRoleAssignment = typeof groupRoleAssignments.$inferSelect;
export type NewGroupRoleAssignment = typeof groupRoleAssignments.$inferInsert;

export interface UserRoleAssignmentWithRole {
  userId: string;
  roleId: string;
  roleName: string;
  organizationId: string;
  scope: RoleScope | null;
  source: RoleSource;
  assignedAt: Date;
  assignedBy: string | null;
  expiresAt: Date | null;
}

export class RoleRepository {
  /**
   * Creates a new role
   */
  async create(data: NewRole, trx?: Transaction): Promise<Role> {
    const executor = getExecutor(trx);
    const result = await executor.insert(roles).values(data).returning();
    return result[0];
  }

  /**
   * Finds a role by ID
   */
  async findById(id: string, trx?: Transaction): Promise<Role | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a role by name within an organization
   */
  async findByName(
    organizationId: OrganizationId | null,
    name: string,
    trx?: Transaction
  ): Promise<Role | null> {
    const executor = getExecutor(trx);
    const condition = organizationId
      ? and(eq(roles.organizationId, organizationId), eq(roles.name, name))
      : and(isNull(roles.organizationId), eq(roles.name, name));

    const result = await executor
      .select()
      .from(roles)
      .where(condition)
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all system roles (global roles with null organizationId)
   * Excludes hidden roles like Super Admin
   */
  async findSystemRoles(trx?: Transaction): Promise<Role[]> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(roles)
      .where(and(eq(roles.isSystem, true), ne(roles.name, 'Super Admin')))
      .orderBy(roles.name);
    return result;
  }

  /**
   * Finds all roles available to an organization (org-specific + system roles)
   * Excludes hidden roles like Super Admin
   */
  async findByOrganization(
    organizationId: OrganizationId,
    options?: PaginationOptions & { includeSystem?: boolean },
    trx?: Transaction
  ): Promise<PaginatedResult<Role>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);
    const includeSystem = options?.includeSystem ?? true;

    // Build where clause: org roles + optionally system roles, excluding hidden roles
    const baseConditions = includeSystem
      ? or(eq(roles.organizationId, organizationId), eq(roles.isSystem, true))
      : eq(roles.organizationId, organizationId);

    // Exclude Super Admin (hidden system role)
    const conditions = and(baseConditions, ne(roles.name, 'Super Admin'));

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(roles)
      .where(conditions);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(roles)
      .where(conditions)
      .orderBy(roles.isSystem, roles.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Updates a role by ID (only non-system roles)
   */
  async update(
    id: string,
    data: Partial<Omit<NewRole, 'id' | 'organizationId' | 'createdAt' | 'isSystem'>>,
    trx?: Transaction
  ): Promise<Role | null> {
    const executor = getExecutor(trx);

    // Check if it's a system role
    const role = await this.findById(id, trx);
    if (role?.isSystem) {
      return null;
    }

    const result = await executor
      .update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(roles.id, id), eq(roles.isSystem, false)))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Deletes a role by ID (only non-system roles)
   */
  async delete(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);

    const result = await executor
      .delete(roles)
      .where(and(eq(roles.id, id), eq(roles.isSystem, false)))
      .returning({ id: roles.id });
    return result.length > 0;
  }

  /**
   * Checks if a role name is available within an organization
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
      conditions.push(eq(roles.organizationId, organizationId));
    } else {
      conditions.push(isNull(roles.organizationId));
    }
    conditions.push(eq(roles.name, name));

    if (excludeId) {
      conditions.push(sql`${roles.id} != ${excludeId}`);
    }

    const result = await executor
      .select({ count: sql<number>`1` })
      .from(roles)
      .where(and(...conditions))
      .limit(1);
    return result.length === 0;
  }

  // ===========================================
  // User Role Assignments
  // ===========================================

  /**
   * Assigns a role to a user
   */
  async assignRoleToUser(
    data: NewUserRoleAssignment,
    trx?: Transaction
  ): Promise<UserRoleAssignment> {
    const executor = getExecutor(trx);
    const result = await executor
      .insert(userRoleAssignments)
      .values(data)
      .returning();
    return result[0];
  }

  /**
   * Removes a role assignment from a user
   */
  async removeRoleFromUser(
    userId: UserId,
    roleId: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, roleId),
          eq(userRoleAssignments.organizationId, organizationId)
        )
      )
      .returning({ userId: userRoleAssignments.userId });
    return result.length > 0;
  }

  /**
   * Gets all role assignments for a user in an organization
   */
  async getUserRoleAssignments(
    userId: UserId,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<UserRoleAssignmentWithRole[]> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({
        userId: userRoleAssignments.userId,
        roleId: userRoleAssignments.roleId,
        roleName: roles.name,
        organizationId: userRoleAssignments.organizationId,
        scope: userRoleAssignments.scope,
        source: userRoleAssignments.source,
        assignedAt: userRoleAssignments.assignedAt,
        assignedBy: userRoleAssignments.assignedBy,
        expiresAt: userRoleAssignments.expiresAt,
      })
      .from(userRoleAssignments)
      .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.organizationId, organizationId)
        )
      )
      .orderBy(roles.name);
    return result;
  }

  /**
   * Checks if a user has a specific role in an organization
   */
  async userHasRole(
    userId: UserId,
    roleId: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, roleId),
          eq(userRoleAssignments.organizationId, organizationId)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  // ===========================================
  // Group Role Assignments
  // ===========================================

  /**
   * Assigns a role to a group
   */
  async assignRoleToGroup(
    data: NewGroupRoleAssignment,
    trx?: Transaction
  ): Promise<GroupRoleAssignment> {
    const executor = getExecutor(trx);
    const result = await executor
      .insert(groupRoleAssignments)
      .values(data)
      .returning();
    return result[0];
  }

  /**
   * Removes a role assignment from a group
   */
  async removeRoleFromGroup(
    groupId: string,
    roleId: string,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(groupRoleAssignments)
      .where(
        and(
          eq(groupRoleAssignments.groupId, groupId),
          eq(groupRoleAssignments.roleId, roleId)
        )
      )
      .returning({ groupId: groupRoleAssignments.groupId });
    return result.length > 0;
  }

  /**
   * Gets all role assignments for a group
   */
  async getGroupRoleAssignments(
    groupId: string,
    trx?: Transaction
  ): Promise<(GroupRoleAssignment & { roleName: string })[]> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({
        groupId: groupRoleAssignments.groupId,
        roleId: groupRoleAssignments.roleId,
        roleName: roles.name,
        scope: groupRoleAssignments.scope,
        assignedAt: groupRoleAssignments.assignedAt,
        assignedBy: groupRoleAssignments.assignedBy,
      })
      .from(groupRoleAssignments)
      .innerJoin(roles, eq(groupRoleAssignments.roleId, roles.id))
      .where(eq(groupRoleAssignments.groupId, groupId))
      .orderBy(roles.name);
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
let roleRepository: RoleRepository | null = null;

export function getRoleRepository(): RoleRepository {
  if (!roleRepository) {
    roleRepository = new RoleRepository();
  }
  return roleRepository;
}
