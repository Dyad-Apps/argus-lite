/**
 * Standardized error types and utilities for Argus IQ
 * Provides consistent error responses across the API
 */

import { z } from 'zod';

/** Standard error codes used across the API */
export const ErrorCode = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status code mapping for error codes */
export const errorCodeToStatus: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  DATABASE_ERROR: 500,
  CACHE_ERROR: 500,
};

/** Schema for validation error details */
export const validationErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ValidationErrorDetail = z.infer<typeof validationErrorDetailSchema>;

/** Schema for standardized API error response */
export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(validationErrorDetailSchema).optional(),
    requestId: z.string().optional(),
    timestamp: z.string(),
  }),
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

/** Custom application error class */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ValidationErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      details?: ValidationErrorDetail[];
      cause?: Error;
      isOperational?: boolean;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = errorCodeToStatus[code];
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;
    Error.captureStackTrace(this, this.constructor);
  }

  /** Convert to API error response format */
  toResponse(requestId?: string): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/** Factory functions for common errors */
export const Errors = {
  badRequest: (message: string, details?: ValidationErrorDetail[]) =>
    new AppError(ErrorCode.BAD_REQUEST, message, { details }),

  unauthorized: (message = 'Authentication required') =>
    new AppError(ErrorCode.UNAUTHORIZED, message),

  forbidden: (message = 'Access denied') =>
    new AppError(ErrorCode.FORBIDDEN, message),

  notFound: (resource: string, id?: string) =>
    new AppError(
      ErrorCode.NOT_FOUND,
      id ? `${resource} with ID '${id}' not found` : `${resource} not found`
    ),

  conflict: (message: string) =>
    new AppError(ErrorCode.CONFLICT, message),

  validationError: (details: ValidationErrorDetail[]) =>
    new AppError(ErrorCode.VALIDATION_ERROR, 'Validation failed', { details }),

  rateLimited: (message = 'Rate limit exceeded') =>
    new AppError(ErrorCode.RATE_LIMITED, message),

  internal: (message = 'An internal error occurred', cause?: Error) =>
    new AppError(ErrorCode.INTERNAL_ERROR, message, {
      cause,
      isOperational: false,
    }),

  serviceUnavailable: (service: string) =>
    new AppError(ErrorCode.SERVICE_UNAVAILABLE, `${service} is unavailable`),

  database: (message: string, cause?: Error) =>
    new AppError(ErrorCode.DATABASE_ERROR, message, {
      cause,
      isOperational: false,
    }),

  cache: (message: string, cause?: Error) =>
    new AppError(ErrorCode.CACHE_ERROR, message, {
      cause,
      isOperational: false,
    }),
};

/** Converts Zod errors to validation error details */
export function zodErrorToDetails(error: z.core.$ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Type guard for AppError */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
