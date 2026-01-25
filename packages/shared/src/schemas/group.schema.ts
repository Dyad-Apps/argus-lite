/**
 * User Group schemas for validation
 */

import { z } from 'zod';

/** Create group request */
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

/** Update group request */
export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

/** Add member to group request */
export const addGroupMemberSchema = z.object({
  userId: z.string().uuid(),
});
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

/** Group member response */
export const groupMemberResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  addedAt: z.string().datetime(),
  addedBy: z.string().uuid().nullable(),
});
export type GroupMemberResponse = z.infer<typeof groupMemberResponseSchema>;

/** Group response */
export const groupResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string().uuid(),
  memberCount: z.number().int().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable(),
});
export type GroupResponse = z.infer<typeof groupResponseSchema>;

/** Group with members response */
export const groupWithMembersResponseSchema = groupResponseSchema.extend({
  members: z.array(groupMemberResponseSchema),
});
export type GroupWithMembersResponse = z.infer<typeof groupWithMembersResponseSchema>;

/** Group list response */
export const groupListResponseSchema = z.object({
  data: z.array(groupResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type GroupListResponse = z.infer<typeof groupListResponseSchema>;

/** Group member list response */
export const groupMemberListResponseSchema = z.object({
  data: z.array(groupMemberResponseSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});
export type GroupMemberListResponse = z.infer<typeof groupMemberListResponseSchema>;
