import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { personTypes } from './person-types.js';
import { users } from './users.js';

/**
 * Persons - People in the organization context
 *
 * Represents individuals who interact with the system. Every person
 * must have a corresponding user account (1:1 relationship).
 * Persons can be assigned activities and have organizational roles.
 *
 * @see phase-7-iot-meta-model.md Section 5.3
 */
export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    personTypeId: uuid('person_type_id')
      .notNull()
      .references(() => personTypes.id, { onDelete: 'restrict' }),

    // Link to user account (1:1 required)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Identity
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    title: text('title'),
    department: text('department'),

    // Custom attributes (JSONB for flexibility)
    customAttributes: jsonb('custom_attributes').notNull().default({}),

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
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_persons_org').on(table.organizationId),
    index('idx_persons_type').on(table.personTypeId),
    index('idx_persons_email').on(table.email),
    index('idx_persons_deleted').on(table.deletedAt),
    uniqueIndex('persons_user_unique').on(table.userId),
    // Note: GIN index for JSONB is created in migration
  ]
);

export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
