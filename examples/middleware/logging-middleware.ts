/**
 * Logging Middleware Example
 *
 * Logs request and response information with timing.
 * Demonstrates pre-request and post-response phases.
 */

import type { Middleware } from '../../src/types/errors';

export const loggingMiddleware: Middleware = async (context, next) => {
  const startTime = Date.now();

  // Pre-request phase: log outgoing request
  console.log(`→ ${context.method} ${context.path}`, {
    body: context.body,
    headers: context.headers,
    requestId: context.requestId,
  });

  try {
    // Call next middleware in the chain
    const response = await next();

    // Post-response phase: log successful response
    const duration = Date.now() - startTime;
    console.log(`← ${context.method} ${context.path} (${duration}ms)`, {
      response,
    });

    return response;
  } catch (error) {
    // Post-response phase: log error
    const duration = Date.now() - startTime;
    console.error(`✗ ${context.method} ${context.path} (${duration}ms)`, error);
    throw error;
  }
};

// Usage example:
/*
import { DorisioClient } from 'dorisio-sdk';
import { loggingMiddleware } from './logging-middleware';

const client = new DorisioClient({
  baseUrl: 'https://api.dorisio.com',
  token: 'your-token',
});

client.use(loggingMiddleware);

// All requests will now be logged
await client.getCreator('creator-123');
*/
