import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  numeric,
  customType,
} from 'drizzle-orm/pg-core';
import { assetStatusEnum } from './enums.js';
import { organizations } from './organizations.js';
import { assetTypes } from './asset-types.js';
import { users } from './users.js';

// PostGIS geometry type for geolocation
const geometry = customType<{ data: string; notNull?: boolean; default?: boolean }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

/**
 * Assets - Physical or logical assets being managed
 *
 * Central focus of the IoT platform. Assets can be nested (parent-child),
 * linked to multiple devices, and positioned in spaces. Each asset has
 * a type that determines its presentation and behavior.
 *
 * @see phase-7-iot-meta-model.md Section 5.3
 */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    assetTypeId: uuid('asset_type_id')
      .notNull()
      .references(() => assetTypes.id, { onDelete: 'restrict' }),

    // Hierarchical support
    parentAssetId: uuid('parent_asset_id').references((): any => assets.id, {
      onDelete: 'set null',
    }),

    // Identity
    name: text('name').notNull(),
    description: text('description'),
    serialNumber: text('serial_number'),
    model: text('model'),
    manufacturer: text('manufacturer'),

    // Status
    status: assetStatusEnum('status').notNull().default('active'),
    healthScore: numeric('health_score', { precision: 5, scale: 2 }),

    // Geospatial
    geolocation: geometry('geolocation'),
    lastLocationUpdate: timestamp('last_location_update', {
      withTimezone: true,
    }),

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
    index('idx_assets_org').on(table.organizationId),
    index('idx_assets_type').on(table.assetTypeId),
    index('idx_assets_parent').on(table.parentAssetId),
    index('idx_assets_status').on(table.status),
    index('idx_assets_serial').on(table.serialNumber),
    index('idx_assets_health').on(table.healthScore),
    index('idx_assets_deleted').on(table.deletedAt),
    // Note: GIN index for JSONB and GIST for geometry are created in migration
  ]
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
