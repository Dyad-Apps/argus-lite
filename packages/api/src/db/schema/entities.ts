import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import {
  baseTypeEnum,
  lifecycleStatusEnum,
  connectivityStatusEnum,
  activityStatusEnum,
} from './enums.js';
import { organizations } from './organizations.js';
import { typeDefinitions } from './type-definitions.js';

/**
 * Entities - Concrete instances of Type Definitions
 *
 * This is the main entity table in the meta-model. All entities
 * (Assets, Devices, Persons, Activities, Spaces) are stored here
 * with their base type fields and custom properties in JSONB.
 *
 * @see META_MODEL_SPECIFICATION.md Section 4
 */
export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    typeDefinitionId: uuid('type_definition_id').references(
      () => typeDefinitions.id,
      { onDelete: 'set null' }
    ),
    baseType: baseTypeEnum('base_type').notNull(),

    // Identity
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    serialNumber: varchar('serial_number', { length: 100 }),

    // === Asset fields ===
    lifecycleStatus: lifecycleStatusEnum('lifecycle_status'),
    healthScore: integer('health_score'),
    locationRef: uuid('location_ref'), // Reference to containing Space entity

    // === Device fields ===
    macAddress: varchar('mac_address', { length: 50 }),
    connectivityStatus: connectivityStatusEnum('connectivity_status'),
    firmwareVersion: varchar('firmware_version', { length: 50 }),
    lastSeen: timestamp('last_seen', { withTimezone: true }),

    // === Person fields ===
    identityId: varchar('identity_id', { length: 255 }), // External SSO ID
    workRole: varchar('work_role', { length: 100 }),
    proximityRef: uuid('proximity_ref'), // Current Space location
    shiftStatus: varchar('shift_status', { length: 50 }),

    // === Activity fields ===
    activityType: varchar('activity_type', { length: 100 }),
    startTimestamp: timestamp('start_timestamp', { withTimezone: true }),
    endTimestamp: timestamp('end_timestamp', { withTimezone: true }),
    ownerId: uuid('owner_id'), // Reference to Person entity
    targetEntityId: uuid('target_entity_id'), // What this activity is about
    activityStatus: activityStatusEnum('activity_status'),
    cost: doublePrecision('cost'),

    // === Space fields ===
    parentId: uuid('parent_id'), // Self-reference for hierarchy
    spaceType: varchar('space_type', { length: 50 }),
    boundaryCoordinates: jsonb('boundary_coordinates'), // GeoJSON
    environmentState: jsonb('environment_state'), // Ambient conditions

    // === Custom Properties (from TypeDefinition) ===
    properties: jsonb('properties').notNull().default({}),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by'),
  },
  (table) => [
    index('idx_entities_tenant').on(table.tenantId),
    index('idx_entities_type').on(table.typeDefinitionId),
    index('idx_entities_base').on(table.baseType),
    index('idx_entities_health').on(table.healthScore),
    index('idx_entities_location').on(table.locationRef),
    index('idx_entities_parent').on(table.parentId),
  ]
);

// Self-reference for Space hierarchy
// Note: This is handled by the parentId column above

// Infer types from schema
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
