/**
 * Password reset token repository
 */

import { eq, and, lt, isNull, sql } from 'drizzle-orm';
import { getExecutor, withTransaction } from './base.repository.js';
import { passwordResetTokens } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type UserId } from '@argus/shared';
import crypto from 'crypto';

// Infer types from Drizzle schema
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/** Token expiry: 1 hour */
const TOKEN_EXPIRY_HOURS = 1;

/**
 * Generates a cryptographically secure reset token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hashes a reset token for storage
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class PasswordResetTokenRepository {
  /**
   * Creates a new password reset token for a user
   * Invalidates any existing tokens for the user
   * Returns the raw token (to be sent to user)
   */
  async create(
    userId: UserId,
    trx?: Transaction
  ): Promise<{ token: string; record: PasswordResetToken }> {
    const executor = getExecutor(trx);

    // Invalidate any existing unused tokens for this user
    await executor
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt)
        )
      );

    const token = generateResetToken();
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    const result = await executor
      .insert(passwordResetTokens)
      .values({
        userId,
        tokenHash,
        expiresAt,
      })
      .returning();

    return { token, record: result[0] };
  }

  /**
   * Finds a valid (unused, not expired) token by hash
   */
  async findValidByTokenHash(
    tokenHash: string,
    trx?: Transaction
  ): Promise<PasswordResetToken | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          lt(sql`now()`, passwordResetTokens.expiresAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Marks a token as used
   */
  async markUsed(id: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id))
      .returning({ id: passwordResetTokens.id });
    return result.length > 0;
  }

  /**
   * Deletes expired tokens (cleanup job)
   */
  async deleteExpired(trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, sql`now()`))
      .returning({ id: passwordResetTokens.id });
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
let passwordResetTokenRepository: PasswordResetTokenRepository | null = null;

export function getPasswordResetTokenRepository(): PasswordResetTokenRepository {
  if (!passwordResetTokenRepository) {
    passwordResetTokenRepository = new PasswordResetTokenRepository();
  }
  return passwordResetTokenRepository;
}
