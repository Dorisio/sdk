/**
 * Query & Pagination Utilities
 *
 * Build clean queries with filtering, sorting, and pagination.
 */

import type { ApiResponse } from '../types/api';
import type { Creator, Transaction } from '../types/models';

/** Minimal interface for any client that can make HTTP requests */
export interface QueryClient {
  request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
  sort?: 'asc' | 'desc';
  filters?: Record<string, string | number | boolean>;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

/**
 * Build query string from options.
 *
 * @param options - Query parameters including limit, offset, cursor, sort order, and filters
 * @returns Formatted query string starting with '?' or empty string if no parameters
 *
 * @example
 * ```ts
 * const query = buildQueryString({ limit: 10, sort: 'asc' });
 * // "?limit=10&sort=asc"
 * ```
 */
export function buildQueryString(options: QueryOptions = {}): string {
  const params = new URLSearchParams();

  if (options.limit) params.append('limit', String(options.limit));
  if (options.offset) params.append('offset', String(options.offset));
  if (options.cursor) params.append('cursor', options.cursor);
  if (options.sort) params.append('sort', options.sort);

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value !== null && value !== undefined) {
        params.append(`filter[${key}]`, String(value));
      }
    }
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

interface PaginatedApiData {
  page?: number;
  pageSize?: number;
  limit?: number;
  total?: number;
}

/**
 * Parse pagination metadata from response.
 *
 * @param response - Backend response object containing page/limit/total fields
 * @returns Parsed pagination metadata object with page, pageSize, total, and hasMore indicator
 *
 * @example
 * ```ts
 * const meta = parsePaginationMeta({ page: 1, limit: 20, total: 45 });
 * console.log(meta.hasMore); // true
 * ```
 */
export function parsePaginationMeta(response: PaginatedApiData): {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
} {
  const page = response.page ?? 1;
  const pageSize = response.pageSize ?? response.limit ?? 20;
  const total = response.total ?? 0;
  return { page, pageSize, total, hasMore: page * pageSize < total };
}

/**
 * List tips with filtering and pagination.
 *
 * @param client - Client implementing QueryClient interface
 * @param options - Query filtering and pagination options
 * @returns Promise resolving to PaginationResult envelope of Transaction items
 * @throws {Error} If API request fails
 *
 * @example
 * ```ts
 * const result = await listTips(client, { limit: 10 });
 * ```
 */
export async function listTips(
  client: QueryClient,
  options: QueryOptions = {}
): Promise<PaginationResult<Transaction>> {
  const query = buildQueryString(options);
  const response = await client.request<{
    transactions?: Transaction[];
    page?: number;
    pageSize?: number;
    total?: number;
  }>('GET', `/api/v1/transactions/history${query}`);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch tips');
  }

  const data = response.data ?? {};
  const { page, pageSize, total, hasMore } = parsePaginationMeta(data);
  const offset = options.offset ?? 0;

  return {
    items: data.transactions ?? [],
    total,
    page,
    pageSize,
    hasMore,
    nextCursor: hasMore ? String(offset + pageSize) : undefined,
    prevCursor: offset > 0 ? String(Math.max(0, offset - pageSize)) : undefined,
  };
}

/**
 * List creator tips with filtering and pagination.
 *
 * @param client - Client implementing QueryClient interface
 * @param creatorId - Creator ID filter
 * @param options - Query filtering and pagination options
 * @returns Promise resolving to PaginationResult envelope of Transaction items
 * @throws {Error} If API request fails
 *
 * @example
 * ```ts
 * const result = await listCreatorTips(client, 'creator-123', { limit: 5 });
 * ```
 */
export async function listCreatorTips(
  client: QueryClient,
  creatorId: string,
  options: QueryOptions = {}
): Promise<PaginationResult<Transaction>> {
  const query = buildQueryString(options);
  const response = await client.request<{
    transactions?: Transaction[];
    page?: number;
    pageSize?: number;
    total?: number;
  }>('GET', `/api/v1/transactions/creator/${creatorId}${query}`);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch creator tips');
  }

  const data = response.data ?? {};
  const { page, pageSize, total, hasMore } = parsePaginationMeta(data);
  const offset = options.offset ?? 0;

  return {
    items: data.transactions ?? [],
    total,
    page,
    pageSize,
    hasMore,
    nextCursor: hasMore ? String(offset + pageSize) : undefined,
    prevCursor: offset > 0 ? String(Math.max(0, offset - pageSize)) : undefined,
  };
}

/**
 * List creators with filtering and pagination.
 *
 * @param client - Client implementing QueryClient interface
 * @param options - Query filtering and pagination options
 * @returns Promise resolving to PaginationResult envelope of Creator items
 * @throws {Error} If API request fails
 *
 * @example
 * ```ts
 * const creators = await listCreators(client, { limit: 20 });
 * ```
 */
