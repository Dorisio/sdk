/**
 * Creator Methods
 *
 * SDK methods for creator operations.
 */

import { Creator, CreatorProfile } from '../types/models';
import { CreatorMapper } from '../utils/mappers';
import { normalizeCreator, normalizeCreators } from '../utils/normalizers';
import { DorisioClient } from '../client';

/**
 * Get creator by ID
 */
export async function getCreator(this: DorisioClient, creatorId: string): Promise<Creator> {
  const response = await this.request('GET', `/creators/${creatorId}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch creator: ${creatorId}`);
  }

  return normalizeCreator(response.data);
}

/**
 * List creators with pagination
 */
export async function listCreators(
  this: DorisioClient,
  options?: {
    page?: number;
    pageSize?: number;
    verified?: boolean;
  }
): Promise<{ creators: Creator[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams();

  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));
  if (options?.verified !== undefined) params.append('verified', String(options.verified));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/creators${query}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch creators list');
  }

  return {
    creators: normalizeCreators(response.data.creators || []),
    total: response.data.total || 0,
    page: response.data.page || 1,
    pageSize: response.data.pageSize || 20,
  };
}

/**
 * Get public creator profile by username
 */
export async function getCreatorProfile(
  this: DorisioClient,
  username: string
): Promise<CreatorProfile> {
  const response = await this.request('GET', `/creators/profile/${username}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch creator profile: ${username}`);
  }

  const creator = normalizeCreator(response.data);
  return {
    ...creator,
    stats: response.data.stats || {
      totalTips: 0,
      averageTip: 0,
      lastTipDate: null,
    },
  };
}

/**
 * Verify creator identity (admin only)
 */
export async function verifyCreator(
  this: DorisioClient,
  creatorId: string,
  verified: boolean
): Promise<Creator> {
  const response = await this.request('PATCH', `/creators/${creatorId}/verify`, {
    verified,
  });

  if (!response.success || !response.data) {
    throw new Error(`Failed to verify creator: ${creatorId}`);
  }

  return normalizeCreator(response.data);
}
