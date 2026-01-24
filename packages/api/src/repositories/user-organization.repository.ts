/**
 * User-Organization membership repository
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
import { userOrganizations, users, organizations } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type UserId, type OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type UserOrganization = typeof userOrganizations.$inferSelect;
export type NewUserOrganization = typeof userOrganizations.$inferInsert;
export type OrganizationRole = UserOrganization['role'];

/** Membership with user details */
export interface MemberWithUser extends UserOrganization {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
  };
}

/** Membership with organization details */
export interface MembershipWithOrg extends UserOrganization {
  organization: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
}

export class UserOrganizationRepository {
  /**
   * Adds a user to an organization
   */
  async addMember(
    data: NewUserOrganization,
    trx?: Transaction
  ): Promise<UserOrganization> {
    const executor = getExecutor(trx);
    const result = await executor
      .insert(userOrganizations)
      .values(data)
      .returning();
    return result[0];
  }

  /**
   * Finds a membership by user and organization
   */
  async findMembership(
    userId: UserId,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<UserOrganization | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Gets all members of an organization with user details
   */
  async getOrganizationMembers(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<MemberWithUser>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, organizationId));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get members with user details
    const data = await executor
      .select({
        userId: userOrganizations.userId,
        organizationId: userOrganizations.organizationId,
        role: userOrganizations.role,
        joinedAt: userOrganizations.joinedAt,
        invitedBy: userOrganizations.invitedBy,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          status: users.status,
        },
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId))
      .orderBy(userOrganizations.joinedAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Gets all organizations for a user
   */
  async getUserOrganizations(
    userId: UserId,
    trx?: Transaction
  ): Promise<MembershipWithOrg[]> {
    const executor = getExecutor(trx);
    return executor
      .select({
        userId: userOrganizations.userId,
        organizationId: userOrganizations.organizationId,
        role: userOrganizations.role,
        joinedAt: userOrganizations.joinedAt,
        invitedBy: userOrganizations.invitedBy,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          isActive: organizations.isActive,
        },
      })
      .from(userOrganizations)
      .innerJoin(
        organizations,
        eq(userOrganizations.organizationId, organizations.id)
      )
      .where(eq(userOrganizations.userId, userId))
      .orderBy(organizations.name);
  }

  /**
   * Updates a member's role
   */
  async updateRole(
    userId: UserId,
    organizationId: OrganizationId,
    role: OrganizationRole,
    trx?: Transaction
  ): Promise<UserOrganization | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(userOrganizations)
      .set({ role })
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Removes a member from an organization
   */
  async removeMember(
    userId: UserId,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .returning({ id: userOrganizations.userId });
    return result.length > 0;
  }

  /**
   * Counts members in an organization
   */
  async countMembers(
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, organizationId));
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Counts owners in an organization
   */
  async countOwners(
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.organizationId, organizationId),
          eq(userOrganizations.role, 'owner')
        )
      );
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Checks if user has at least the specified role level
   */
  async hasRoleOrHigher(
    userId: UserId,
    organizationId: OrganizationId,
    minRole: OrganizationRole,
    trx?: Transaction
  ): Promise<boolean> {
    const membership = await this.findMembership(userId, organizationId, trx);
    if (!membership) return false;

    const roleHierarchy: Record<OrganizationRole, number> = {
      viewer: 0,
      member: 1,
      admin: 2,
      owner: 3,
    };

    return roleHierarchy[membership.role] >= roleHierarchy[minRole];
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let userOrganizationRepository: UserOrganizationRepository | null = null;

export function getUserOrganizationRepository(): UserOrganizationRepository {
  if (!userOrganizationRepository) {
    userOrganizationRepository = new UserOrganizationRepository();
  }
  return userOrganizationRepository;
}
