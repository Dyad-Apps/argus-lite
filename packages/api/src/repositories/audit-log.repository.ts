/**
 * Audit Log Repository
 * Provides query functionality for audit logs
 */

import { db, Transaction } from '../db/index.js';
import { auditLogs, type AuditLog } from '../db/schema/index.js';
import { desc, eq, and, gte, lte, or, ilike, sql, count } from 'drizzle-orm';
import {
  type PaginationOptions,
  type PaginatedResult,
  buildPaginatedResult,
  calculateOffset,
  getPageSize,
  getExecutor,
} from './base.repository.js';
import type { OrganizationId, UserId } from '@argus/shared';

export interface AuditLogFilter {
  organizationId?: OrganizationId;
  userId?: UserId;
  category?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface RecentActivityItem {
  id: string;
  category: string;
  action: string;
  userEmail: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  createdAt: Date;
}

/**
 * Finds audit logs with filters and pagination
 */
export async function findAuditLogs(
  filter?: AuditLogFilter,
  pagination?: PaginationOptions,
  trx?: Transaction
): Promise<PaginatedResult<AuditLog>> {
  const executor = getExecutor(trx);
  const conditions = buildFilterConditions(filter);

  // Get total count
  const countResult = await executor
    .select({ count: count() })
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const totalCount = Number(countResult[0]?.count ?? 0);

  // Get paginated data
  const data = await executor
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(getPageSize(pagination))
    .offset(calculateOffset(pagination));

  return buildPaginatedResult(data, totalCount, pagination);
}

/**
 * Gets recent activity for dashboard display
 * Returns simplified audit log entries
 */
export async function getRecentActivity(
  organizationId?: OrganizationId,
  limit: number = 10,
  trx?: Transaction
): Promise<RecentActivityItem[]> {
  const executor = getExecutor(trx);

  const conditions = organizationId
    ? [eq(auditLogs.organizationId, organizationId)]
    : [];

  const data = await executor
    .select({
      id: auditLogs.id,
      category: auditLogs.category,
      action: auditLogs.action,
      userEmail: auditLogs.userEmail,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      outcome: auditLogs.outcome,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return data.map((row) => ({
    id: row.id.toString(),
    category: row.category,
    action: row.action,
    userEmail: row.userEmail,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    outcome: row.outcome,
    createdAt: row.createdAt,
  }));
}

/**
 * Finds a single audit log by ID
 */
export async function findAuditLogById(
  id: string,
  trx?: Transaction
): Promise<AuditLog | null> {
  const executor = getExecutor(trx);

  const [log] = await executor
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, BigInt(id)))
    .limit(1);

  return log ?? null;
}

/**
 * Gets audit logs for a specific user
 */
export async function findAuditLogsByUserId(
  userId: UserId,
  pagination?: PaginationOptions,
  trx?: Transaction
): Promise<PaginatedResult<AuditLog>> {
  return findAuditLogs({ userId }, pagination, trx);
}

/**
 * Gets audit logs for a specific organization
 */
export async function findAuditLogsByOrganizationId(
  organizationId: OrganizationId,
  pagination?: PaginationOptions,
  trx?: Transaction
): Promise<PaginatedResult<AuditLog>> {
  return findAuditLogs({ organizationId }, pagination, trx);
}

/**
 * Gets audit logs for a specific resource
 */
export async function findAuditLogsByResource(
  resourceType: string,
  resourceId: string,
  pagination?: PaginationOptions,
  trx?: Transaction
): Promise<PaginatedResult<AuditLog>> {
  return findAuditLogs({ resourceType, resourceId }, pagination, trx);
}

/**
 * Builds filter conditions for audit log queries
 */
function buildFilterConditions(filter?: AuditLogFilter) {
  const conditions = [];

  if (filter?.organizationId) {
    conditions.push(eq(auditLogs.organizationId, filter.organizationId));
  }

  if (filter?.userId) {
    conditions.push(eq(auditLogs.userId, filter.userId));
  }

  if (filter?.category) {
    conditions.push(eq(auditLogs.category, filter.category as typeof auditLogs.category.enumValues[number]));
  }

  if (filter?.action) {
    conditions.push(eq(auditLogs.action, filter.action));
  }

  if (filter?.resourceType) {
    conditions.push(eq(auditLogs.resourceType, filter.resourceType));
  }

  if (filter?.resourceId) {
    conditions.push(eq(auditLogs.resourceId, filter.resourceId));
  }

  if (filter?.outcome) {
    conditions.push(eq(auditLogs.outcome, filter.outcome));
  }

  if (filter?.startDate) {
    conditions.push(gte(auditLogs.createdAt, filter.startDate));
  }

  if (filter?.endDate) {
    conditions.push(lte(auditLogs.createdAt, filter.endDate));
  }

  if (filter?.search) {
    const searchTerm = `%${filter.search}%`;
    conditions.push(
      or(
        ilike(auditLogs.action, searchTerm),
        ilike(auditLogs.userEmail, searchTerm),
        ilike(auditLogs.resourceType, searchTerm)
      )
    );
  }

  return conditions;
}
