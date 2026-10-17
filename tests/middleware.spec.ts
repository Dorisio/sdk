/**
 * Middleware execution order tests
 *
 * Verifies that middleware executes in the correct order:
 * - Pre-request phase: middleware executes in registration order (FIFO)
 * - Post-response phase: middleware executes in reverse order
 * - Short-circuiting works correctly
 * - Error handling propagates through the chain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DorisioClient } from '../src/client';
import type { Middleware } from '../src/types/errors';

describe('Middleware execution order', () => {
  let client: DorisioClient;

  beforeEach(() => {
    client = new DorisioClient({
      baseUrl: 'https://api.dorisio.com',
      mode: 'sandbox',
      token: 'test-token',
    });
  });

  it('executes middleware in registration order (pre-request phase)', async () => {
    const order: string[] = [];

    client.use(async (context, next) => {
      order.push('middleware-1-pre');
      const response = await next();
      order.push('middleware-1-post');
      return response;
    });

    client.use(async (context, next) => {
      order.push('middleware-2-pre');
      const response = await next();
      order.push('middleware-2-post');
      return response;
    });

    client.use(async (context, next) => {
      order.push('middleware-3-pre');
      const response = await next();
      order.push('middleware-3-post');
      return response;
    });

    // Make a request
    await client.getCreator('creator-123');

    // Verify execution order
    expect(order).toEqual([
      'middleware-1-pre',
      'middleware-2-pre',
      'middleware-3-pre',
      'middleware-3-post',
      'middleware-2-post',
      'middleware-1-post',
    ]);
  });

  it('executes middleware in reverse order during post-response phase', async () => {
    const order: string[] = [];

    client.use(async (context, next) => {
      order.push('first-pre');
      const response = await next();
      order.push('first-post');
      return response;
    });

    client.use(async (context, next) => {
      order.push('second-pre');
      const response = await next();
      order.push('second-post');
      return response;
    });

    client.use(async (context, next) => {
      order.push('third-pre');
      const response = await next();
      order.push('third-post');
      return response;
    });

    await client.getCreator('creator-123');

    // Pre-request should be FIFO, post-response should be LIFO
    expect(order.slice(0, 3)).toEqual(['first-pre', 'second-pre', 'third-pre']);
    expect(order.slice(3)).toEqual(['third-post', 'second-post', 'first-post']);
  });

  it('allows middleware to short-circuit by returning without calling next', async () => {
    const order: string[] = [];

    client.use(async (context, next) => {
      order.push('middleware-1-pre');
      const response = await next();
      order.push('middleware-1-post');
      return response;
    });

    client.use(async (context, next) => {
      order.push('middleware-2-pre');
      // Short-circuit: return without calling next()
      return { shortCircuited: true };
    });

    client.use(async (context, next) => {
      order.push('middleware-3-pre');
      const response = await next();
      order.push('middleware-3-post');
      return response;
    });

    const result = await client.getCreator('creator-123');

    // Middleware 3 should not execute (short-circuited by middleware 2)
    expect(order).toEqual(['middleware-1-pre', 'middleware-2-pre', 'middleware-1-post']);
    expect(result).toEqual({ shortCircuited: true });
  });

  it('passes context through middleware chain', async () => {
    const contexts: Array<{ method: string; path: string }> = [];

    client.use(async (context, next) => {
      contexts.push({ method: context.method, path: context.path });
      return next();
    });

    client.use(async (context, next) => {
      contexts.push({ method: context.method, path: context.path });
      return next();
    });

    client.use(async (context, next) => {
      contexts.push({ method: context.method, path: context.path });
      return next();
    });

    await client.getCreator('creator-123');

    // All middleware should receive the same context
    expect(contexts).toHaveLength(3);
    contexts.forEach((ctx) => {
      expect(ctx.method).toBe('GET');
      expect(ctx.path).toContain('creator');
    });
  });

  it('handles errors that occur in middleware', async () => {
    const order: string[] = [];

    client.use(async (context, next) => {
      order.push('middleware-1-pre');
      try {
        const response = await next();
        order.push('middleware-1-post');
        return response;
      } catch (error) {
        order.push('middleware-1-error');
        throw error;
      }
    });

    client.use(async (context, next) => {
      order.push('middleware-2-pre');
      throw new Error('Middleware error');
    });

    client.use(async (context, next) => {
      order.push('middleware-3-pre');
      return next();
    });

    await expect(client.getCreator('creator-123')).rejects.toThrow('Middleware error');

    // Middleware 3 should not execute (error thrown in middleware 2)
    expect(order).toEqual(['middleware-1-pre', 'middleware-2-pre', 'middleware-1-error']);
  });

  it('allows middleware to transform the response', async () => {
    client.use(async (context, next) => {
      const response = await next();
      // Add a custom field to the response
      return { ...response, customField: 'added-by-middleware' };
    });

    const result = await client.getCreator('creator-123');

    expect(result).toHaveProperty('customField', 'added-by-middleware');
  });

  it('executes middleware for all client methods', async () => {
    const order: string[] = [];

    client.use(async (context, next) => {
      order.push(`${context.method}:${context.path}`);
      return next();
    });

    // Test different methods
    await client.getCreator('creator-123');
    await client.getWallets('user-123');

    expect(order).toHaveLength(2);
    expect(order[0]).toContain('GET');
    expect(order[1]).toContain('GET');
  });

  it('executes async middleware sequentially', async () => {
    const order: string[] = [];

    client.use(async (context, next) => {
      order.push('middleware-1-start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const response = await next();
      order.push('middleware-1-end');
      return response;
    });

    client.use(async (context, next) => {
      order.push('middleware-2-start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const response = await next();
      order.push('middleware-2-end');
      return response;
    });

    client.use(async (context, next) => {
      order.push('middleware-3-start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const response = await next();
      order.push('middleware-3-end');
      return response;
    });

    await client.getCreator('creator-123');

    // Each middleware should complete before the next starts
    expect(order).toEqual([
      'middleware-1-start',
      'middleware-2-start',
      'middleware-3-start',
      'middleware-3-end',
      'middleware-2-end',
      'middleware-1-end',
    ]);
  });

  it('executes middleware in correct order across multiple requests', async () => {
    const order: string[] = [];

    client.use(async (context, next) => {
      order.push('middleware-1');
      return next();
    });

    client.use(async (context, next) => {
      order.push('middleware-2');
      return next();
    });

    client.use(async (context, next) => {
      order.push('middleware-3');
      return next();
    });

    // Make multiple requests
    await client.getCreator('creator-123');
    await client.getCreator('creator-456');
    await client.getCreator('creator-789');

    // Order should be maintained across all requests
    expect(order).toEqual([
      'middleware-1',
      'middleware-2',
      'middleware-3',
      'middleware-1',
      'middleware-2',
      'middleware-3',
      'middleware-1',
      'middleware-2',
      'middleware-3',
    ]);
  });
});
