/**
 * Creator Methods
 *
 * SDK methods for creator operations.
 */

import { Creator, CreatorProfile } from '../types/models';
import { normalizeCreator, normalizeListCreatorsResponse } from '../utils/normalizers';
import { DorisioClient } from '../client';

/**
 * Get creator by ID.
 *
 * @param creatorId - Unique creator ID
 * @returns Promise resolving to Creator object
 * @throws Error if creator fetch fails or creator not found
 * @see {@link listCreators} for fetching paginated creator lists
 * @example
 * ```ts
 * const creator = await client.getCreator('creator_123');
 * ```
 */
export async function getCreator<TCreator = Creator>(
  this: DorisioClient,
  creatorId: string
): Promise<TCreator> {
  const response = await this.request('GET', `/creators/${creatorId}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch creator: ${creatorId}`);
  }

  return normalizeCreator(response.data) as TCreator;
}

/**
 * List creators with optional pagination and verification status filter.
 *
 * @param options - Pagination and filtering options
 * @param options.page - Page number (1-indexed)
 * @param options.pageSize - Items per page
 * @param options.verified - Filter by verification status
 * @returns Promise resolving to paginated list of creators
 * @throws Error if request fails
 * @see {@link getCreator} for fetching single creator details
 * @example
 * ```ts
 * const result = await client.listCreators({ page: 1, pageSize: 10, verified: true });
 * ```
 */
export async function listCreators<TCreator = Creator>(
  this: DorisioClient,
  options?: {
    page?: number;
    pageSize?: number;
    verified?: boolean;
  }
): Promise<{ creators: TCreator[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams();

  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));
  if (options?.verified !== undefined) params.append('verified', String(options.verified));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/creators${query}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch creators list');
  }

  const normalized = normalizeListCreatorsResponse(response.data);
  return {
    ...normalized,
    creators: normalized.creators as unknown as TCreator[],
  };
}

/**
 * Get public creator profile by username.
 *
 * @param username - Creator username
 * @returns Promise resolving to CreatorProfile with statistics
 * @throws Error if profile fetch fails
 * @example
 * ```ts
 * const profile = await client.getCreatorProfile('john_doe');
 * ```
 */
export async function getCreatorProfile<TCreatorProfile = CreatorProfile>(
  this: DorisioClient,
  username: string
): Promise<TCreatorProfile> {
  const response = await this.request('GET', `/creators/profile/${username}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch creator profile: ${username}`);
  }

  const data = response.data as Record<string, unknown>;
  const creator = normalizeCreator(data);

  const rawStats = data['stats'];
  const stats =
    rawStats && typeof rawStats === 'object'
      ? (rawStats as { totalTips?: number; averageTip?: number; lastTipDate?: string | null })
      : undefined;

  return {
    ...creator,
    stats: {
      totalTips: stats?.totalTips ?? 0,
      averageTip: stats?.averageTip ?? 0,
      lastTipDate: stats?.lastTipDate ?? null,
    },
  } as unknown as TCreatorProfile;
}

/**
 * Verify creator identity (admin operation).
 *
 * @param creatorId - Creator ID
 * @param verified - Verification status to set (default true)
 * @returns Promise resolving to updated Creator entity
 * @throws Error if verification update fails
 */
export async function verifyCreator<TCreator = Creator>(
  this: DorisioClient,
  creatorId: string,
  verified: boolean = true
): Promise<TCreator> {
  const response = await this.request('PATCH', `/creators/${creatorId}/verify`, {
    verified,
  });

  if (!response.success || !response.data) {
    throw new Error(`Failed to verify creator: ${creatorId}`);
  }

  return normalizeCreator(response.data) as TCreator;
}
