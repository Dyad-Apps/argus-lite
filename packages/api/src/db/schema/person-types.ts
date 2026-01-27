import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';

/**
 * Person Types - Type definitions for persons
 *
 * Defines the types/categories of persons (e.g., Operator, Technician, Manager).
 * Supports hierarchical type inheritance.
 *
 * @see phase-7-iot-meta-model.md Section 5.2
 */
export const personTypes = pgTable(
  'person_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    category: text('category'),

    // Schema definitions
    attributeSchema: jsonb('attribute_schema'),
    telemetrySchema: jsonb('telemetry_schema'),
    presentationConfig: jsonb('presentation_config'),

    // Hierarchical support
    parentTypeId: uuid('parent_type_id').references((): any => personTypes.id, {
      onDelete: 'set null',
    }),

    isSystem: boolean('is_system').default(false),

    // Metadata
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_person_types_org').on(table.organizationId),
    index('idx_person_types_parent').on(table.parentTypeId),
    index('idx_person_types_category').on(table.category),
    uniqueIndex('person_types_org_name_unique').on(
      table.organizationId,
      table.name
    ),
  ]
);

export type PersonType = typeof personTypes.$inferSelect;
export type NewPersonType = typeof personTypes.$inferInsert;
