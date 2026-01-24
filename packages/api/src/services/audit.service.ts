/**
 * Audit Logging Service
 *
 * Provides centralized audit logging for security and compliance.
 * Records authentication events, authorization decisions, and data changes.
 */

import { db } from '../db/index.js';
import { auditLogs, type NewAuditLog } from '../db/schema/index.js';
import {
  getRequestContext,
  type RequestContext,
} from '../context/request-context.js';
import type { UserId, OrganizationId } from '@argus/shared';

/** Audit event categories */
export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'user_management'
  | 'organization_management'
  | 'data_access'
  | 'data_modification'
  | 'system';

/** Audit event outcome */
export type AuditOutcome = 'success' | 'failure' | 'error';

/** Audit log entry data */
export interface AuditEntry {
  category: AuditCategory;
  action: string;
  userId?: UserId;
  userEmail?: string;
  organizationId?: OrganizationId;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  outcome?: AuditOutcome;
}

/**
 * Audit logging service
 */
class AuditService {
  /**
   * Logs an audit event
   */
  async log(entry: AuditEntry): Promise<void> {
    const context = getRequestContext();

    const record: NewAuditLog = {
      category: entry.category,
      action: entry.action,
      userId: entry.userId ?? context?.userId ?? null,
      userEmail: entry.userEmail ?? context?.userEmail ?? null,
      organizationId: entry.organizationId ?? context?.organizationId ?? null,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      details: entry.details ?? null,
      outcome: entry.outcome ?? 'success',
      requestId: context?.requestId ?? null,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    };

    try {
      await db.insert(auditLogs).values(record);
    } catch (error) {
      // Don't let audit failures break the application
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Logs an authentication event
   */
  async logAuth(
    action: string,
    options: {
      userId?: UserId;
      userEmail?: string;
      outcome?: AuditOutcome;
      details?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    await this.log({
      category: 'authentication',
      action,
      ...options,
    });
  }

  /**
   * Logs a login attempt
   */
  async logLogin(
    email: string,
    userId: UserId | undefined,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logAuth('login', {
      userId,
      userEmail: email,
      outcome: success ? 'success' : 'failure',
      details: {
        ...details,
        attemptedEmail: email,
      },
    });
  }

  /**
   * Logs a logout event
   */
  async logLogout(userId: UserId, all: boolean = false): Promise<void> {
    await this.logAuth(all ? 'logout_all' : 'logout', {
      userId,
      outcome: 'success',
    });
  }

  /**
   * Logs a password reset request
   */
  async logPasswordResetRequest(email: string): Promise<void> {
    await this.logAuth('password_reset_request', {
      userEmail: email,
      outcome: 'success',
    });
  }

  /**
   * Logs a password reset completion
   */
  async logPasswordReset(userId: UserId): Promise<void> {
    await this.logAuth('password_reset', {
      userId,
      outcome: 'success',
    });
  }

  /**
   * Logs a user management event
   */
  async logUserManagement(
    action: string,
    targetUserId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'user_management',
      action,
      resourceType: 'user',
      resourceId: targetUserId,
      details,
    });
  }

  /**
   * Logs an organization management event
   */
  async logOrgManagement(
    action: string,
    organizationId: OrganizationId,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'organization_management',
      action,
      organizationId,
      resourceType: 'organization',
      resourceId: organizationId,
      details,
    });
  }

  /**
   * Logs a data access event
   */
  async logDataAccess(
    resourceType: string,
    resourceId: string,
    action: string = 'read',
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'data_access',
      action,
      resourceType,
      resourceId,
      details,
    });
  }

  /**
   * Logs a data modification event
   */
  async logDataChange(
    resourceType: string,
    resourceId: string,
    action: 'create' | 'update' | 'delete',
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'data_modification',
      action,
      resourceType,
      resourceId,
      details,
    });
  }
}

// Singleton instance
export const auditService = new AuditService();
