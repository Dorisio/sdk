/**
 * Error Transformation Middleware Example
 *
 * Transforms API errors into user-friendly error messages.
 * Demonstrates error handling in the post-response phase.
 */

import type { Middleware } from '../../src/types/errors';
import { ApiError } from '../../src/types/errors';

// Custom user-facing error class
class UserFriendlyError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'UserFriendlyError';
  }
}

function mapErrorCodeToMessage(code: string | undefined): string {
  const messages: Record<string, string> = {
    'UNAUTHORIZED': 'Please log in to continue',
    'FORBIDDEN': 'You do not have permission to perform this action',
    'NOT_FOUND': 'The requested resource was not found',
    'RATE_LIMITED': 'Too many requests. Please try again later',
    'VALIDATION_ERROR': 'Please check your input and try again',
  };

  return messages[code || ''] || 'An unexpected error occurred';
}

export const errorTransformMiddleware: Middleware = async (context, next) => {
  try {
    // Try to execute the request
    return await next();
  } catch (error) {
    // Post-response phase: transform errors
    if (error instanceof ApiError) {
      // Transform API errors into user-friendly messages
      const userMessage = mapErrorCodeToMessage(error.code);
      throw new UserFriendlyError(userMessage, error);
    }

    // Re-throw other errors as-is
    throw error;
  }
};

// Usage example:
/*
import { DorisioClient } from 'dorisio-sdk';
import { errorTransformMiddleware } from './error-transformation-middleware';

const client = new DorisioClient({
  baseUrl: 'https://api.dorisio.com',
  token: 'your-token',
});

client.use(errorTransformMiddleware);

try {
  await client.getCreator('creator-123');
} catch (error) {
  if (error instanceof UserFriendlyError) {
    // Show user-friendly message
    alert(error.message);
  }
}
*/
