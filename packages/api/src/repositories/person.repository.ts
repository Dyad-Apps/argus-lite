/**
 * Person repository for individuals in the organization
 * Provides data access for persons with user linkage
 */

import { eq, and, sql, inArray, ilike, isNull } from 'drizzle-orm';
import {
  PaginatedResult,
  PaginationOptions,
  buildPaginatedResult,
  calculateOffset,
  getPageSize,
  getExecutor,
  withTransaction,
} from './base.repository.js';
import { persons, personTypes } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import type { OrganizationId, UserId } from '@argus/shared';

// Infer types from Drizzle schema
export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;

export class PersonRepository {
  /**
   * Creates a new person
   */
  async create(data: NewPerson, trx?: Transaction): Promise<Person> {
    const executor = getExecutor(trx);
    const result = await executor.insert(persons).values(data).returning();
    return result[0];
  }

  /**
   * Creates multiple persons
   */
  async createMany(data: NewPerson[], trx?: Transaction): Promise<Person[]> {
    if (data.length === 0) return [];
    const executor = getExecutor(trx);
    return executor.insert(persons).values(data).returning();
  }

  /**
   * Finds a person by ID within a tenant
   */
  async findById(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Person | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(persons)
      .where(
        and(
          eq(persons.id, id),
          eq(persons.organizationId, organizationId),
          isNull(persons.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds a person by user ID
   */
  async findByUserId(
    userId: UserId,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Person | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(persons)
      .where(
        and(
          eq(persons.userId, userId),
          eq(persons.organizationId, organizationId),
          isNull(persons.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds all persons within a tenant with pagination
   */
  async findAllInTenant(
    organizationId: OrganizationId,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Person>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(persons.organizationId, organizationId),
      isNull(persons.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(persons)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(persons)
      .where(whereClause)
      .orderBy(persons.name)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds persons by person type within a tenant
   */
  async findByPersonType(
    organizationId: OrganizationId,
    personTypeId: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Person>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(persons.organizationId, organizationId),
      eq(persons.personTypeId, personTypeId),
      isNull(persons.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(persons)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(persons)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Finds persons by email within a tenant
   */
  async findByEmail(
    organizationId: OrganizationId,
    email: string,
    trx?: Transaction
  ): Promise<Person | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(persons)
      .where(
        and(
          eq(persons.organizationId, organizationId),
          eq(persons.email, email),
          isNull(persons.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Finds persons by department within a tenant
   */
  async findByDepartment(
    organizationId: OrganizationId,
    department: string,
    options?: PaginationOptions,
    trx?: Transaction
  ): Promise<PaginatedResult<Person>> {
    const executor = getExecutor(trx);
    const pageSize = getPageSize(options);
    const offset = calculateOffset(options);

    const whereClause = and(
      eq(persons.organizationId, organizationId),
      eq(persons.department, department),
      isNull(persons.deletedAt)
    );

    // Get total count
    const countResult = await executor
      .select({ count: sql<number>`count(*)` })
      .from(persons)
      .where(whereClause);
    const totalCount = Number(countResult[0]?.count ?? 0);

    // Get data
    const data = await executor
      .select()
      .from(persons)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    return buildPaginatedResult(data, totalCount, options);
  }

  /**
   * Searches persons by name (case-insensitive) within a tenant
   */
  async searchByName(
    organizationId: OrganizationId,
    name: string,
    trx?: Transaction
  ): Promise<Person[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(persons)
      .where(
        and(
          eq(persons.organizationId, organizationId),
          ilike(persons.name, `%${name}%`),
          isNull(persons.deletedAt)
        )
      );
  }

  /**
   * Finds multiple persons by their IDs within a tenant
   */
  async findManyByIds(
    organizationId: OrganizationId,
    ids: string[],
    trx?: Transaction
  ): Promise<Person[]> {
    if (ids.length === 0) return [];
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(persons)
      .where(
        and(
          eq(persons.organizationId, organizationId),
          inArray(persons.id, ids),
          isNull(persons.deletedAt)
        )
      );
  }

  /**
   * Updates a person by ID within a tenant
   */
  async update(
    id: string,
    organizationId: OrganizationId,
    data: Partial<NewPerson>,
    trx?: Transaction
  ): Promise<Person | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(persons)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(persons.id, id),
          eq(persons.organizationId, organizationId),
          isNull(persons.deletedAt)
        )
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Soft deletes a person by setting deletedAt timestamp
   */
  async softDelete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<Person | null> {
    return this.update(id, organizationId, { deletedAt: new Date() }, trx);
  }

  /**
   * Hard deletes a person by ID within a tenant
   */
  async delete(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(persons)
      .where(
        and(eq(persons.id, id), eq(persons.organizationId, organizationId))
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Checks if a person exists by ID within a tenant
   */
  async exists(
    id: string,
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`1` })
      .from(persons)
      .where(
        and(
          eq(persons.id, id),
          eq(persons.organizationId, organizationId),
          isNull(persons.deletedAt)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Counts persons within a tenant
   */
  async count(organizationId: OrganizationId, trx?: Transaction): Promise<number> {
    const executor = getExecutor(trx);
    const result = await executor
      .select({ count: sql<number>`count(*)` })
      .from(persons)
      .where(
        and(eq(persons.organizationId, organizationId), isNull(persons.deletedAt))
      );
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Finds persons within a radius of a location (geospatial query)
   */
  async findNearby(
    organizationId: OrganizationId,
    lat: number,
    lng: number,
    radiusMeters: number,
    trx?: Transaction
  ): Promise<Person[]> {
    const executor = getExecutor(trx);
    return executor
      .select()
      .from(persons)
      .where(
        and(
          eq(persons.organizationId, organizationId),
          isNull(persons.deletedAt),
          sql`ST_DWithin(
            ${persons.geolocation}::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )`
        )
      );
  }

  /**
   * Updates a person's location
   */
  async updateLocation(
    id: string,
    organizationId: OrganizationId,
    lat: number,
    lng: number,
    trx?: Transaction
  ): Promise<Person | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(persons)
      .set({
        geolocation: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(persons.id, id),
          eq(persons.organizationId, organizationId),
          isNull(persons.deletedAt)
        )
      )
      .returning();
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
let personRepository: PersonRepository | null = null;

export function getPersonRepository(): PersonRepository {
  if (!personRepository) {
    personRepository = new PersonRepository();
  }
  return personRepository;
}
