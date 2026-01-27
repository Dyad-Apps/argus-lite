import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import {
  activityStatusEnumPhase7,
  activityPriorityEnum,
} from './enums.js';
import { organizations } from './organizations.js';
import { activityTypes } from './activity-types.js';
import { users } from './users.js';

/**
 * Activities - Work items, tasks, and workflows
 *
 * Represents all activities in the system using a 4-category model:
 * - system_to_system: Automated actions (sensor -> pump control)
 * - system_to_person: Alerts, notifications, maintenance requests
 * - person_to_system: Manual control, configuration changes
 * - person_to_person: Task assignments, approvals, handoffs
 *
 * Supports hierarchical activities (parent-child), cross-organization
 * assignment, and approval workflows.
 *
 * @see phase-7-iot-meta-model.md Section 5.3 & 7.2
 */
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    activityTypeId: uuid('activity_type_id')
      .notNull()
      .references(() => activityTypes.id, { onDelete: 'restrict' }),

    // Hierarchical support
    parentActivityId: uuid('parent_activity_id').references(
      (): any => activities.id,
      { onDelete: 'cascade' }
    ),

    // Identity
    name: text('name').notNull(),
    description: text('description'),

    // Status and priority
    status: activityStatusEnumPhase7('status').notNull().default('pending'),
    priority: activityPriorityEnum('priority').notNull().default('medium'),

    // WHO/WHAT initiated this activity
    initiatorType: text('initiator_type').notNull(), // person | system | rule | alarm
    initiatorUserId: uuid('initiator_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    // WHAT is this activity about (the target)
    targetType: text('target_type').notNull(), // asset | device | space | person | organization
    targetId: uuid('target_id').notNull(),

    // WHO should do it
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    assignedToRole: text('assigned_to_role'),

    // Timing
    dueAt: timestamp('due_at', { withTimezone: true }),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Approval workflow
    requiresApproval: boolean('requires_approval').default(false),
    approvalStatus: text('approval_status'), // pending_approval | approved | rejected
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    // Completion tracking
    completionNotes: text('completion_notes'),
    checklistResults: jsonb('checklist_results'),

    // Cross-organization support (for service providers)
    ownerOrganizationId: uuid('owner_organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    assigneeOrganizationId: uuid('assignee_organization_id').references(
      () => organizations.id,
      { onDelete: 'set null' }
    ),

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
    index('idx_activities_org').on(table.organizationId),
    index('idx_activities_type').on(table.activityTypeId),
    index('idx_activities_parent').on(table.parentActivityId),
    index('idx_activities_status').on(table.status),
    index('idx_activities_priority').on(table.priority),
    index('idx_activities_initiator').on(table.initiatorUserId),
    index('idx_activities_assigned').on(table.assignedToUserId),
    index('idx_activities_target').on(table.targetType, table.targetId),
    index('idx_activities_due').on(table.dueAt),
    index('idx_activities_owner_org').on(table.ownerOrganizationId),
    index('idx_activities_assignee_org').on(table.assigneeOrganizationId),
    index('idx_activities_deleted').on(table.deletedAt),
    // Note: GIN index for JSONB is created in migration
  ]
);

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
