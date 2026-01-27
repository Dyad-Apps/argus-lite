/**
 * Impersonation repository for data access
 * Manages impersonation session tracking for admin users
 */

import { eq, and, sql, desc, inArray } from 'drizzle-orm';
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
  impersonationSessions,
  users,
} from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type UserId, type OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type NewImpersonationSession = typeof impersonationSessions.$inferInsert;

export interface ImpersonationSessionWithUsers extends ImpersonationSession {
  impersonator: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  target: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export class ImpersonationRepository {
  /**
   * Creates a new impersonation session
   */
  async create(data: NewImpersonationSession, trx?: Transaction): Promise<ImpersonationSession> {
    const executor = getExecutor(trx);
    const result = await executor.insert(impersonationSessions).values(data).returning();
    return result[0];
  }

  /**
   * Finds an impersonation session by ID
   */
  async findById(id: string, trx?: Transaction): Promise<ImpersonationSession | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(impersonationSessions)
      .where(eq(impersonationSessions.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds an impersonation session by ID with user details
   */
  async findByIdWithUsers(id: string, trx?: Transaction): Promise<ImpersonationSessionWithUsers | null> {
    const executor = getExecutor(trx);

    // First get the session
    const session = await executor
      .select()
      .from(impersonationSessions)
      .where(eq(impersonationSessions.id, id))
      .limit(1);

    if (!session[0]) return null;

    // Get impersonator details
    const impersonatorResult = await executor
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, session[0].impersonatorId))
      .limit(1);

    // Get target details
    const targetResult = await executor
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, session[0].targetUserId))
      .limit(1);

    return {
      ...session[0],
      impersonator: impersonatorResult[0],
      target: targetResult[0],
    };
  }

  /**
   * Finds the active impersonation session for a user (as impersonator)
   */
  async findActiveSession(
    impersonatorId: UserId,
    trx?: Transaction
  ): Promise<ImpersonationSession | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(impersonationSessions)
      .where(
        and(
          eq(impersonationSessions.impersonatorId, impersonatorId),
          eq(impersonationSessions.status, 'active')
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all active impersonation sessions for a user (as impersonator)
   */
  async findActiveByImpersonator(
    impersonatorId: UserId,
    trx?: Transaction
  ): Promise<ImpersonationSession[]> {
    const executor = getExecutor(trx);
    return await executor
      .select()
      .from(impersonationSessions)
      .where(
        and(
          eq(impersonationSessions.impersonatorId, impersonatorId),
          eq(impersonationSessions.status, 'active')
        )
      );
  }

  /**
   * Gets all active impersonation sessions
   */
  async findAllActive(
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<ImpersonationSessionWithUsers>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(impersonationSessions)
      .where(eq(impersonationSessions.status, 'active'));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get sessions
    const sessions = await executor
      .select()
      .from(impersonationSessions)
      .where(eq(impersonationSessions.status, 'active'))
      .orderBy(desc(impersonationSessions.startedAt))
      .limit(pageSize)
      .offset(offset);

    // Get user details for all sessions
    const impersonatorIds = [...new Set(sessions.map((s) => s.impersonatorId))];
    const targetIds = [...new Set(sessions.map((s) => s.targetUserId))];
    const allUserIds = [...new Set([...impersonatorIds, ...targetIds])];

    const usersResult = allUserIds.length > 0
      ? await executor
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, allUserIds))
      : [];

    const usersMap = new Map(usersResult.map((u) => [u.id, u]));

    const data = sessions.map((session) => ({
      ...session,
      impersonator: usersMap.get(session.impersonatorId)!,
      target: usersMap.get(session.targetUserId)!,
    }));

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Gets impersonation history for a user (as impersonator or target)
   */
  async findByUser(
    userId: UserId,
    options?: PaginationOptions & { asTarget?: boolean },
    trx?: Transaction
  ): Promise<PaginatedResult<ImpersonationSessionWithUsers>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);
    const asTarget = options?.asTarget ?? false;

    const condition = asTarget
      ? eq(impersonationSessions.targetUserId, userId)
      : eq(impersonationSessions.impersonatorId, userId);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(impersonationSessions)
      .where(condition);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get sessions
    const sessions = await executor
      .select()
      .from(impersonationSessions)
      .where(condition)
      .orderBy(desc(impersonationSessions.startedAt))
      .limit(pageSize)
      .offset(offset);

    // Get user details for all sessions
    const impersonatorIds = [...new Set(sessions.map((s) => s.impersonatorId))];
    const targetIds = [...new Set(sessions.map((s) => s.targetUserId))];
    const allUserIds = [...new Set([...impersonatorIds, ...targetIds])];

    const usersResult = allUserIds.length > 0
      ? await executor
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, allUserIds))
      : [];

    const usersMap = new Map(usersResult.map((u) => [u.id, u]));

    const data = sessions.map((session) => ({
      ...session,
      impersonator: usersMap.get(session.impersonatorId)!,
      target: usersMap.get(session.targetUserId)!,
    }));

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Gets impersonation history for an organization
   */
  async findByOrganization(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<ImpersonationSessionWithUsers>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(impersonationSessions)
      .where(eq(impersonationSessions.organizationId, organizationId));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get sessions
    const sessions = await executor
      .select()
      .from(impersonationSessions)
      .where(eq(impersonationSessions.organizationId, organizationId))
      .orderBy(desc(impersonationSessions.startedAt))
      .limit(pageSize)
      .offset(offset);

    // Get user details for all sessions
    const impersonatorIds = [...new Set(sessions.map((s) => s.impersonatorId))];
    const targetIds = [...new Set(sessions.map((s) => s.targetUserId))];
    const allUserIds = [...new Set([...impersonatorIds, ...targetIds])];

    const usersResult = allUserIds.length > 0
      ? await executor
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, allUserIds))
      : [];

    const usersMap = new Map(usersResult.map((u) => [u.id, u]));

    const data = sessions.map((session) => ({
      ...session,
      impersonator: usersMap.get(session.impersonatorId)!,
      target: usersMap.get(session.targetUserId)!,
    }));

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Ends an impersonation session
   */
  async endSession(
    id: string,
    status: 'ended' | 'expired' | 'revoked' = 'ended',
    trx?: Transaction
  ): Promise<ImpersonationSession | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(impersonationSessions)
      .set({
        status,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(impersonationSessions.id, id),
          eq(impersonationSessions.status, 'active')
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Ends all active sessions for an impersonator
   */
  async endAllSessionsForUser(
    impersonatorId: UserId,
    trx?: Transaction
  ): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(impersonationSessions)
      .set({
        status: 'ended',
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(impersonationSessions.impersonatorId, impersonatorId),
          eq(impersonationSessions.status, 'active')
        )
      )
      .returning({ id: impersonationSessions.id });
    return result.length;
  }

  /**
   * Expires all sessions that have passed their expiration time
   */
  async expireOldSessions(trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const now = new Date();
    const result = await executor
      .update(impersonationSessions)
      .set({
        status: 'expired',
        endedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(impersonationSessions.status, 'active'),
          sql`${impersonationSessions.expiresAt} < ${now}`
        )
      )
      .returning({ id: impersonationSessions.id });
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
let impersonationRepository: ImpersonationRepository | null = null;

export function getImpersonationRepository(): ImpersonationRepository {
  if (!impersonationRepository) {
    impersonationRepository = new ImpersonationRepository();
  }
  return impersonationRepository;
}
