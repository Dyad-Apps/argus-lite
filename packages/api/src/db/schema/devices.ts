import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  varchar,
  inet,
  macaddr,
  customType,
} from 'drizzle-orm/pg-core';
import { deviceStatusEnum } from './enums.js';
import { organizations } from './organizations.js';
import { deviceTypes } from './device-types.js';
import { users } from './users.js';

// PostGIS geometry type for geolocation
const geometry = customType<{ data: string; notNull?: boolean; default?: boolean }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

/**
 * Devices - Physical or virtual devices that generate telemetry
 *
 * Represents IoT devices, sensors, actuators, gateways, and other
 * connected equipment. Devices can be linked to assets and spaces.
 *
 * @see phase-7-iot-meta-model.md Section 5.3
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceTypeId: uuid('device_type_id')
      .notNull()
      .references(() => deviceTypes.id, { onDelete: 'restrict' }),

    // Identity
    name: text('name').notNull(),
    description: text('description'),
    serialNumber: text('serial_number'),
    model: text('model'),
    manufacturer: text('manufacturer'),
    firmwareVersion: text('firmware_version'),

    // Status
    status: deviceStatusEnum('status').notNull().default('inactive'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

    // IoT Device Hierarchy & Role
    deviceRole: text('device_role').notNull().default('endpoint'),
    parentDeviceId: uuid('parent_device_id').references((): any => devices.id, {
      onDelete: 'set null',
    }),
    logicalIdentifier: text('logical_identifier'),

    // Network
    ipAddress: inet('ip_address'),
    macAddress: macaddr('mac_address'),
    networkMetadata: jsonb('network_metadata').notNull().default({}),

    // Protocol
    protocol: text('protocol').notNull().default('mqtt'),

    // Geospatial
    geolocation: geometry('geolocation'),

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
    index('idx_devices_org').on(table.organizationId),
    index('idx_devices_type').on(table.deviceTypeId),
    index('idx_devices_status').on(table.status),
    index('idx_devices_serial').on(table.serialNumber),
    index('idx_devices_mac').on(table.macAddress),
    index('idx_devices_last_seen').on(table.lastSeenAt),
    index('idx_devices_deleted').on(table.deletedAt),
    index('idx_devices_parent').on(table.parentDeviceId),
    index('idx_devices_role').on(table.deviceRole),
    index('idx_devices_protocol').on(table.protocol),
    // Note: GIN index for JSONB and GIST for geometry are created in migration
  ]
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
