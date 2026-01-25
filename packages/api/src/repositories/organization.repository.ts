/**
 * Organization repository for data access
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
import { organizations } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export class OrganizationRepository {
  /**
   * Creates a new organization
   */
  async create(data: NewOrganization, trx?: Transaction): Promise<Organization> {
    const executor = getExecutor(trx);
    const result = await executor.insert(organizations).values(data).returning();
    return result[0];
  }

  /**
   * Finds an organization by ID
   */
  async findById(
    id: OrganizationId,
    trx?: Transaction
  ): Promise<Organization | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds an organization by slug
   */
  async findBySlug(
    slug: string,
    trx?: Transaction
  ): Promise<Organization | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug.toLowerCase()))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all organizations with pagination
   */
  async findAll(
    options?: PaginationOptions & { activeOnly?: boolean },
    trx?: Transaction
  ): Promise<PaginatedResult<Organization>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);
    const activeOnly = options?.activeOnly ?? false;

    // Build where clause
    const whereClause = activeOnly
      ? eq(organizations.isActive, true)
      : undefined;

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(organizations)
      .where(whereClause)
      .orderBy(organizations.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Updates an organization by ID
   */
  async update(
    id: OrganizationId,
    data: Partial<Omit<NewOrganization, 'id' | 'slug' | 'createdAt'>>,
    trx?: Transaction
  ): Promise<Organization | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Deletes an organization by ID (hard delete)
   * Note: This will cascade delete all related data
   */
  async delete(id: OrganizationId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(organizations)
      .where(eq(organizations.id, id))
      .returning({ id: organizations.id });
    return result.length > 0;
  }

  /**
   * Checks if a slug is available
   */
  async isSlugAvailable(slug: string, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(organizations)
      .where(eq(organizations.slug, slug.toLowerCase()))
      .limit(1);
    return result.length === 0;
  }

  // ===========================================
  // Hierarchy Methods
  // ===========================================

  /**
   * Gets direct children of an organization
   */
  async getChildren(
    parentId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Organization>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(eq(organizations.parentOrganizationId, parentId));
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(organizations)
      .where(eq(organizations.parentOrganizationId, parentId))
      .orderBy(organizations.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Gets all descendants of an organization (using LTREE path)
   */
  async getDescendants(
    orgId: OrganizationId,
    trx?: Transaction
  ): Promise<Organization[]> {
    const executor = getExecutor(trx);

    // First get the organization to get its path
    const org = await this.findById(orgId, trx);
    if (!org || !org.path) {
      return [];
    }

    // Use LTREE descendant query
    const result = await executor
      .select()
      .from(organizations)
      .where(sql`${organizations.path} <@ ${org.path} AND ${organizations.id} != ${orgId}`)
      .orderBy(organizations.depth, organizations.name);

    return result;
  }

  /**
   * Gets all ancestors of an organization (using LTREE path)
   */
  async getAncestors(
    orgId: OrganizationId,
    trx?: Transaction
  ): Promise<Organization[]> {
    const executor = getExecutor(trx);

    // First get the organization to get its path
    const org = await this.findById(orgId, trx);
    if (!org || !org.path) {
      return [];
    }

    // Use LTREE ancestor query
    const result = await executor
      .select()
      .from(organizations)
      .where(sql`${organizations.path} @> ${org.path} AND ${organizations.id} != ${orgId}`)
      .orderBy(organizations.depth);

    return result;
  }

  /**
   * Gets the full hierarchy tree from a root organization
   */
  async getHierarchyTree(
    rootId: OrganizationId,
    trx?: Transaction
  ): Promise<Organization[]> {
    const executor = getExecutor(trx);

    // Get all organizations in this root's tree
    const result = await executor
      .select()
      .from(organizations)
      .where(eq(organizations.rootOrganizationId, rootId))
      .orderBy(organizations.depth, organizations.name);

    return result;
  }

  /**
   * Creates a child organization under a parent
   */
  async createChild(
    parentId: OrganizationId,
    data: Omit<NewOrganization, 'parentOrganizationId' | 'rootOrganizationId' | 'isRoot' | 'depth'>,
    trx?: Transaction
  ): Promise<Organization> {
    const executor = getExecutor(trx);

    // Get parent organization
    const parent = await this.findById(parentId, trx);
    if (!parent) {
      throw new Error('Parent organization not found');
    }

    if (!parent.canHaveChildren) {
      throw new Error('Parent organization cannot have children');
    }

    // Calculate child properties
    const childDepth = parent.depth + 1;
    const childPath = parent.path
      ? `${parent.path}.${data.slug.toLowerCase().replace(/-/g, '_')}`
      : data.slug.toLowerCase().replace(/-/g, '_');

    // Create child organization
    const result = await executor
      .insert(organizations)
      .values({
        ...data,
        parentOrganizationId: parentId,
        rootOrganizationId: parent.rootOrganizationId ?? parent.id,
        isRoot: false,
        depth: childDepth,
        path: childPath,
      })
      .returning();

    return result[0];
  }

  /**
   * Finds an organization by subdomain (for root orgs only)
   */
  async findBySubdomain(
    subdomain: string,
    trx?: Transaction
  ): Promise<Organization | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(organizations)
      .where(and(eq(organizations.subdomain, subdomain.toLowerCase()), eq(organizations.isRoot, true)))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let organizationRepository: OrganizationRepository | null = null;

export function getOrganizationRepository(): OrganizationRepository {
  if (!organizationRepository) {
    organizationRepository = new OrganizationRepository();
  }
  return organizationRepository;
}
