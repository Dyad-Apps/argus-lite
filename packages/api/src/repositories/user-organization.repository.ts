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
import { userOrganizations, users, organizations, roles, userRoleAssignments } from '../db/schema/index.js';
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
        isPrimary: userOrganizations.isPrimary,
        expiresAt: userOrganizations.expiresAt,
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
        isPrimary: userOrganizations.isPrimary,
        expiresAt: userOrganizations.expiresAt,
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
    // Super admins have full access everywhere
    const superAdmin = await this.isSuperAdmin(userId, trx);
    if (superAdmin) return true;

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
   * Checks if a user is a Super Admin (has Super Admin role at a root organization)
   * Super Admins have access to all organizations in the system
   */
  async isSuperAdmin(userId: UserId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);

    // Check if user has "Super Admin" role assigned at any root organization
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(userRoleAssignments)
      .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
      .innerJoin(organizations, eq(userRoleAssignments.organizationId, organizations.id))
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(roles.name, 'Super Admin'),
          eq(roles.isSystem, true),
          eq(organizations.isRoot, true)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Finds membership or returns synthetic membership for super admins
   * Super admins get virtual "owner" access to any organization
   */
  async findMembershipOrSuperAdmin(
    userId: UserId,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<UserOrganization | null> {
    // First check direct membership
    const membership = await this.findMembership(userId, organizationId, trx);
    if (membership) return membership;

    // Check if user is a super admin
    const superAdmin = await this.isSuperAdmin(userId, trx);
    if (superAdmin) {
      // Return synthetic membership with owner role
      return {
        userId,
        organizationId,
        role: 'owner',
        isPrimary: false,
        joinedAt: new Date(),
        invitedBy: null,
        expiresAt: null,
      } as UserOrganization;
    }

    return null;
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
