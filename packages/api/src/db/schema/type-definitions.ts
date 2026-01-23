import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { baseTypeEnum } from './enums.js';
import { organizations, projects } from './organizations.js';

/**
 * Type Definitions Registry
 *
 * When a user (or AI) defines a new entity type, the system creates a
 * Type Definition entry in the registry. This is NOT a database table
 * per type, but a metadata entry that maps to the base type.
 *
 * @see META_MODEL_SPECIFICATION.md Section 3
 */
export const typeDefinitions = pgTable(
  'type_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),

    // Identity
    name: varchar('name', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),

    // Inheritance - must be one of the five base types
    inheritsFrom: baseTypeEnum('inherits_from').notNull(),

    // Property Schema - defines custom properties for entities of this type
    // Array of PropertyMapping objects
    propertyMappings: jsonb('property_mappings').notNull().default([]),

    // Semantic Classification
    semanticTags: text('semantic_tags').array().default([]),
    industryVertical: varchar('industry_vertical', { length: 100 }),

    // UI Hints
    defaultIcon: varchar('default_icon', { length: 50 }),
    defaultColor: varchar('default_color', { length: 20 }),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_type_def_tenant').on(table.tenantId),
    index('idx_type_def_base').on(table.inheritsFrom),
    unique('uq_type_def_tenant_name').on(table.tenantId, table.name),
  ]
);

/**
 * Role Definitions for RBAC tied to entity relationships.
 *
 * @see META_MODEL_SPECIFICATION.md Section 5.5
 */
export const roleDefinitions = pgTable(
  'role_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    roleName: varchar('role_name', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),

    // Default permission level when RESPONSIBLE_FOR edge is created
    defaultPermissionLevel: varchar('default_permission_level', { length: 50 })
      .notNull()
      .default('view'),

    // Specific default permissions
    defaultPermissions: jsonb('default_permissions').notNull().default({}),

    // Asset type restrictions - which types this role can be responsible for
    allowedAssetTypes: uuid('allowed_asset_types').array(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_role_def_tenant_name').on(table.tenantId, table.roleName),
  ]
);

// Infer types from schema
export type TypeDefinition = typeof typeDefinitions.$inferSelect;
export type NewTypeDefinition = typeof typeDefinitions.$inferInsert;
export type RoleDefinition = typeof roleDefinitions.$inferSelect;
export type NewRoleDefinition = typeof roleDefinitions.$inferInsert;
