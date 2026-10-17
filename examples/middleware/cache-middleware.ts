/**
 * Cache Middleware Example
 *
 * Implements request caching with short-circuiting.
 * Demonstrates how to return a value without calling next().

import type { Middleware } from '../../src/types/errors';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

export class CacheMiddleware {
  private cache = new Map<string, CacheEntry>();
  private ttl: number; // Time-to-live in milliseconds

  constructor(ttl: number = 60000) {
    this.ttl = ttl;
  }

  private getCacheKey(context: { method: string; path: string; body?: unknown }): string {
    return `${context.method}:${context.path}:${JSON.stringify(context.body)}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  middleware(): Middleware {
    return async (context, next) => {
      const cacheKey = this.getCacheKey(context);

      // Check cache - short-circuit if found and not expired
      const cached = this.cache.get(cacheKey);
      if (cached && !this.isExpired(cached)) {
        console.log(`Cache hit for ${cacheKey}`);
        return cached.data;
      }

      // Otherwise, proceed with request
      const response = await next();

      // Store in cache
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now(),
      });

      console.log(`Cache miss for ${cacheKey} - stored`);
      return response;
    };
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Usage example:
/*
import { DorisioClient } from 'dorisio-sdk';
import { CacheMiddleware } from './cache-middleware';

const client = new DorisioClient({
  baseUrl: 'https://api.dorisio.com',
  token: 'your-token',
});

const cacheMiddleware = new CacheMiddleware(60000); // 60 second TTL
client.use(cacheMiddleware.middleware());

// First call hits the API
await client.getCreator('creator-123');

// Second call returns cached result (no network request)
await client.getCreator('creator-123');

// Clear cache
cacheMiddleware.clear();
*/
