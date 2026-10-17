# Middleware Examples

This directory contains example middleware implementations for the Dorisio SDK.

## Examples

### [logging-middleware.ts](./logging-middleware.ts)
Logs request and response information with timing. Demonstrates pre-request and post-response phases.

### [auth-injection-middleware.ts](./auth-injection-middleware.ts)
Automatically injects authentication headers into requests. Demonstrates modifying the request context.

### [error-transformation-middleware.ts](./error-transformation-middleware.ts)
Transforms API errors into user-friendly error messages. Demonstrates error handling in the post-response phase.

### [cache-middleware.ts](./cache-middleware.ts)
Implements request caching with short-circuiting. Demonstrates how to return a value without calling `next()`.

## Usage

Each example file includes usage comments at the bottom. To use any middleware:

```typescript
import { DorisioClient } from 'dorisio-sdk';
import { loggingMiddleware } from './middleware/logging-middleware';

const client = new DorisioClient({
  baseUrl: 'https://api.dorisio.com',
  token: 'your-token',
});

client.use(loggingMiddleware);
```

## See Also

- [Middleware Documentation](../../docs/MIDDLEWARE.md)
- [Interceptors Documentation](../../docs/INTERCEPTORS.md)
