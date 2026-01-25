/**
 * Organization branding repository for data access
 */

import { eq } from 'drizzle-orm';
import { getExecutor, withTransaction } from './base.repository.js';
import { organizationBranding } from '../db/schema/index.js';
import { Transaction } from '../db/index.js';
import { type OrganizationId } from '@argus/shared';

// Infer types from Drizzle schema
export type OrganizationBranding = typeof organizationBranding.$inferSelect;
export type NewOrganizationBranding = typeof organizationBranding.$inferInsert;

export class BrandingRepository {
  /**
   * Gets branding for an organization
   */
  async findByOrganizationId(
    organizationId: OrganizationId,
    trx?: Transaction
  ): Promise<OrganizationBranding | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .select()
      .from(organizationBranding)
      .where(eq(organizationBranding.organizationId, organizationId))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Creates branding for an organization
   */
  async create(
    data: NewOrganizationBranding,
    trx?: Transaction
  ): Promise<OrganizationBranding> {
    const executor = getExecutor(trx);
    const result = await executor
      .insert(organizationBranding)
      .values(data)
      .returning();
    return result[0];
  }

  /**
   * Updates branding for an organization
   */
  async update(
    organizationId: OrganizationId,
    data: Partial<Omit<NewOrganizationBranding, 'id' | 'organizationId' | 'createdAt'>>,
    trx?: Transaction
  ): Promise<OrganizationBranding | null> {
    const executor = getExecutor(trx);
    const result = await executor
      .update(organizationBranding)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizationBranding.organizationId, organizationId))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Creates or updates branding for an organization (upsert)
   */
  async upsert(
    organizationId: OrganizationId,
    data: Omit<NewOrganizationBranding, 'id' | 'organizationId' | 'createdAt'>,
    trx?: Transaction
  ): Promise<OrganizationBranding> {
    const existing = await this.findByOrganizationId(organizationId, trx);

    if (existing) {
      const updated = await this.update(organizationId, data, trx);
      return updated!;
    } else {
      return this.create({ ...data, organizationId }, trx);
    }
  }

  /**
   * Deletes branding for an organization
   */
  async delete(organizationId: OrganizationId, trx?: Transaction): Promise<boolean> {
    const executor = getExecutor(trx);
    const result = await executor
      .delete(organizationBranding)
      .where(eq(organizationBranding.organizationId, organizationId))
      .returning({ id: organizationBranding.id });
    return result.length > 0;
  }

  /**
   * Executes operations within a transaction
   */
  async withTransaction<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(fn);
  }
}

// Singleton instance
let brandingRepository: BrandingRepository | null = null;

export function getBrandingRepository(): BrandingRepository {
  if (!brandingRepository) {
    brandingRepository = new BrandingRepository();
  }
  return brandingRepository;
}
