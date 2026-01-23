/**
 * Base repository utilities for meta-model aware data access
 * Provides helper functions and types for consistent repository patterns
 */

import { db, Transaction } from '../db/index.js';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export const DEFAULT_PAGE_SIZE = 20;

/**
 * Builds paginated result with metadata
 */
export function buildPaginatedResult<T>(
  data: T[],
  totalCount: number,
  options?: PaginationOptions
): PaginatedResult<T> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

/**
 * Calculates offset for pagination
 */
export function calculateOffset(options?: PaginationOptions): number {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  return (page - 1) * pageSize;
}

/**
 * Gets page size from options with default
 */
export function getPageSize(options?: PaginationOptions): number {
  return options?.pageSize ?? DEFAULT_PAGE_SIZE;
}

/**
 * Gets the database executor (transaction or default db)
 */
export function getExecutor(trx?: Transaction) {
  return trx ?? db;
}

/**
 * Executes operations within a transaction
 */
export async function withTransaction<T>(
  fn: (trx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}
