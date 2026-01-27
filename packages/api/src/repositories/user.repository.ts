/**
 * User repository for user data access
 */

import { eq, and, sql, isNull } from 'drizzle-orm';
import {
  PaginatedResult,
  PaginationOptions,
  buildPaginatedResult,
  calculateOffset,
  getPageSize,
  getExecutor,
  withTransaction,
} from './base.repository.js';
import { users } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type UserId } from '@argus/shared';

// Infer types from Drizzle schema
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** User without password hash for responses */
export type SafeUser = Omit<User, 'passwordHash'>;

export class UserRepository {
  /**
   * Creates a new user
   */
  async create(data: NewUser, trx?: Transaction): Promise<User> {
    const executor = getExecutor(trx);
    const result = await executor.insert(users).values(data).returning();
    return result[0];
  }

  /**
   * Finds a user by ID (excludes soft deleted)
   */
  async findById(id: UserId, trx?: Transaction): Promise<User | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a user by email (excludes soft deleted)
   */
  async findByEmail(email: string, trx?: Transaction): Promise<User | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a user by email including soft deleted (for checking email uniqueness)
   */
  async findByEmailIncludeDeleted(
    email: string,
    trx?: Transaction
  ): Promise<User | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all users with pagination (excludes soft deleted)
   */
  async findAll(
    options?: PaginationOptions & { organizationId?: UserId },
    trx?: Transaction
  ): Promise<PaginatedResult<User>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Build base query
    let query = executor
      .select()
      .from(users)
      .where(isNull(users.deletedAt))
      .$dynamic();

    // Add organization filter
    if (options?.organizationId) {
      // We need to filter by users belonging to the organization
      // Using WHERE EXISTS for performance and to keep the main query simple
      query = query.where(and(
        isNull(users.deletedAt),
        sql`EXISTS (
          SELECT 1 FROM user_organizations uo 
          WHERE uo.user_id = ${users.id} 
          AND uo.organization_id = ${options.organizationId}
        )`
      ));
    }

    // Get count based on filter
    const countQuery = executor
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(isNull(users.deletedAt))
      .$dynamic();

    if (options?.organizationId) {
      countQuery.where(and(
        isNull(users.deletedAt),
        sql`EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = ${users.id} 
            AND uo.organization_id = ${options.organizationId}
            )`
      ));
    }

    const countResult = await countQuery;
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Execute query with pagination
    const data = await query
      .orderBy(users.createdAt)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Updates a user by ID
   */
  async update(
    id: UserId,
    data: Partial<Omit<NewUser, 'id' | 'email' | 'createdAt'>>,
    trx?: Transaction
  ): Promise<User | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Updates password hash
   */
  async updatePassword(
    id: UserId,
    passwordHash: string,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });
    return result.length > 0;
  }

  /**
   * Updates last login timestamp
   */
  async updateLastLogin(id: UserId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return result.length > 0;
  }

  /**
   * Marks email as verified
   */
  async markEmailVerified(id: UserId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.emailVerifiedAt)))
      .returning({ id: users.id });
    return result.length > 0;
  }

  /**
   * Soft deletes a user
   */
  async softDelete(id: UserId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(users)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });
    return result.length > 0;
  }

  /**
   * Checks if a user exists by email
   */
  async existsByEmail(email: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return result.length > 0;
  }

  /**
   * Strips password hash from user object
   */
  toSafeUser(user: User): SafeUser {
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let userRepository: UserRepository | null = null;

export function getUserRepository(): UserRepository {
  if (!userRepository) {
    userRepository = new UserRepository();
  }
  return userRepository;
}
