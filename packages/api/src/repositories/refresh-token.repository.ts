/**
 * Refresh token repository for token rotation
 */

import { eq, and, lt, isNull, sql } from 'drizzle-orm';
import {
  getExecutor,
  withTransaction,
} from './base.repository.js';
import { refreshTokens } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type UserId } from '@argus/shared';
import crypto from 'crypto';

// Infer types from Drizzle schema
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

/** Refresh token expiry: 7 days */
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Generates a cryptographically secure refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hashes a refresh token for storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class RefreshTokenRepository {
  /**
   * Creates a new refresh token for a user
   * Returns the raw token (to be sent to client) and the stored record
   */
  async create(
    userId: UserId,
    options?: {
      familyId?: string;
      userAgent?: string;
      ipAddress?: string;
    },
    trx?: Transaction
  ): Promise<{ token: string; record: RefreshToken }> {
    const executor = getExecutor(trx);
    const token = generateRefreshToken();
    const tokenHash = hashRefreshToken(token);
    const familyId = options?.familyId ?? crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const result = await executor
      .insert(refreshTokens)
      .values({
        userId,
        tokenHash,
        familyId,
        expiresAt,
        userAgent: options?.userAgent ?? null,
        ipAddress: options?.ipAddress ?? null,
      })
      .returning();

    return { token, record: result[0] };
  }

  /**
   * Finds a refresh token by its hash (excludes revoked and expired)
   */
  async findByTokenHash(
    tokenHash: string,
    trx?: Transaction
  ): Promise<RefreshToken | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.isRevoked, false),
          lt(sql`now()`, refreshTokens.expiresAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a refresh token by hash including revoked (for detection)
   */
  async findByTokenHashIncludeRevoked(
    tokenHash: string,
    trx?: Transaction
  ): Promise<RefreshToken | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Rotates a refresh token - revokes old one and creates new one in same family
   * Returns the new raw token and record
   */
  async rotate(
    oldToken: RefreshToken,
    options?: {
      userAgent?: string;
      ipAddress?: string;
    },
    trx?: Transaction
  ): Promise<{ token: string; record: RefreshToken }> {
    const executor = getExecutor(trx);

    // Revoke the old token
    await executor
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      })
      .where(eq(refreshTokens.id, oldToken.id));

    // Create new token in the same family
    return this.create(
      oldToken.userId as UserId,
      {
        familyId: oldToken.familyId,
        userAgent: options?.userAgent ?? oldToken.userAgent ?? undefined,
        ipAddress: options?.ipAddress ?? oldToken.ipAddress ?? undefined,
      },
      trx
    );
  }

  /**
   * Revokes all tokens in a family (used when theft is detected)
   */
  async revokeFamilyTokens(familyId: string, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          eq(refreshTokens.isRevoked, false)
        )
      )
      .returning({ id: refreshTokens.id });
    return result.length;
  }

  /**
   * Revokes a specific token by ID
   */
  async revokeById(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.id, id))
      .returning({ id: refreshTokens.id });
    return result.length > 0;
  }

  /**
   * Revokes all tokens for a user (logout from all sessions)
   */
  async revokeAllUserTokens(userId: UserId, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false)
        )
      )
      .returning({ id: refreshTokens.id });
    return result.length;
  }

  /**
   * Gets all active sessions for a user
   */
  async getActiveSessions(
    userId: UserId,
    trx?: Transaction
  ): Promise<RefreshToken[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false),
          lt(sql`now()`, refreshTokens.expiresAt)
        )
      )
      .orderBy(refreshTokens.createdAt);
  }

  /**
   * Deletes expired tokens (cleanup job)
   */
  async deleteExpired(trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, sql`now()`))
      .returning({ id: refreshTokens.id });
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
let refreshTokenRepository: RefreshTokenRepository | null = null;

export function getRefreshTokenRepository(): RefreshTokenRepository {
  if (!refreshTokenRepository) {
    refreshTokenRepository = new RefreshTokenRepository();
  }
  return refreshTokenRepository;
}
