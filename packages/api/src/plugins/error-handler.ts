/**
 * Fastify error handler plugin
 * Provides consistent error responses across all endpoints
 */

import { FastifyInstance, FastifyError } from 'fastify';
import {
  AppError,
  ErrorCode,
  isAppError,
  zodErrorToDetails,
  type ApiErrorResponse,
} from '@argus/shared';
import { z } from 'zod';

export async function errorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const requestId = request.id;

    // Log the error
    if (isAppError(error) && error.isOperational) {
      request.log.warn({ err: error, requestId }, 'Operational error');
    } else {
      request.log.error({ err: error, requestId }, 'Unexpected error');
    }

    // Handle AppError
    if (isAppError(error)) {
      return reply.status(error.statusCode).send(error.toResponse(requestId));
    }

    // Handle Zod validation errors
    if (error.name === 'ZodError' || error.validation) {
      // Fastify-type-provider-zod transforms ZodError into FastifyError with validation property
      const zodError = error.cause as z.core.$ZodError | undefined;
      const details = zodError ? zodErrorToDetails(zodError) : undefined;

      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details,
          requestId,
          timestamp: new Date().toISOString(),
        },
      };
      return reply.status(422).send(response);
    }

    // Handle Fastify 404
    if (error.statusCode === 404) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: error.message || 'Resource not found',
          requestId,
          timestamp: new Date().toISOString(),
        },
      };
      return reply.status(404).send(response);
    }

    // Handle other known HTTP errors
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.BAD_REQUEST,
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
        },
      };
      return reply.status(error.statusCode).send(response);
    }

    // Generic internal error for unknown errors
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message:
          process.env.NODE_ENV === 'production'
            ? 'An internal error occurred'
            : error.message,
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
    return reply.status(500).send(response);
  });

  // Handle 404 for undefined routes
  app.setNotFoundHandler((request, reply) => {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    };
    return reply.status(404).send(response);
  });
}
