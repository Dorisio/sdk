/**
 * Auth Injection Middleware Example
 *
 * Automatically injects authentication headers into requests.
 * Demonstrates modifying the request context before the request is sent.
 */

import type { Middleware } from '../../src/types/errors';

function getAuthToken(): string {
  // In a real implementation, this might fetch from a store,
  // validate token expiry, or refresh if needed.
  return 'your-jwt-token';
}

export const authInjectionMiddleware: Middleware = (context, next) => {
  // Pre-request phase: ensure auth header is present
  if (!context.headers?.['Authorization']) {
    context.headers = {
      ...context.headers,
      'Authorization': `Bearer ${getAuthToken()}`,
    };
  }

  // Proceed with the request
  return next();
};

// Usage example:
/*
import { DorisioClient } from 'dorisio-sdk';
import { authInjectionMiddleware } from './auth-injection-middleware';

const client = new DorisioClient({
  baseUrl: 'https://api.dorisio.com',
  // No need to set token here - middleware handles it
});

client.use(authInjectionMiddleware);

// All requests will automatically have the auth header
await client.getCreator('creator-123');
*/
