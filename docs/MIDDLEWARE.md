# Middleware

Middleware provides a powerful way to transform requests and responses at the client level. Unlike interceptors (which operate at the HTTP client level), middleware wraps the entire request/response cycle and can short-circuit requests entirely.

## Overview

Middleware is registered on the `DorisioClient` using the `use()` method and executes in a chain pattern, where each middleware can modify the request context, call the next middleware, and transform the response.

```typescript
import { DorisioClient, type Middleware } from 'dorisio-sdk';

const client = new DorisioClient({ baseUrl: 'https://api.dorisio.com', token: 'token' });

client.use(async (context, next) => {
  // Pre-request: modify context before calling next()
  console.log('Request:', context.method, context.path);

  // Call next middleware in the chain
  const response = await next();

  // Post-response: transform the response
  console.log('Response received');

  return response;
});
```

## Middleware Contract

### Middleware Type

```typescript
export interface MiddlewareContext {
  /** The request method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The request path */
  path: string;
  /** The request body (if any) */
  body?: unknown;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request ID for tracking */
  requestId?: string;
}

export type Middleware = (
  context: MiddlewareContext,
  next: () => Promise<unknown>
) => Promise<unknown>;
```

### Key Principles

1. **Chain of Responsibility**: Middleware receives a `context` object and a `next()` function
2. **Must Call Next**: To continue the request, middleware **must** call `await next()`
3. **Short-Circuiting**: If middleware returns without calling `next()`, the request is short-circuited
4. **Execution Order**: Middleware runs in registration order (FIFO - First In, First Out)
5. **Request/Response Phase**: Code before `next()` runs pre-request, code after runs post-response

## Execution Order

Middleware executes in the following order for each client request:

```
Request → Middleware 1 (pre) → Middleware 2 (pre) → ... → HTTP Request
                    ↓                                  ↓
            Middleware 1 (post) ← Middleware 2 (post) ← Response
```

### Detailed Flow

1. **Pre-request phase**: Each middleware runs in registration order, executing code before `await next()`
2. **HTTP Request**: The actual HTTP request is sent (after all middleware pre-phase code)
3. **Post-response phase**: Each middleware runs in reverse order, executing code after `await next()`
4. **Response**: The final transformed response is returned to the caller

### Example: Execution Order

```typescript
import { DorisioClient } from 'dorisio-sdk';

const client = new DorisioClient({ baseUrl: 'https://api.dorisio.com', token: 'token' });
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

await client.getCreator('creator-123');

console.log(order);
// Output: ['middleware-1-pre', 'middleware-2-pre', 'middleware-2-post', 'middleware-1-post']
```

## Short-Circuiting

Middleware can short-circuit a request by returning a value without calling `next()`. This is useful for:
- Serving cached responses
- Implementing request deduplication
- Blocking certain requests
- Returning mock data

```typescript
// Example: Cache middleware that short-circuits
const cache = new Map<string, unknown>();

client.use(async (context, next) => {
  const cacheKey = `${context.method}:${context.path}`;

  // Check cache - short-circuit if found
  if (cache.has(cacheKey)) {
    console.log('Cache hit');
    return cache.get(cacheKey);
  }

  // Otherwise, proceed with request
  const response = await next();

  // Store in cache
  cache.set(cacheKey, response);
  return response;
});
```

## Error Handling

Errors in middleware propagate through the chain. If middleware throws before calling `next()`, subsequent middleware won't execute. If middleware throws after `next()`, the error propagates up through the middleware stack.

```typescript
client.use(async (context, next) => {
  try {
    const response = await next();
    return response;
  } catch (error) {
    // Transform errors here
    console.error('Request failed:', error);
    throw error; // Re-throw or return a fallback
  }
});
```

## Common Patterns

### 1. Logging Middleware

```typescript
export const loggingMiddleware: Middleware = async (context, next) => {
  const startTime = Date.now();

  console.log(`→ ${context.method} ${context.path}`, {
    body: context.body,
    headers: context.headers,
  });

  try {
    const response = await next();
    const duration = Date.now() - startTime;

    console.log(`← ${context.method} ${context.path} (${duration}ms)`);
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ ${context.method} ${context.path} (${duration}ms)`, error);
    throw error;
  }
};

