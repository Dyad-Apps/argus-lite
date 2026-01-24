/**
 * Request Context using AsyncLocalStorage
 *
 * Provides request-scoped storage for user identity, organization,
 * and other contextual data throughout the request lifecycle.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { type UserId, type OrganizationId } from '@argus/shared';

/** Request context data */
export interface RequestContext {
  /** Unique request identifier */
  requestId: string;

  /** Authenticated user ID (if authenticated) */
  userId?: UserId;

  /** User's email (if authenticated) */
  userEmail?: string;

  /** Current organization context */
  organizationId?: OrganizationId;

  /** Request start timestamp */
  startTime: number;

  /** IP address of the client */
  ipAddress?: string;

  /** User agent string */
  userAgent?: string;
}

/** AsyncLocalStorage instance for request context */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Gets the current request context.
 * Returns undefined if called outside of a request.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Gets the current request context.
 * Throws if called outside of a request.
 */
export function getRequestContextOrThrow(): RequestContext {
  const context = requestContextStorage.getStore();
  if (!context) {
    throw new Error('Request context not available');
  }
  return context;
}

/**
 * Gets the current user ID from context.
 * Returns undefined if not authenticated.
 */
export function getCurrentUserId(): UserId | undefined {
  return getRequestContext()?.userId;
}

/**
 * Gets the current user ID from context.
 * Throws if not authenticated.
 */
export function getCurrentUserIdOrThrow(): UserId {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
}

/**
 * Gets the current organization ID from context.
 * Returns undefined if no organization is set.
 */
export function getCurrentOrganizationId(): OrganizationId | undefined {
  return getRequestContext()?.organizationId;
}

/**
 * Gets the current organization ID from context.
 * Throws if no organization is set.
 */
export function getCurrentOrganizationIdOrThrow(): OrganizationId {
  const orgId = getCurrentOrganizationId();
  if (!orgId) {
    throw new Error('Organization context not set');
  }
  return orgId;
}

/**
 * Sets the organization context for the current request.
 */
export function setOrganizationContext(organizationId: OrganizationId): void {
  const context = getRequestContext();
  if (context) {
    context.organizationId = organizationId;
  }
}

/**
 * Runs a function within a request context.
 */
export function runWithContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Creates a new request context with initial values.
 */
export function createRequestContext(
  options: Partial<RequestContext> & { requestId: string }
): RequestContext {
  return {
    startTime: Date.now(),
    ...options,
  };
}

export { requestContextStorage };
