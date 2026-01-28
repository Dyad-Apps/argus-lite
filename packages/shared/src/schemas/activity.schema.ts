/**
 * Activity schemas for validation
 */

import { z } from 'zod';

/** Activity status enum */
export const activityStatusSchema = z.enum([
  'pending',
  'pending_approval',
  'approved',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'failed',
]);
export type ActivityStatusEnum = z.infer<typeof activityStatusSchema>;

/** Activity priority enum */
export const activityPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type ActivityPriority = z.infer<typeof activityPrioritySchema>;

/** Initiator type enum */
export const initiatorTypeSchema = z.enum(['person', 'system', 'rule', 'alarm']);
export type InitiatorType = z.infer<typeof initiatorTypeSchema>;

/** Target type enum */
export const targetTypeSchema = z.enum(['asset', 'device', 'space', 'person', 'organization']);
export type TargetType = z.infer<typeof targetTypeSchema>;

/** Approval status enum */
export const approvalStatusSchema = z.enum(['pending_approval', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

/** Activity name validation */
export const activityNameSchema = z
  .string()
  .min(1, 'Activity name is required')
  .max(255, 'Activity name must be at most 255 characters')
  .trim();

/** Create activity request */
export const createActivitySchema = z.object({
  activityTypeId: z.string().uuid('Invalid activity type ID'),
  parentActivityId: z.string().uuid('Invalid parent activity ID').optional(),
  name: activityNameSchema,
  description: z.string().max(1000).optional(),
  status: activityStatusSchema.default('pending'),
  priority: activityPrioritySchema.default('medium'),
  initiatorType: initiatorTypeSchema,
  initiatorUserId: z.string().uuid('Invalid initiator user ID').optional(),
  targetType: targetTypeSchema,
  targetId: z.string().uuid('Invalid target ID'),
  assignedToUserId: z.string().uuid('Invalid assigned user ID').optional(),
  assignedToRole: z.string().max(255).optional(),
  dueAt: z.string().datetime().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  requiresApproval: z.boolean().default(false),
  customAttributes: z.record(z.string(), z.unknown()).default({}),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

/** Update activity request */
export const updateActivitySchema = z.object({
  activityTypeId: z.string().uuid().optional(),
  parentActivityId: z.string().uuid().nullable().optional(),
  name: activityNameSchema.optional(),
  description: z.string().max(1000).optional(),
  status: activityStatusSchema.optional(),
  priority: activityPrioritySchema.optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  assignedToRole: z.string().max(255).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  scheduledStart: z.string().datetime().nullable().optional(),
  scheduledEnd: z.string().datetime().nullable().optional(),
  completionNotes: z.string().optional(),
  checklistResults: z.record(z.string(), z.unknown()).optional(),
  customAttributes: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

/** Approve/reject activity request */
export const approveActivitySchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(1000).optional(),
});
export type ApproveActivityInput = z.infer<typeof approveActivitySchema>;

/** Activity response */
export const activityResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  activityTypeId: z.string().uuid(),
  parentActivityId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  status: activityStatusSchema,
  priority: activityPrioritySchema,
  initiatorType: initiatorTypeSchema,
  initiatorUserId: z.string().uuid().nullable(),
  targetType: targetTypeSchema,
  targetId: z.string().uuid(),
  assignedToUserId: z.string().uuid().nullable(),
  assignedToRole: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  scheduledStart: z.string().datetime().nullable(),
  scheduledEnd: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  requiresApproval: z.boolean(),
  approvalStatus: approvalStatusSchema.nullable(),
  approvedByUserId: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  completionNotes: z.string().nullable(),
  checklistResults: z.record(z.string(), z.unknown()).nullable(),
  ownerOrganizationId: z.string().uuid(),
  assigneeOrganizationId: z.string().uuid().nullable(),
  customAttributes: z.record(z.string(), z.unknown()),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ActivityResponse = z.infer<typeof activityResponseSchema>;

/** Activity list response */
export const activityListResponseSchema = z.object({
  data: z.array(activityResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type ActivityListResponse = z.infer<typeof activityListResponseSchema>;

/** Activity query parameters */
export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: activityStatusSchema.optional(),
  priority: activityPrioritySchema.optional(),
  activityTypeId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  initiatorUserId: z.string().uuid().optional(),
  targetType: targetTypeSchema.optional(),
  targetId: z.string().uuid().optional(),
  pendingApproval: z.coerce.boolean().default(false),
  search: z.string().max(255).optional(),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