// Usage
client.use(loggingMiddleware);
```

### 2. Auth Injection Middleware

```typescript
export const authInjectionMiddleware: Middleware = (context, next) => {
  // Ensure auth header is present
  if (!context.headers?.['Authorization']) {
    context.headers = {
      ...context.headers,
      'Authorization': `Bearer ${getAuthToken()}`,
    };
  }

  return next();
};

// Usage
client.use(authInjectionMiddleware);
```

### 3. Request Transformation Middleware

```typescript
export const snakeCaseMiddleware: Middleware = (context, next) => {
  if (context.body) {
    // Convert camelCase to snake_case for API compatibility
    context.body = toSnakeCase(context.body);
  }

  return next();
};

// Usage
client.use(snakeCaseMiddleware);
```

### 4. Response Transformation Middleware

```typescript
export const camelCaseMiddleware: Middleware = async (context, next) => {
  const response = await next();

  // Convert snake_case response to camelCase
  if (response && typeof response === 'object') {
    return toCamelCase(response);
  }

  return response;
};

// Usage
client.use(camelCaseMiddleware);
```

### 5. Error Transformation Middleware

```typescript
export const errorTransformMiddleware: Middleware = async (context, next) => {
  try {
    return await next();
  } catch (error) {
    // Transform API errors into user-friendly messages
    if (error instanceof ApiError) {
      throw new UserFriendlyError(mapErrorCodeToMessage(error.code));
    }
    throw error;
  }
};

// Usage
client.use(errorTransformMiddleware);
```

## Middleware vs Interceptors

The SDK provides both middleware and interceptors. Here's when to use each:

| Feature | Middleware | Interceptors |
|---------|-----------|--------------|
| **Registration** | `client.use(middleware)` | `client.getHttpClient().getInterceptors().add*Interceptor()` |
| **Scope** | Client-level (wraps entire request) | HTTP-level (operates on raw HTTP) |
| **Short-circuiting** | Yes (can return without calling next) | No (must return transformed value) |
| **Access to** | High-level request context | Low-level HTTP options |
| **Best for** | Business logic, data transformation | Cross-cutting concerns (logging, metrics) |
| **Execution** | Pre-request + Post-response phases | Separate request/response/error phases |

### When to Use Middleware

- Business logic that should apply to all requests
- Request/response data transformation (e.g., case conversion)
- High-level caching strategies
- Conditional request handling
- Integrating with external libraries at the client level

### When to Use Interceptors

- Low-level HTTP concerns (headers, timeouts)
- Cross-cutting concerns (logging, metrics, telemetry)
- Network-level retries and error handling
- HTTP-specific transformations

See [INTERCEPTORS.md](./INTERCEPTORS.md) for more details on interceptors.

## API Reference

### `client.use(middleware: Middleware): void`

Register a middleware function. Middleware is executed in registration order.

```typescript
client.use(async (context, next) => {
  // Pre-request logic
  const response = await next();
  // Post-response logic
  return response;
});
```

**Parameters:**
- `middleware`: A function that receives `MiddlewareContext` and a `next()` function

**Example:**
```typescript
client.use(async (context, next) => {
  console.log('Request:', context.path);
  const response = await next();
  console.log('Response:', response);
  return response;
});
```

## Sandbox Compatibility

Middleware runs in sandbox mode too, making it useful for testing without network access:

```typescript
const client = new DorisioClient({
  baseUrl: 'https://api.dorisio.com',
  mode: 'sandbox',
});

let middlewareCalled = false;
client.use(async (context, next) => {
  middlewareCalled = true;
  return next();
});

await client.getCreator('creator-123');
console.log(middlewareCalled); // true
```

## Best Practices

1. **Always Call Next**: Unless intentionally short-circuiting, always `await next()`
2. **Handle Errors**: Wrap `next()` in try/catch to handle errors appropriately
3. **Keep it Pure**: Avoid side effects in middleware when possible
4. **Order Matters**: Register middleware in the order you want them to execute
5. **Document Purpose**: Add comments explaining what each middleware does
6. **Test Separately**: Test middleware logic independently from the client

## Examples

Complete runnable examples are available in [`docs/examples/middleware/`](./examples/middleware/).
