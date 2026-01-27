import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  numeric,
  boolean,
  customType,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { spaceTypes } from './space-types.js';
import { users } from './users.js';

// PostGIS geometry types
const point = customType<{ data: string; notNull?: boolean; default?: boolean }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

const polygon = customType<{ data: string; notNull?: boolean; default?: boolean }>({
  dataType() {
    return 'geometry(Polygon, 4326)';
  },
});

/**
 * Spaces - Physical or logical locations
 *
 * Represents hierarchical spaces (building -> floor -> room -> zone).
 * Spaces can contain assets and other spaces. Supports geospatial
 * features including point locations and polygon geofences.
 *
 * Access to a space grants access to all assets within it (hierarchical
 * permission inheritance).
 *
 * @see phase-7-iot-meta-model.md Section 5.3
 */
export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    spaceTypeId: uuid('space_type_id')
      .notNull()
      .references(() => spaceTypes.id, { onDelete: 'restrict' }),

    // Hierarchical support
    parentSpaceId: uuid('parent_space_id').references((): any => spaces.id, {
      onDelete: 'cascade',
    }),

    // Identity
    name: text('name').notNull(),
    description: text('description'),
    spaceCode: text('space_code'), // e.g., "BLD1-F3-R301"

    // Physical properties
    floorLevel: integer('floor_level'),
    areaSqm: numeric('area_sqm', { precision: 10, scale: 2 }),
    capacity: integer('capacity'),

    // Geospatial
    geolocation: point('geolocation'), // Center point
    geofence: polygon('geofence'), // Boundary polygon

    // Status
    isActive: boolean('is_active').default(true),

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
    index('idx_spaces_org').on(table.organizationId),
    index('idx_spaces_type').on(table.spaceTypeId),
    index('idx_spaces_parent').on(table.parentSpaceId),
    index('idx_spaces_code').on(table.spaceCode),
    index('idx_spaces_floor').on(table.floorLevel),
    index('idx_spaces_deleted').on(table.deletedAt),
    // Note: GIN index for JSONB and GIST for geometry are created in migration
  ]
);

export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