export async function listCreators(
  client: QueryClient,
  options: QueryOptions = {}
): Promise<PaginationResult<Creator>> {
  const query = buildQueryString(options);
  const response = await client.request<{
    creators?: Creator[];
    page?: number;
    pageSize?: number;
    total?: number;
  }>('GET', `/api/v1/creators${query}`);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch creators');
  }

  const data = response.data ?? {};
  const { page, pageSize, total, hasMore } = parsePaginationMeta(data);
  const offset = options.offset ?? 0;

  return {
    items: data.creators ?? [],
    total,
    page,
    pageSize,
    hasMore,
    nextCursor: hasMore ? String(offset + pageSize) : undefined,
    prevCursor: offset > 0 ? String(Math.max(0, offset - pageSize)) : undefined,
  };
}

/**
 * List verified creators.
 *
 * @param client - Client implementing QueryClient interface
 * @param options - Query filtering and pagination options
 * @returns Promise resolving to PaginationResult envelope of verified Creator items
 * @throws {Error} If API request fails
 *
 * @example
 * ```ts
 * const verifiedCreators = await listVerifiedCreators(client);
 * ```
 */
export async function listVerifiedCreators(
  client: QueryClient,
  options: QueryOptions = {}
): Promise<PaginationResult<Creator>> {
  return listCreators(client, {
    ...options,
    filters: { ...options.filters, verified: true },
  });
}

/**
 * Paginate through results manually.
 *
 * @example
 * ```ts
 * const paginator = new Paginator(client, 'creators', { limit: 10 });
 * const page1 = await paginator.next();
 * const page2 = await paginator.next();
 * ```
 */
export class Paginator<T> {
  private offset = 0;
  private readonly pageSize: number;
  private readonly endpoint: string;
  private readonly client: QueryClient;
  private readonly filters?: Record<string, string | number | boolean>;

  /**
   * Create a Paginator instance.
   *
   * @param client - QueryClient instance
   * @param endpoint - Target endpoint ('tips' | 'creators' | 'creator-tips')
   * @param options - Initial query options
   */
  constructor(
    client: QueryClient,
    endpoint: 'tips' | 'creators' | 'creator-tips',
    options: QueryOptions = {}
  ) {
    this.client = client;
    this.endpoint = endpoint;
    this.pageSize = options.limit ?? 20;
    this.filters = options.filters;
  }

  /**
   * Fetch the next page of results.
   *
   * @returns Promise resolving to PaginationResult
   */
  async next(): Promise<PaginationResult<T>> {
    const result = await this.fetchPage();
    if (result.hasMore) this.offset += this.pageSize;
    return result;
  }

  /**
   * Fetch the previous page of results.
   *
   * @returns Promise resolving to PaginationResult
   */
  async previous(): Promise<PaginationResult<T>> {
    this.offset = Math.max(0, this.offset - this.pageSize);
    return this.fetchPage();
  }

  /**
   * Jump to a specific page number (1-indexed).
   *
   * @param pageNumber - Page number to fetch
   * @returns Promise resolving to PaginationResult
   */
  async goto(pageNumber: number): Promise<PaginationResult<T>> {
    this.offset = (pageNumber - 1) * this.pageSize;
    return this.fetchPage();
  }

  /**
   * Reset pagination offset to zero.
   */
  reset(): void {
    this.offset = 0;
  }

  /**
   * Get current pagination offset.
   *
   * @returns Current offset number
   */
  getOffset(): number {
    return this.offset;
  }

  private async fetchPage(): Promise<PaginationResult<T>> {
    const options: QueryOptions = {
      limit: this.pageSize,
      offset: this.offset,
      filters: this.filters,
    };

    if (this.endpoint === 'tips') {
      return listTips(this.client, options) as Promise<PaginationResult<T>>;
    } else if (this.endpoint === 'creators') {
      return listCreators(this.client, options) as Promise<PaginationResult<T>>;
    } else {
      throw new Error(`Unknown endpoint: ${this.endpoint}`);
    }
  }
}

/**
 * Create a paginator for iterating through results.
 *
 * @param client - QueryClient instance
 * @param endpoint - Target endpoint ('tips' | 'creators' | 'creator-tips')
 * @param options - Query options
 * @returns Paginator instance
 *
 * @example
 * ```ts
 * const paginator = createPaginator(client, 'creators', { limit: 10 });
 * ```
 */
export function createPaginator<T>(
  client: QueryClient,
  endpoint: 'tips' | 'creators' | 'creator-tips',
  options?: QueryOptions
): Paginator<T> {
  return new Paginator(client, endpoint, options);
}
