/**
 * Organization invitation repository
 */

import { eq, and, lt, sql } from 'drizzle-orm';
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
  organizationInvitations,
  organizations,
  users,
} from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import {
  type OrganizationId,
  type UserId,
  type InvitationId,
} from '@argus/shared';
import crypto from 'crypto';

// Infer types from Drizzle schema
export type OrganizationInvitation =
  typeof organizationInvitations.$inferSelect;
export type NewOrganizationInvitation =
  typeof organizationInvitations.$inferInsert;
export type InvitationStatus = OrganizationInvitation['status'];

/** Invitation expiry: 7 days */
const INVITATION_EXPIRY_DAYS = 7;

/**
 * Generates a cryptographically secure invitation token
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hashes an invitation token for storage
 */
export function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Invitation with organization details */
export interface InvitationWithDetails extends OrganizationInvitation {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  inviter: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export class InvitationRepository {
  /**
   * Creates a new invitation
   * Returns the raw token (to be sent to invitee)
   */
  async create(
    data: Omit<NewOrganizationInvitation, 'tokenHash' | 'expiresAt'>,
    trx?: Transaction
  ): Promise<{ token: string; invitation: OrganizationInvitation }> {
    const executor = getExecutor(trx);

    // Check for existing pending invitation
    const existing = await executor
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, data.organizationId),
          eq(organizationInvitations.email, data.email.toLowerCase()),
          eq(organizationInvitations.status, 'pending')
        )
      )
      .limit(1);

    // Cancel existing pending invitation if any
    if (existing.length > 0) {
      await executor
        .update(organizationInvitations)
        .set({ status: 'cancelled' })
        .where(eq(organizationInvitations.id, existing[0].id));
    }

    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const result = await executor
      .insert(organizationInvitations)
      .values({
        ...data,
        email: data.email.toLowerCase(),
        tokenHash,
        expiresAt,
      })
      .returning();

    return { token, invitation: result[0] };
  }

  /**
   * Finds an invitation by token hash
   */
  async findByTokenHash(
    tokenHash: string,
    trx?: Transaction
  ): Promise<OrganizationInvitation | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.tokenHash, tokenHash))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds an invitation by ID with details
   */
  async findByIdWithDetails(
    id: InvitationId,
    trx?: Transaction
  ): Promise<InvitationWithDetails | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        status: organizationInvitations.status,
        tokenHash: organizationInvitations.tokenHash,
        invitedBy: organizationInvitations.invitedBy,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
        acceptedBy: organizationInvitations.acceptedBy,
        createdAt: organizationInvitations.createdAt,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        },
        inviter: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(organizationInvitations)
      .innerJoin(
        organizations,
        eq(organizationInvitations.organizationId, organizations.id)
      )
      .innerJoin(users, eq(organizationInvitations.invitedBy, users.id))
      .where(eq(organizationInvitations.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a pending invitation by token hash with details
   */
  async findPendingByTokenHash(
    tokenHash: string,
    trx?: Transaction
  ): Promise<InvitationWithDetails | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        status: organizationInvitations.status,
        tokenHash: organizationInvitations.tokenHash,
        invitedBy: organizationInvitations.invitedBy,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
        acceptedBy: organizationInvitations.acceptedBy,
        createdAt: organizationInvitations.createdAt,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        },
        inviter: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(organizationInvitations)
      .innerJoin(
        organizations,
        eq(organizationInvitations.organizationId, organizations.id)
      )
      .innerJoin(users, eq(organizationInvitations.invitedBy, users.id))
      .where(
        and(
          eq(organizationInvitations.tokenHash, tokenHash),
          eq(organizationInvitations.status, 'pending'),
          lt(sql`now()`, organizationInvitations.expiresAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Lists invitations for an organization
   */
  async listByOrganization(
    organizationId: OrganizationId,
    options?: PaginationOptions & { status?: InvitationStatus },
    trx?: Transaction
  ): Promise<PaginatedResult<InvitationWithDetails>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Build where clause
    const whereConditions = [
      eq(organizationInvitations.organizationId, organizationId),
    ];
    if (options?.status) {
      whereConditions.push(eq(organizationInvitations.status, options.status));
    }

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(organizationInvitations)
      .where(and(...whereConditions));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        status: organizationInvitations.status,
        tokenHash: organizationInvitations.tokenHash,
        invitedBy: organizationInvitations.invitedBy,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
        acceptedBy: organizationInvitations.acceptedBy,
        createdAt: organizationInvitations.createdAt,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        },
        inviter: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(organizationInvitations)
      .innerJoin(
        organizations,
        eq(organizationInvitations.organizationId, organizations.id)
      )
      .innerJoin(users, eq(organizationInvitations.invitedBy, users.id))
      .where(and(...whereConditions))
      .orderBy(organizationInvitations.createdAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Marks an invitation as accepted
   */
  async accept(
    id: InvitationId,
    acceptedBy: UserId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(organizationInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy,
      })
      .where(
        and(
          eq(organizationInvitations.id, id),
          eq(organizationInvitations.status, 'pending')
        )
      )
      .returning({ id: organizationInvitations.id });
    return result.length > 0;
  }

  /**
   * Marks an invitation as declined
   */
  async decline(id: InvitationId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(organizationInvitations)
      .set({ status: 'declined' })
      .where(
        and(
          eq(organizationInvitations.id, id),
          eq(organizationInvitations.status, 'pending')
        )
      )
      .returning({ id: organizationInvitations.id });
    return result.length > 0;
  }

  /**
   * Cancels a pending invitation
   */
  async cancel(id: InvitationId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(organizationInvitations)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(organizationInvitations.id, id),
          eq(organizationInvitations.status, 'pending')
        )
      )
      .returning({ id: organizationInvitations.id });
    return result.length > 0;
  }

  /**
   * Marks expired invitations
   */
  async markExpired(trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(organizationInvitations)
      .set({ status: 'expired' })
      .where(
        and(
          eq(organizationInvitations.status, 'pending'),
          lt(organizationInvitations.expiresAt, sql`now()`)
        )
      )
      .returning({ id: organizationInvitations.id });
    return result.length;
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let invitationRepository: InvitationRepository | null = null;

export function getInvitationRepository(): InvitationRepository {
  if (!invitationRepository) {
    invitationRepository = new InvitationRepository();
  }
  return invitationRepository;
}
