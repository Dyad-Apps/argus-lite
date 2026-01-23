import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { baseTypeEnum, relationshipTypeEnum } from './enums.js';
import { organizations } from './organizations.js';
import { entities } from './entities.js';

/**
 * Entity Edges - Typed relationships between entities
 *
 * Relationships are typed edges connecting entities in a graph model.
 * This enables powerful graph traversals and relationship-based queries.
 *
 * @see META_MODEL_SPECIFICATION.md Section 5
 */
export const entityEdges = pgTable(
  'entity_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Source entity
    sourceEntityId: uuid('source_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    sourceEntityType: baseTypeEnum('source_entity_type').notNull(),

    // Target entity
    targetEntityId: uuid('target_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetEntityType: baseTypeEnum('target_entity_type').notNull(),

    // Relationship
    relationshipType: relationshipTypeEnum('relationship_type').notNull(),

    // Metadata - varies by relationship type
    // For RESPONSIBLE_FOR: { permissionLevel, permissions, scope }
    // For FED_BY: { capacity, unit }
    // For BACKUP_FOR: { priority }
    metadata: jsonb('metadata'),

    // Temporal validity
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_edges_tenant').on(table.tenantId),
    index('idx_edges_source').on(table.sourceEntityId),
    index('idx_edges_target').on(table.targetEntityId),
    index('idx_edges_type').on(table.relationshipType),
    // Composite index for efficient relationship queries
    index('idx_edges_source_type').on(
      table.sourceEntityId,
      table.relationshipType
    ),
    index('idx_edges_target_type').on(
      table.targetEntityId,
      table.relationshipType
    ),
  ]
);

// Infer types from schema
export type EntityEdge = typeof entityEdges.$inferSelect;
export type NewEntityEdge = typeof entityEdges.$inferInsert;
