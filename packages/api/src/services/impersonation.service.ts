/**
 * Impersonation Service
 *
 * Handles admin/support user impersonation of other users.
 * Provides secure session management and audit logging.
 */

import { getImpersonationRepository } from '../repositories/index.js';
import { getUserRepository, getUserOrganizationRepository, getRoleRepository } from '../repositories/index.js';
import { auditService } from './audit.service.js';
import { signAccessToken } from '../utils/index.js';
import type { UserId, OrganizationId } from '@argus/shared';

// Default impersonation session duration: 1 hour
const DEFAULT_SESSION_DURATION_MS = 60 * 60 * 1000;

export interface StartImpersonationOptions {
  impersonatorId: UserId;
  targetUserId: UserId;
  organizationId?: OrganizationId;
  reason: string;
  durationMs?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ImpersonationResult {
  sessionId: string;
  accessToken: string;
  expiresAt: Date;
  targetUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface ImpersonationStatus {
  isImpersonating: boolean;
  sessionId?: string;
  impersonator?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  target?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  startedAt?: Date;
  expiresAt?: Date;
  reason?: string;
}

/**
 * Impersonation Service class
 */
class ImpersonationService {
  /**
   * Checks if a user can impersonate others
   * Only Super Admins can impersonate
   */
  async canImpersonate(userId: UserId): Promise<boolean> {
    const memberRepo = getUserOrganizationRepository();
    return memberRepo.isSuperAdmin(userId);
  }

  /**
   * Checks if a target user can be impersonated
   * Cannot impersonate other Super Admins
   */
  async canBeImpersonated(targetUserId: UserId): Promise<boolean> {
    const memberRepo = getUserOrganizationRepository();
    const isSuperAdmin = await memberRepo.isSuperAdmin(targetUserId);
    return !isSuperAdmin;
  }

  /**
   * Starts an impersonation session
   */
  async startImpersonation(options: StartImpersonationOptions): Promise<ImpersonationResult> {
    const impersonationRepo = getImpersonationRepository();
    const userRepo = getUserRepository();

    // Verify impersonator can impersonate
    const canImpersonate = await this.canImpersonate(options.impersonatorId);
    if (!canImpersonate) {
      throw new Error('You do not have permission to impersonate users');
    }

    // Verify target user exists
    const targetUser = await userRepo.findById(options.targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Verify target can be impersonated
    const canBeImpersonated = await this.canBeImpersonated(options.targetUserId);
    if (!canBeImpersonated) {
      throw new Error('Cannot impersonate Super Admin users');
    }

    // Check if impersonator already has an active session
    const existingSession = await impersonationRepo.findActiveSession(options.impersonatorId);
    if (existingSession) {
      throw new Error('You already have an active impersonation session. End it first.');
    }

    // Calculate expiration
    const durationMs = options.durationMs ?? DEFAULT_SESSION_DURATION_MS;
    const expiresAt = new Date(Date.now() + durationMs);

    // Create the session
    const session = await impersonationRepo.create({
      impersonatorId: options.impersonatorId,
      targetUserId: options.targetUserId,
      organizationId: options.organizationId ?? null,
      reason: options.reason,
      status: 'active',
      expiresAt,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
    });

    // Generate an access token for the target user (with impersonation flag)
    // The token payload includes impersonation metadata
    const accessToken = signAccessToken(
      targetUser.id as UserId,
      targetUser.email,
      {
        isImpersonation: true,
        impersonatorId: options.impersonatorId as string,
        sessionId: session.id,
      }
    );

    // Audit log
    await auditService.log({
      category: 'authentication',
      action: 'impersonation_started',
      userId: options.impersonatorId,
      resourceType: 'user',
      resourceId: options.targetUserId,
      organizationId: options.organizationId,
      outcome: 'success',
      details: {
        targetUserId: options.targetUserId,
        targetEmail: targetUser.email,
        reason: options.reason,
        sessionId: session.id,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      sessionId: session.id,
      accessToken,
      expiresAt,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
      },
    };
  }

  /**
   * Ends an impersonation session
   */
  async endImpersonation(impersonatorId: UserId, sessionId?: string): Promise<void> {
    const impersonationRepo = getImpersonationRepository();

    let session;
    if (sessionId) {
      session = await impersonationRepo.findById(sessionId);
      if (!session) {
        throw new Error('Impersonation session not found');
      }
      // Allow ending if user is the impersonator OR the session matches
      if (session.impersonatorId !== impersonatorId && session.impersonatorId !== (impersonatorId as string)) {
        throw new Error('Impersonation session not found');
      }
    } else {
      session = await impersonationRepo.findActiveSession(impersonatorId);
      if (!session) {
        throw new Error('No active impersonation session');
      }
    }

    // Log for debugging
    console.log('End impersonation - session:', {
      id: session.id,
      status: session.status,
      impersonatorId: session.impersonatorId,
      requestUserId: impersonatorId,
    });

    if (session.status !== 'active') {
      throw new Error(`Session is not active (status: ${session.status})`);
    }

    await impersonationRepo.endSession(session.id, 'ended');

    // Audit log
    await auditService.log({
      category: 'authentication',
      action: 'impersonation_ended',
      userId: impersonatorId,
      resourceType: 'user',
      resourceId: session.targetUserId,
      organizationId: session.organizationId as OrganizationId | undefined,
      outcome: 'success',
      details: {
        sessionId: session.id,
        duration: Date.now() - session.startedAt.getTime(),
      },
    });
  }

  /**
   * Gets the active impersonation status for a user
   */
  async getActiveStatus(impersonatorId: UserId): Promise<ImpersonationStatus> {
    const impersonationRepo = getImpersonationRepository();
    const userRepo = getUserRepository();

    const session = await impersonationRepo.findActiveSession(impersonatorId);
    if (!session) {
      return { isImpersonating: false };
    }

    // Get user details
    const impersonator = await userRepo.findById(impersonatorId);
    const target = await userRepo.findById(session.targetUserId as UserId);

    return {
      isImpersonating: true,
      sessionId: session.id,
      impersonator: impersonator ? {
        id: impersonator.id,
        email: impersonator.email,
        firstName: impersonator.firstName,
        lastName: impersonator.lastName,
      } : undefined,
      target: target ? {
        id: target.id,
        email: target.email,
        firstName: target.firstName,
        lastName: target.lastName,
      } : undefined,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      reason: session.reason,
    };
  }

  /**
   * Gets impersonation history for an admin user
   */
  async getHistory(
    impersonatorId: UserId,
    options?: { page?: number; pageSize?: number }
  ) {
    const impersonationRepo = getImpersonationRepository();
    return impersonationRepo.findByUser(impersonatorId, options);
  }

  /**
   * Gets all active impersonation sessions (for admin dashboard)
   */
  async getActiveSessions(options?: { page?: number; pageSize?: number }) {
    const impersonationRepo = getImpersonationRepository();
    return impersonationRepo.findAllActive(options);
  }

  /**
   * Revokes an impersonation session (admin action)
   */
  async revokeSession(sessionId: string, revokerId: UserId): Promise<void> {
    const impersonationRepo = getImpersonationRepository();

    const session = await impersonationRepo.findById(sessionId);
    if (!session) {
      throw new Error('Impersonation session not found');
    }

    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    await impersonationRepo.endSession(sessionId, 'revoked');

    // Audit log
    await auditService.log({
      category: 'authentication',
      action: 'impersonation_revoked',
      userId: revokerId,
      resourceType: 'impersonation_session',
      resourceId: sessionId,
      outcome: 'success',
      details: {
        originalImpersonator: session.impersonatorId,
        targetUserId: session.targetUserId,
      },
    });
  }

  /**
   * Cleans up expired sessions
   * Should be called periodically (e.g., by a cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const impersonationRepo = getImpersonationRepository();
    return impersonationRepo.expireOldSessions();
  }
}

// Singleton instance
export const impersonationService = new ImpersonationService();
